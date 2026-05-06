// Cal.com integration temporarily disabled — internal-only mode.
// Bookings are stored directly in reservation_details.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  BOOKING_TIMEZONE,
  createServiceRoleClient,
  getClientIp,
  getCorsHeaders,
  isDateKey,
  isOriginAllowed,
  json,
  logBookingRequest,
  sha256Hex,
  zonedDateTimeToUtcIso,
} from '../_shared/booking.ts';
import {
  buildAvailabilityForMonth,
  isStartAllowedByPolicy,
  isStartSelectionAvailable,
} from '../_shared/internal-availability.ts';

type CreateBookingBody = {
  slug?: string;
  date?: string;
  requestedHours?: number;
  startHour?: number | null;
  attendee?: { name?: string; email?: string; phoneNumber?: string };
  notes?: string;
};

const readRateLimitSettings = () => {
  const maxRequests = Number(Deno.env.get('BOOKING_RATE_LIMIT_MAX_REQUESTS') || '12');
  const windowMinutes = Number(Deno.env.get('BOOKING_RATE_LIMIT_WINDOW_MINUTES') || '60');
  const salt = Deno.env.get('BOOKING_RATE_LIMIT_SALT') || 'booking-rate-limit-default-salt';
  return {
    maxRequests: Number.isFinite(maxRequests) && maxRequests > 0 ? maxRequests : 12,
    windowMinutes: Number.isFinite(windowMinutes) && windowMinutes > 0 ? windowMinutes : 60,
    salt,
  };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: getCorsHeaders(req) });
  if (!isOriginAllowed(req)) return json(req, 403, { error: 'Origin not allowed' });
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed' });

  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  const serviceSupabase = createServiceRoleClient();
  const ipAddress = getClientIp(req);

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    await logBookingRequest({ supabase: serviceSupabase, endpoint: 'internal-booking-create', requestId, statusCode: 401, details: { reason: 'missing_auth_header' } });
    return json(req, 401, { error: 'Authorization header required', requestId });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await anonClient.auth.getUser();
  if (authError || !user) {
    await logBookingRequest({ supabase: serviceSupabase, endpoint: 'internal-booking-create', requestId, statusCode: 401, details: { reason: 'invalid_token' } });
    return json(req, 401, { error: 'Unauthorized', requestId });
  }

  try {
    let body: CreateBookingBody;
    try { body = (await req.json()) as CreateBookingBody; }
    catch { return json(req, 400, { error: 'Request body must be valid JSON', requestId }); }

    const slug = body.slug?.trim();
    const date = body.date?.trim();
    const requestedHours = Number(body.requestedHours);
    const startHour = body.startHour != null ? Number(body.startHour) : NaN;
    const attendeeName = body.attendee?.name?.trim();
    const attendeeEmail = body.attendee?.email?.trim().toLowerCase();
    const attendeePhone = body.attendee?.phoneNumber?.trim() || '';
    const notes = body.notes?.trim() || '';

    if (!slug || !date || !isDateKey(date)) {
      return json(req, 400, { error: 'slug and date (YYYY-MM-DD) are required', requestId });
    }
    if (!attendeeName || !attendeeEmail) {
      return json(req, 400, { error: 'attendee.name and attendee.email are required', requestId });
    }
    if (!isStartAllowedByPolicy(requestedHours, startHour)) {
      return json(req, 400, { error: 'requestedHours must be 3-8 and fit within 06:00-18:00', requestId });
    }
    const endHour = startHour + requestedHours;

    const { data: yacht, error: yachtError } = await serviceSupabase
      .from('yachts')
      .select('id,name,slug,booking_mode,booking_v2_live_from')
      .eq('slug', slug)
      .maybeSingle();
    if (yachtError) throw yachtError;
    if (!yacht) return json(req, 404, { error: 'Yacht not found', requestId });
    if (yacht.booking_mode !== 'policy_v2') {
      return json(req, 404, { error: 'Yacht is not eligible for internal booking', requestId });
    }
    if (yacht.booking_v2_live_from && date < yacht.booking_v2_live_from) {
      return json(req, 409, { error: 'Booking date is before this yacht go-live date', requestId });
    }

    // Rate limiting
    const rl = readRateLimitSettings();
    const since = new Date(Date.now() - rl.windowMinutes * 60_000).toISOString();
    const ipHash = await sha256Hex(`${rl.salt}:ip:${ipAddress}`);
    const emailHash = await sha256Hex(`${rl.salt}:email:${attendeeEmail}`);
    const [{ count: ipCount }, { count: emailCount }] = await Promise.all([
      serviceSupabase.from('booking_rate_limits').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since),
      serviceSupabase.from('booking_rate_limits').select('id', { count: 'exact', head: true }).eq('email_hash', emailHash).gte('created_at', since),
    ]);
    if ((ipCount || 0) >= rl.maxRequests || (emailCount || 0) >= rl.maxRequests) {
      return json(req, 429, { error: 'Too many booking attempts. Please try again later.', requestId });
    }
    await serviceSupabase.from('booking_rate_limits').insert({ ip_hash: ipHash, email_hash: emailHash, request_id: requestId });

    // Re-check availability against fresh internal data
    const availability = await buildAvailabilityForMonth({
      supabase: serviceSupabase,
      yachtSlug: yacht.slug,
      monthKey: date.slice(0, 7),
      timeZone: BOOKING_TIMEZONE,
      liveFromDate: yacht.booking_v2_live_from,
    });
    const day = availability.days[date];
    if (!day || !isStartSelectionAvailable(day, requestedHours, startHour)) {
      await logBookingRequest({ supabase: serviceSupabase, endpoint: 'internal-booking-create', requestId, statusCode: 409, details: { reason: 'slot_not_available', slug, date, requestedHours, startHour } });
      return json(req, 409, { error: 'Selected date/time is no longer available', requestId });
    }

    const startUtc = zonedDateTimeToUtcIso(date, startHour, 0, BOOKING_TIMEZONE);
    const endUtc = zonedDateTimeToUtcIso(date, endHour, 0, BOOKING_TIMEZONE);
    const bookingUid = `internal_${crypto.randomUUID()}`;

    // Create guest profile
    const { data: guest, error: guestErr } = await serviceSupabase
      .from('guest_profiles')
      .insert({
        full_name: attendeeName,
        email: attendeeEmail,
        phone: attendeePhone,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .single();
    if (guestErr) throw guestErr;

    const { data: reservation, error: insErr } = await serviceSupabase
      .from('reservation_details')
      .insert({
        booking_uid_current: bookingUid,
        yacht_slug: yacht.slug,
        yacht_name: yacht.name,
        start_at: startUtc,
        end_at: endUtc,
        status: 'booked',
        guest_profile_id: guest.id,
        source: 'internal_v2_no_cal',
        concierge_notes: notes,
        created_by: user.id,
        updated_by: user.id,
        created_by_email: user.email || '',
      })
      .select('id')
      .single();
    if (insErr) throw insErr;

    await serviceSupabase.from('reservation_change_log').insert({
      reservation_id: reservation.id,
      booking_uid: bookingUid,
      action: 'created',
      actor_user_id: user.id,
      payload: { date, startHour, requestedHours, source: 'internal_v2_no_cal' },
    });

    await logBookingRequest({
      supabase: serviceSupabase,
      endpoint: 'internal-booking-create',
      requestId,
      statusCode: 200,
      details: { slug, date, requestedHours, startHour, endHour, bookingUid, reservationId: reservation.id, userId: user.id },
    });

    return json(req, 200, {
      requestId,
      transactionId: bookingUid,
      bookingUid,
      status: 'booked',
    });
  } catch (error) {
    console.error('internal-booking-create error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    try {
      await logBookingRequest({ supabase: serviceSupabase, endpoint: 'internal-booking-create', requestId, statusCode: 500, details: { reason: 'unhandled_error', error: message } });
    } catch {}
    return json(req, 500, { error: message, requestId });
  }
});
