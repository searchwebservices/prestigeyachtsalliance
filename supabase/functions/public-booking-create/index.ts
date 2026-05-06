// Cal.com integration temporarily disabled — internal-only mode.
// Public bookings are written via the create_public_reservation RPC.

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
  verifyTurnstileToken,
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
  cfToken?: string | null;
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
  const supabase = createServiceRoleClient();
  const ipAddress = getClientIp(req);

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

    const { data: yacht, error: yachtError } = await supabase
      .from('yachts')
      .select('id,name,slug,booking_mode,booking_public_enabled,booking_v2_live_from')
      .eq('slug', slug)
      .maybeSingle();
    if (yachtError) throw yachtError;
    if (!yacht || !yacht.booking_public_enabled) {
      return json(req, 404, { error: 'Public booking page not found', requestId });
    }
    if (yacht.booking_mode !== 'policy_v2') {
      return json(req, 409, { error: 'Yacht is not ready for booking', requestId });
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
      supabase.from('booking_rate_limits').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since),
      supabase.from('booking_rate_limits').select('id', { count: 'exact', head: true }).eq('email_hash', emailHash).gte('created_at', since),
    ]);
    if ((ipCount || 0) >= rl.maxRequests || (emailCount || 0) >= rl.maxRequests) {
      return json(req, 429, { error: 'Too many booking attempts. Please try again later.', requestId });
    }
    await supabase.from('booking_rate_limits').insert({ ip_hash: ipHash, email_hash: emailHash, request_id: requestId });

    // Turnstile (kept for public)
    const turnstileResult = await verifyTurnstileToken({ token: body.cfToken || null, ip: ipAddress });
    if (!turnstileResult.success) {
      return json(req, 400, { error: turnstileResult.reason, requestId });
    }

    // Re-check availability
    const availability = await buildAvailabilityForMonth({
      supabase, yachtSlug: yacht.slug, monthKey: date.slice(0, 7),
      timeZone: BOOKING_TIMEZONE, liveFromDate: yacht.booking_v2_live_from,
    });
    const day = availability.days[date];
    if (!day || !isStartSelectionAvailable(day, requestedHours, startHour)) {
      return json(req, 409, { error: 'Selected date/time is no longer available', requestId });
    }

    const startUtc = zonedDateTimeToUtcIso(date, startHour, 0, BOOKING_TIMEZONE);
    const endUtc = zonedDateTimeToUtcIso(date, endHour, 0, BOOKING_TIMEZONE);

    const { data: rpcData, error: rpcErr } = await supabase.rpc('create_public_reservation', {
      p_yacht_slug: yacht.slug,
      p_yacht_name: yacht.name,
      p_start_at: startUtc,
      p_end_at: endUtc,
      p_attendee_name: attendeeName,
      p_attendee_email: attendeeEmail,
      p_attendee_phone: attendeePhone,
      p_notes: notes,
    });

    if (rpcErr) {
      const msg = rpcErr.message || '';
      if (/slot_unavailable/i.test(msg)) {
        return json(req, 409, { error: 'Selected date/time is no longer available', requestId });
      }
      throw rpcErr;
    }

    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    const bookingUid = row?.booking_uid || null;

    await logBookingRequest({
      supabase, endpoint: 'public-booking-create', requestId, statusCode: 200,
      details: { slug, date, requestedHours, startHour, endHour, bookingUid },
    });

    return json(req, 200, {
      requestId,
      transactionId: bookingUid || requestId,
      bookingUid,
      status: 'booked',
    });
  } catch (error) {
    console.error('public-booking-create error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    try {
      await logBookingRequest({ supabase, endpoint: 'public-booking-create', requestId, statusCode: 500, details: { reason: 'unhandled_error', error: message } });
    } catch {}
    return json(req, 500, { error: message, requestId });
  }
});
