import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  BOOKING_TIMEZONE,
  CalApiError,
  calRequest,
  createServiceRoleClient,
  getCalApiConfig,
  getCorsHeaders,
  isOriginAllowed,
  json,
  logBookingRequest,
  toTimeZoneParts,
} from '../_shared/booking.ts';

const ENDPOINT = 'internal-reservation-details';
const ENDPOINT_EXPORT = 'internal-reservation-details/export';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const asStr = (v: unknown): string | null => (typeof v === 'string' ? v : null);

// ── Completion Score ──────────────────────────────────────────────────

const computeCompletionScore = (
  guest: Record<string, unknown>,
  reservation: Record<string, unknown>,
  stays: unknown[],
) => {
  const missing: string[] = [];
  let score = 0;

  // 20% guest contact
  const hasName = !!asStr(guest.full_name);
  const hasEmail = !!asStr(guest.email);
  const hasPhone = !!asStr(guest.phone) || !!asStr(guest.whatsapp);
  if (hasName && (hasEmail || hasPhone)) {
    score += 20;
  } else {
    if (!hasName) missing.push('guest_name');
    if (!hasEmail && !hasPhone) missing.push('guest_contact');
  }

  // 20% party composition
  const hasGuestCount = reservation.guest_count != null && Number(reservation.guest_count) > 0;
  const hasAdultCount = reservation.adult_count != null;
  if (hasGuestCount && hasAdultCount) {
    score += 20;
  } else {
    if (!hasGuestCount) missing.push('guest_count');
    if (!hasAdultCount) missing.push('adult_count');
  }

  // 20% accommodation
  if (stays.length > 0) {
    const firstStay = isRecord(stays[0]) ? stays[0] : {};
    if (asStr(firstStay.property_name)) {
      score += 20;
    } else {
      missing.push('accommodation');
    }
  } else {
    missing.push('accommodation');
  }

  // 20% guest care
  const hasDietary = !!asStr(reservation.dietary_notes);
  const hasAllergies = Array.isArray(reservation.allergies) && reservation.allergies.length > 0;
  const hasMobility = !!asStr(reservation.mobility_notes);
  if (hasDietary || hasAllergies || hasMobility) {
    score += 20;
  } else {
    missing.push('guest_care');
  }

  // 20% ops notes
  const hasConcierge = !!asStr(reservation.concierge_notes);
  const hasInternal = !!asStr(reservation.internal_notes);
  const hasOccasion = !!asStr(reservation.occasion_notes);
  if (hasConcierge || hasInternal || hasOccasion) {
    score += 20;
  } else {
    missing.push('ops_notes');
  }

  return { score, missing };
};

// ── Seed from Cal ─────────────────────────────────────────────────────

const seedFromCal = async ({
  serviceSupabase,
  calConfig,
  bookingUid,
  yachtSlug,
  yachtName,
  userId,
}: {
  serviceSupabase: ReturnType<typeof createServiceRoleClient>;
  calConfig: ReturnType<typeof getCalApiConfig>;
  bookingUid: string;
  yachtSlug: string;
  yachtName: string;
  userId: string;
}) => {
  const result = await calRequest<{ data?: Record<string, unknown> }>({
    config: calConfig,
    method: 'GET',
    path: `/v2/bookings/${bookingUid}`,
    apiVersion: '2024-08-13',
  });

  const booking = result.data;
  if (!booking || !isRecord(booking)) return null;

  const startIso = asStr(booking.start) || asStr(booking.startTime) || '';
  const endIso = asStr(booking.end) || asStr(booking.endTime) || '';

  const attendees = Array.isArray(booking.attendees) ? booking.attendees : [];
  const first = attendees.length > 0 && isRecord(attendees[0]) ? attendees[0] : null;
  const guestName = asStr(first?.name) || '';
  const guestEmail = asStr(first?.email) || '';
  const guestPhone = asStr(first?.phoneNumber) || asStr(first?.phone) || '';

  // Upsert guest
  const { data: guestRow } = await serviceSupabase
    .from('guest_profiles')
    .insert({
      full_name: guestName,
      email: guestEmail,
      phone: guestPhone,
      created_by: userId,
      updated_by: userId,
    })
    .select('id')
    .single();

  const guestId = guestRow?.id || null;

  // Insert reservation
  const { data: resRow, error: resErr } = await serviceSupabase
    .from('reservation_details')
    .insert({
      booking_uid_current: bookingUid,
      booking_uid_history: [],
      yacht_slug: yachtSlug,
      yacht_name: yachtName,
      start_at: startIso,
      end_at: endIso,
      guest_profile_id: guestId,
      source: 'seeded_from_cal',
      status: 'booked',
      created_by: userId,
      updated_by: userId,
    })
    .select('*')
    .single();

  if (resErr) throw resErr;

  return { reservation: resRow, guestId };
};

// ── Load full record ──────────────────────────────────────────────────

const loadFullRecord = async ({
  serviceSupabase,
  bookingUid,
}: {
  serviceSupabase: ReturnType<typeof createServiceRoleClient>;
  bookingUid: string;
}) => {
  const { data: reservation } = await serviceSupabase
    .from('reservation_details')
    .select('*')
    .eq('booking_uid_current', bookingUid)
    .maybeSingle();

  if (!reservation) return null;

  const { data: guest } = reservation.guest_profile_id
    ? await serviceSupabase
        .from('guest_profiles')
        .select('*')
        .eq('id', reservation.guest_profile_id)
        .maybeSingle()
    : { data: null };

  const { data: stays } = await serviceSupabase
    .from('reservation_stays')
    .select('*')
    .eq('reservation_id', reservation.id)
    .order('sort_order', { ascending: true });

  const { data: auditRows } = await serviceSupabase
    .from('reservation_change_log')
    .select('id,action,actor_user_id,booking_uid,created_at')
    .eq('reservation_id', reservation.id)
    .order('created_at', { ascending: false })
    .limit(20);

  const guestObj = guest || {};
  const staysArr = stays || [];
  const { score, missing } = computeCompletionScore(
    guestObj as Record<string, unknown>,
    reservation as Record<string, unknown>,
    staysArr,
  );

  return {
    reservation,
    guest: guest || null,
    stays: staysArr,
    auditSummary: auditRows || [],
    completionScore: { score, missingFields: missing },
  };
};

// ── Auth helpers ──────────────────────────────────────────────────────

const authenticate = async (req: Request, serviceSupabase: ReturnType<typeof createServiceRoleClient>) => {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return { user: null, error: 'missing_auth_header' as const };

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await anonClient.auth.getUser();
  if (error || !user) return { user: null, error: 'invalid_token' as const };
  return { user, error: null };
};

const checkRole = async (
  serviceSupabase: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  requiredRole: 'admin' | 'admin_or_staff',
) => {
  if (requiredRole === 'admin') {
    const { data } = await serviceSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    return !!data;
  }
  // admin or staff
  const { data } = await serviceSupabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['admin', 'staff'])
    .maybeSingle();
  return !!data;
};

const checkYachtEligibility = async (
  serviceSupabase: ReturnType<typeof createServiceRoleClient>,
  slug: string,
) => {
  const { data: yacht, error } = await serviceSupabase
    .from('yachts')
    .select('id,name,slug,booking_mode,cal_event_type_id')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!yacht || yacht.booking_mode !== 'policy_v2' || !yacht.cal_event_type_id) return null;
  return yacht;
};

// ── Main Handler ──────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }
  if (!isOriginAllowed(req)) {
    return json(req, 403, { error: 'Origin not allowed' });
  }

  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  const serviceSupabase = createServiceRoleClient();
  const url = new URL(req.url);

  // Detect sub-path: /export
  const isExport = url.pathname.endsWith('/export');
  const endpoint = isExport ? ENDPOINT_EXPORT : ENDPOINT;

  // ── Auth ──
  const { user, error: authErr } = await authenticate(req, serviceSupabase);
  if (!user) {
    const code = authErr === 'missing_auth_header' ? 401 : 401;
    await logBookingRequest({ supabase: serviceSupabase, endpoint, requestId, statusCode: code, details: { reason: authErr! } });
    return json(req, code, { error: authErr === 'missing_auth_header' ? 'Authorization header required' : 'Unauthorized', requestId });
  }

  try {
    // ── GET: read reservation details ──
    if (req.method === 'GET' && !isExport) {
      const hasAccess = await checkRole(serviceSupabase, user.id, 'admin_or_staff');
      if (!hasAccess) {
        await logBookingRequest({ supabase: serviceSupabase, endpoint, requestId, statusCode: 403, details: { reason: 'forbidden_non_admin', userId: user.id } });
        return json(req, 403, { error: 'Access denied', requestId });
      }

      const bookingUid = url.searchParams.get('bookingUid')?.trim();
      const slug = url.searchParams.get('slug')?.trim();
      if (!bookingUid || !slug) {
        await logBookingRequest({ supabase: serviceSupabase, endpoint, requestId, statusCode: 400, details: { reason: 'invalid_input' } });
        return json(req, 400, { error: 'bookingUid and slug are required', requestId });
      }

      const yacht = await checkYachtEligibility(serviceSupabase, slug);
      if (!yacht) {
        await logBookingRequest({ supabase: serviceSupabase, endpoint, requestId, statusCode: 404, details: { reason: 'not_eligible', slug } });
        return json(req, 404, { error: 'Yacht not found or not eligible', requestId });
      }

      // Try loading existing record
      let record = await loadFullRecord({ serviceSupabase, bookingUid });

      // Seed from Cal if missing
      if (!record) {
        const calConfig = getCalApiConfig();
        try {
          await seedFromCal({
            serviceSupabase,
            calConfig,
            bookingUid,
            yachtSlug: yacht.slug,
            yachtName: yacht.name,
            userId: user.id,
          });
        } catch (err) {
          if (err instanceof CalApiError && err.status === 404) {
            await logBookingRequest({ supabase: serviceSupabase, endpoint, requestId, statusCode: 404, details: { reason: 'invalid_input', bookingUid, note: 'booking_not_found_in_cal' } });
            return json(req, 404, { error: 'Booking not found', requestId });
          }
          throw err;
        }

        record = await loadFullRecord({ serviceSupabase, bookingUid });
        if (!record) {
          await logBookingRequest({ supabase: serviceSupabase, endpoint, requestId, statusCode: 500, details: { reason: 'unhandled_error', note: 'seed_failed' } });
          return json(req, 500, { error: 'Failed to seed reservation', requestId });
        }

        await logBookingRequest({ supabase: serviceSupabase, endpoint, requestId, statusCode: 200, details: { reason: 'seeded_from_cal', bookingUid, slug } });
      }

      return json(req, 200, { requestId, ...record });
    }

    // ── POST /export ──
    if (req.method === 'POST' && isExport) {
      const hasAccess = await checkRole(serviceSupabase, user.id, 'admin_or_staff');
      if (!hasAccess) {
        await logBookingRequest({ supabase: serviceSupabase, endpoint, requestId, statusCode: 403, details: { reason: 'forbidden_non_admin', userId: user.id } });
        return json(req, 403, { error: 'Access denied', requestId });
      }

      let body: { slug?: string; bookingUid?: string; format?: string };
      try { body = await req.json(); } catch {
        return json(req, 400, { error: 'Invalid JSON', requestId });
      }

      const slug = body.slug?.trim();
      const bookingUid = body.bookingUid?.trim();
      if (!slug || !bookingUid) {
        await logBookingRequest({ supabase: serviceSupabase, endpoint, requestId, statusCode: 400, details: { reason: 'invalid_input' } });
        return json(req, 400, { error: 'slug and bookingUid are required', requestId });
      }

      const yacht = await checkYachtEligibility(serviceSupabase, slug);
      if (!yacht) {
        await logBookingRequest({ supabase: serviceSupabase, endpoint, requestId, statusCode: 404, details: { reason: 'not_eligible', slug } });
        return json(req, 404, { error: 'Yacht not found or not eligible', requestId });
      }

      const record = await loadFullRecord({ serviceSupabase, bookingUid });
      if (!record) {
        await logBookingRequest({ supabase: serviceSupabase, endpoint, requestId, statusCode: 404, details: { reason: 'invalid_input', bookingUid } });
        return json(req, 404, { error: 'Reservation not found', requestId });
      }

      // Write change log
      await serviceSupabase.from('reservation_change_log').insert({
        reservation_id: record.reservation.id,
        booking_uid: bookingUid,
        action: 'exported',
        actor_user_id: user.id,
        payload: { format: body.format || 'copy' },
      });

      const guestName = (record.guest as Record<string, unknown>)?.preferred_name || (record.guest as Record<string, unknown>)?.full_name || 'guest';
      const dateStr = record.reservation.start_at ? record.reservation.start_at.slice(0, 10) : 'unknown';
      const fileName = `reservation_${slug}_${dateStr}_${String(guestName).replace(/\s+/g, '_')}.${body.format === 'csv' ? 'csv' : 'txt'}`;

      await logBookingRequest({ supabase: serviceSupabase, endpoint, requestId, statusCode: 200, details: { reason: 'exported', bookingUid, slug } });

      return json(req, 200, {
        requestId,
        payload: record,
        fileName,
      });
    }

    // ── PUT: update reservation details ──
    if (req.method === 'PUT' && !isExport) {
      const isAdmin = await checkRole(serviceSupabase, user.id, 'admin');
      if (!isAdmin) {
        await logBookingRequest({ supabase: serviceSupabase, endpoint, requestId, statusCode: 403, details: { reason: 'forbidden_non_admin', userId: user.id } });
        return json(req, 403, { error: 'Admin access required', requestId });
      }

      let body: { slug?: string; bookingUid?: string; reservation?: Record<string, unknown>; guest?: Record<string, unknown>; stays?: unknown[] };
      try { body = await req.json(); } catch {
        return json(req, 400, { error: 'Invalid JSON', requestId });
      }

      const slug = body.slug?.trim();
      const bookingUid = body.bookingUid?.trim();
      if (!slug || !bookingUid) {
        await logBookingRequest({ supabase: serviceSupabase, endpoint, requestId, statusCode: 400, details: { reason: 'invalid_input' } });
        return json(req, 400, { error: 'slug and bookingUid are required', requestId });
      }

      const yacht = await checkYachtEligibility(serviceSupabase, slug);
      if (!yacht) {
        await logBookingRequest({ supabase: serviceSupabase, endpoint, requestId, statusCode: 404, details: { reason: 'not_eligible', slug } });
        return json(req, 404, { error: 'Yacht not found or not eligible', requestId });
      }

      // Load existing
      const { data: existingRes } = await serviceSupabase
        .from('reservation_details')
        .select('id,guest_profile_id')
        .eq('booking_uid_current', bookingUid)
        .maybeSingle();

      if (!existingRes) {
        await logBookingRequest({ supabase: serviceSupabase, endpoint, requestId, statusCode: 404, details: { reason: 'invalid_input', bookingUid } });
        return json(req, 404, { error: 'Reservation not found. Open it first to seed.', requestId });
      }

      // Upsert guest
      let guestId = existingRes.guest_profile_id;
      if (body.guest && isRecord(body.guest)) {
        const guestData: Record<string, unknown> = {
          full_name: body.guest.full_name ?? '',
          preferred_name: body.guest.preferred_name ?? '',
          email: body.guest.email ?? '',
          phone: body.guest.phone ?? '',
          whatsapp: body.guest.whatsapp ?? '',
          nationality: body.guest.nationality ?? '',
          preferred_language: body.guest.preferred_language ?? '',
          notes: body.guest.notes ?? '',
          updated_by: user.id,
        };

        if (guestId) {
          await serviceSupabase.from('guest_profiles').update(guestData).eq('id', guestId);
        } else {
          const { data: newGuest } = await serviceSupabase
            .from('guest_profiles')
            .insert({ ...guestData, created_by: user.id })
            .select('id')
            .single();
          guestId = newGuest?.id || null;
        }
      }

      // Update reservation
      if (body.reservation && isRecord(body.reservation)) {
        const resData: Record<string, unknown> = { updated_by: user.id };
        const allowedFields = [
          'guest_count', 'adult_count', 'kids_count', 'kids_notes',
          'allergies', 'preferences', 'dietary_notes', 'mobility_notes',
          'occasion_notes', 'concierge_notes', 'internal_notes',
          'staying_multiple_places',
        ];
        for (const f of allowedFields) {
          if (body.reservation[f] !== undefined) resData[f] = body.reservation[f];
        }
        if (guestId) resData.guest_profile_id = guestId;

        await serviceSupabase
          .from('reservation_details')
          .update(resData)
          .eq('id', existingRes.id);
      }

      // Replace stays
      if (Array.isArray(body.stays)) {
        await serviceSupabase.from('reservation_stays').delete().eq('reservation_id', existingRes.id);

        if (body.stays.length > 0) {
          const stayRows = body.stays.map((s: unknown, i: number) => {
            const stay = isRecord(s) ? s : {};
            return {
              reservation_id: existingRes.id,
              sort_order: i,
              property_name: asStr(stay.property_name) || '',
              location_label: asStr(stay.location_label) || '',
              unit_or_room: asStr(stay.unit_or_room) || '',
              check_in_date: asStr(stay.check_in_date) || null,
              check_out_date: asStr(stay.check_out_date) || null,
              notes: asStr(stay.notes) || '',
            };
          });
          await serviceSupabase.from('reservation_stays').insert(stayRows);
        }
      }

      // Write change log
      await serviceSupabase.from('reservation_change_log').insert({
        reservation_id: existingRes.id,
        booking_uid: bookingUid,
        action: 'updated',
        actor_user_id: user.id,
        payload: { fields: Object.keys(body.reservation || {}), staysCount: body.stays?.length ?? null },
      });

      // Reload and return
      const record = await loadFullRecord({ serviceSupabase, bookingUid });
      await logBookingRequest({ supabase: serviceSupabase, endpoint, requestId, statusCode: 200, details: { reason: 'updated', bookingUid, slug } });

      return json(req, 200, { requestId, ...record });
    }

    return json(req, 405, { error: 'Method not allowed', requestId });
  } catch (error) {
    console.error(`${endpoint} error:`, error);
    const isCalError = error instanceof CalApiError;
    const statusCode = isCalError ? 502 : 500;
    const message = isCalError ? `Upstream calendar service error: ${error.message}` : (error instanceof Error ? error.message : 'Unknown error');
    try {
      await logBookingRequest({ supabase: serviceSupabase, endpoint, requestId, statusCode, details: { reason: isCalError ? 'cal_error' : 'unhandled_error', error: message } });
    } catch (logErr) { console.error('Failed to log:', logErr); }
    return json(req, statusCode, { error: message, requestId });
  }
});
