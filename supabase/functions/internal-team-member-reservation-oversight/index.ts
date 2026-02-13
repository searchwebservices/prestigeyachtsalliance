import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  createServiceRoleClient,
  getCorsHeaders,
  isOriginAllowed,
  json,
  logBookingRequest,
  isDateKey,
} from '../_shared/booking.ts';

const ENDPOINT = 'internal-team-member-reservation-oversight';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const asStr = (v: unknown): string | null => (typeof v === 'string' ? v : null);

// Completion score (same formula as reservation-details)
const computeCompletionScore = (
  guest: Record<string, unknown>,
  reservation: Record<string, unknown>,
  staysCount: number,
) => {
  const missing: string[] = [];
  let score = 0;

  const hasName = !!asStr(guest.full_name);
  const hasEmail = !!asStr(guest.email);
  const hasPhone = !!asStr(guest.phone) || !!asStr(guest.whatsapp);
  if (hasName && (hasEmail || hasPhone)) score += 20;
  else { if (!hasName) missing.push('guest_name'); if (!hasEmail && !hasPhone) missing.push('guest_contact'); }

  const hasGuestCount = reservation.guest_count != null && Number(reservation.guest_count) > 0;
  const hasAdultCount = reservation.adult_count != null;
  if (hasGuestCount && hasAdultCount) score += 20;
  else { if (!hasGuestCount) missing.push('guest_count'); if (!hasAdultCount) missing.push('adult_count'); }

  if (staysCount > 0) score += 20; else missing.push('accommodation');

  const hasDietary = !!asStr(reservation.dietary_notes);
  const hasAllergies = Array.isArray(reservation.allergies) && reservation.allergies.length > 0;
  const hasMobility = !!asStr(reservation.mobility_notes);
  if (hasDietary || hasAllergies || hasMobility) score += 20; else missing.push('guest_care');

  const hasConcierge = !!asStr(reservation.concierge_notes);
  const hasInternal = !!asStr(reservation.internal_notes);
  const hasOccasion = !!asStr(reservation.occasion_notes);
  if (hasConcierge || hasInternal || hasOccasion) score += 20; else missing.push('ops_notes');

  return { score, missing };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }
  if (!isOriginAllowed(req)) {
    return json(req, 403, { error: 'Origin not allowed' });
  }
  if (req.method !== 'GET') {
    return json(req, 405, { error: 'Method not allowed' });
  }

  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  const serviceSupabase = createServiceRoleClient();

  // Auth
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    await logBookingRequest({ supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode: 401, details: { reason: 'missing_auth_header' } });
    return json(req, 401, { error: 'Authorization header required', requestId });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await anonClient.auth.getUser();
  if (authError || !user) {
    await logBookingRequest({ supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode: 401, details: { reason: 'invalid_token' } });
    return json(req, 401, { error: 'Unauthorized', requestId });
  }

  // Admin only
  const { data: roleRow } = await serviceSupabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (!roleRow) {
    await logBookingRequest({ supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode: 403, details: { reason: 'forbidden_non_admin', userId: user.id } });
    return json(req, 403, { error: 'Admin access required', requestId });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId')?.trim();
    const from = url.searchParams.get('from')?.trim();
    const to = url.searchParams.get('to')?.trim();

    if (!userId || !from || !to || !isDateKey(from) || !isDateKey(to)) {
      await logBookingRequest({ supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode: 400, details: { reason: 'invalid_input', userId, from, to } });
      return json(req, 400, { error: 'userId, from (YYYY-MM-DD), and to (YYYY-MM-DD) are required', requestId });
    }

    // Query reservations where created_by or updated_by = userId in date range
    const fromTs = `${from}T00:00:00Z`;
    const toTs = `${to}T23:59:59Z`;

    const { data: reservations, error: resErr } = await serviceSupabase
      .from('reservation_details')
      .select('*, guest_profiles(*)')
      .or(`created_by.eq.${userId},updated_by.eq.${userId}`)
      .gte('start_at', fromTs)
      .lte('start_at', toTs)
      .order('start_at', { ascending: true });

    if (resErr) throw resErr;

    const records = [];
    for (const res of (reservations || [])) {
      const guest = isRecord(res.guest_profiles) ? res.guest_profiles : {};

      // Count stays
      const { count: staysCount } = await serviceSupabase
        .from('reservation_stays')
        .select('id', { count: 'exact', head: true })
        .eq('reservation_id', res.id);

      const { score, missing } = computeCompletionScore(guest, res as Record<string, unknown>, staysCount || 0);

      // Last action from change log
      const { data: lastLog } = await serviceSupabase
        .from('reservation_change_log')
        .select('action,created_at')
        .eq('reservation_id', res.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      records.push({
        reservationId: res.id,
        bookingUid: res.booking_uid_current,
        yachtSlug: res.yacht_slug,
        yachtName: res.yacht_name,
        startAt: res.start_at,
        endAt: res.end_at,
        status: res.status,
        guestName: asStr(guest.preferred_name) || asStr(guest.full_name) || '',
        completionScore: score,
        missingFields: missing,
        lastAction: lastLog?.action || null,
        lastActionAt: lastLog?.created_at || null,
        lastUpdatedAt: res.updated_at,
      });
    }

    await logBookingRequest({ supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode: 200, details: { userId, from, to, count: records.length } });

    return json(req, 200, { requestId, records });
  } catch (error) {
    console.error(`${ENDPOINT} error:`, error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    try {
      await logBookingRequest({ supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode: 500, details: { reason: 'unhandled_error', error: message } });
    } catch (logErr) { console.error('Failed to log:', logErr); }
    return json(req, 500, { error: message, requestId });
  }
});
