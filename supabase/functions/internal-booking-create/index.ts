import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  BOOKING_POLICY_VERSION,
  BOOKING_TIMEZONE,
  BookingHalf,
  CalApiError,
  buildAvailabilityForMonth,
  calRequest,
  createServiceRoleClient,
  deriveShiftFit,
  deriveSegment,
  getCalApiConfig,
  getClientIp,
  getCorsHeaders,
  isDateKey,
  isOriginAllowed,
  isStartSelectionAvailable,
  json,
  logBookingRequest,
  resolveStartHourForCreate,
  sha256Hex,
  zonedDateTimeToUtcIso,
} from '../_shared/booking.ts';

type CreateBookingBody = {
  slug?: string;
  date?: string;
  requestedHours?: number;
  startHour?: number | null;
  half?: BookingHalf | null;
  attendee?: {
    name?: string;
    email?: string;
    phoneNumber?: string;
  };
  notes?: string;
};

const BOOKING_SOURCE = 'internal_book_v1';

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
  // Always handle OPTIONS first for CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  if (!isOriginAllowed(req)) {
    return json(req, 403, { error: 'Origin not allowed' });
  }

  if (req.method !== 'POST') {
    return json(req, 405, { error: 'Method not allowed' });
  }

  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  const serviceSupabase = createServiceRoleClient();
  const ipAddress = getClientIp(req);

  // ── Auth: require Supabase JWT ──
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    await logBookingRequest({
      supabase: serviceSupabase,
      endpoint: 'internal-booking-create',
      requestId,
      statusCode: 401,
      details: { reason: 'missing_auth_header' },
    });
    return json(req, 401, { error: 'Authorization header required', requestId });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await anonClient.auth.getUser();
  if (authError || !user) {
    await logBookingRequest({
      supabase: serviceSupabase,
      endpoint: 'internal-booking-create',
      requestId,
      statusCode: 401,
      details: { reason: 'invalid_token' },
    });
    return json(req, 401, { error: 'Unauthorized', requestId });
  }

  try {
    let body: CreateBookingBody;
    try {
      body = (await req.json()) as CreateBookingBody;
    } catch {
      await logBookingRequest({
        supabase: serviceSupabase,
        endpoint: 'internal-booking-create',
        requestId,
        statusCode: 400,
        details: { reason: 'invalid_json_body' },
      });
      return json(req, 400, { error: 'Request body must be valid JSON', requestId });
    }

    const slug = body.slug?.trim();
    const date = body.date?.trim();
    const requestedHours = Number(body.requestedHours);
    const startHourInput = body.startHour != null ? Number(body.startHour) : null;
    const half = body.half ?? null;
    const attendeeName = body.attendee?.name?.trim();
    const attendeeEmail = body.attendee?.email?.trim().toLowerCase();
    const attendeePhone = body.attendee?.phoneNumber?.trim();
    const notes = body.notes?.trim() || '';

    if (!slug || !date || !isDateKey(date)) {
      await logBookingRequest({
        supabase: serviceSupabase,
        endpoint: 'internal-booking-create',
        requestId,
        statusCode: 400,
        details: { reason: 'invalid_slug_or_date', slug, date },
      });
      return json(req, 400, { error: 'slug and date (YYYY-MM-DD) are required', requestId });
    }

    if (!attendeeName || !attendeeEmail) {
      await logBookingRequest({
        supabase: serviceSupabase,
        endpoint: 'internal-booking-create',
        requestId,
        statusCode: 400,
        details: { reason: 'missing_attendee' },
      });
      return json(req, 400, { error: 'attendee.name and attendee.email are required', requestId });
    }

    // V3: resolve start hour via policy
    const startResolution = resolveStartHourForCreate({
      startHour: startHourInput,
      half,
      requestedHours,
    });

    if (!startResolution.ok) {
      await logBookingRequest({
        supabase: serviceSupabase,
        endpoint: 'internal-booking-create',
        requestId,
        statusCode: 400,
        details: { reason: 'invalid_booking_rule', requestedHours, startHour: startHourInput, half },
      });
      return json(req, 400, { error: startResolution.message, requestId });
    }

    const { startHour, endHour, shiftFit, segment } = startResolution;

    // ── Yacht lookup (internal: ignore booking_public_enabled) ──
    const { data: yacht, error: yachtError } = await serviceSupabase
      .from('yachts')
      .select('id,name,slug,booking_mode,booking_public_enabled,booking_v2_live_from,cal_event_type_id')
      .eq('slug', slug)
      .maybeSingle();

    if (yachtError) throw yachtError;

    if (!yacht) {
      await logBookingRequest({
        supabase: serviceSupabase,
        endpoint: 'internal-booking-create',
        requestId,
        statusCode: 404,
        details: { reason: 'not_found', slug },
      });
      return json(req, 404, { error: 'Yacht not found', requestId });
    }

    if (yacht.booking_mode !== 'policy_v2' || !yacht.cal_event_type_id) {
      await logBookingRequest({
        supabase: serviceSupabase,
        endpoint: 'internal-booking-create',
        requestId,
        statusCode: 404,
        details: { reason: 'not_internally_eligible', slug },
      });
      return json(req, 404, { error: 'Yacht is not eligible for internal booking', requestId });
    }

    if (yacht.booking_v2_live_from && date < yacht.booking_v2_live_from) {
      await logBookingRequest({
        supabase: serviceSupabase,
        endpoint: 'internal-booking-create',
        requestId,
        statusCode: 409,
        details: { reason: 'before_go_live', slug, date, liveFrom: yacht.booking_v2_live_from },
      });
      return json(req, 409, { error: 'Booking date is before this yacht go-live date', requestId });
    }

    // ── Rate limiting ──
    const rateLimitSettings = readRateLimitSettings();
    const limiterSince = new Date(Date.now() - rateLimitSettings.windowMinutes * 60_000).toISOString();
    const ipHash = await sha256Hex(`${rateLimitSettings.salt}:ip:${ipAddress}`);
    const emailHash = await sha256Hex(`${rateLimitSettings.salt}:email:${attendeeEmail}`);

    const [{ count: ipCount, error: ipCountError }, { count: emailCount, error: emailCountError }] =
      await Promise.all([
        serviceSupabase
          .from('booking_rate_limits')
          .select('id', { count: 'exact', head: true })
          .eq('ip_hash', ipHash)
          .gte('created_at', limiterSince),
        serviceSupabase
          .from('booking_rate_limits')
          .select('id', { count: 'exact', head: true })
          .eq('email_hash', emailHash)
          .gte('created_at', limiterSince),
      ]);

    if (ipCountError) throw ipCountError;
    if (emailCountError) throw emailCountError;

    if ((ipCount || 0) >= rateLimitSettings.maxRequests || (emailCount || 0) >= rateLimitSettings.maxRequests) {
      await logBookingRequest({
        supabase: serviceSupabase,
        endpoint: 'internal-booking-create',
        requestId,
        statusCode: 429,
        details: { reason: 'rate_limited', slug, ipCount: ipCount || 0, emailCount: emailCount || 0 },
      });
      return json(req, 429, { error: 'Too many booking attempts. Please try again later.', requestId });
    }

    const { error: limiterInsertError } = await serviceSupabase.from('booking_rate_limits').insert({
      ip_hash: ipHash,
      email_hash: emailHash,
      request_id: requestId,
    });
    if (limiterInsertError) throw limiterInsertError;

    // ── No Turnstile for internal endpoints ──

    // ── Re-check availability server-side ──
    const availability = await buildAvailabilityForMonth({
      config: getCalApiConfig(),
      eventTypeId: yacht.cal_event_type_id,
      monthKey: date.slice(0, 7),
      timeZone: BOOKING_TIMEZONE,
      liveFromDate: yacht.booking_v2_live_from,
    });
    const selectedDay = availability.days[date];
    if (!selectedDay || !isStartSelectionAvailable(selectedDay, requestedHours, startHour)) {
      await logBookingRequest({
        supabase: serviceSupabase,
        endpoint: 'internal-booking-create',
        requestId,
        statusCode: 409,
        details: { reason: 'slot_not_available', slug, date, requestedHours, startHour },
      });
      return json(req, 409, { error: 'Selected date/time is no longer available', requestId });
    }

    // ── Create Cal.com booking ──
    const bookingStartUtc = zonedDateTimeToUtcIso(date, startHour, 0, BOOKING_TIMEZONE);
    const lengthInMinutes = requestedHours * 60;

    // Derive selected_half for legacy compat
    const selectedHalf = half || (segment === 'am' ? 'am' : segment === 'pm' ? 'pm' : '');

    const bookingPayload = await calRequest<{ data?: Record<string, unknown> }>({
      config: getCalApiConfig(),
      method: 'POST',
      path: '/v2/bookings',
      apiVersion: '2024-08-13',
      body: {
        start: bookingStartUtc,
        eventTypeId: yacht.cal_event_type_id,
        lengthInMinutes,
        attendee: {
          name: attendeeName,
          email: attendeeEmail,
          timeZone: BOOKING_TIMEZONE,
          ...(attendeePhone ? { phoneNumber: attendeePhone } : {}),
        },
        metadata: {
          policy_version: BOOKING_POLICY_VERSION,
          yacht_slug: yacht.slug,
          start_hour: String(startHour),
          end_hour: String(endHour),
          requested_hours: String(requestedHours),
          shift_fit: shiftFit,
          segment,
          selected_half: selectedHalf,
          timezone: BOOKING_TIMEZONE,
          source: BOOKING_SOURCE,
          booked_by_user_id: user.id,
          booked_by_email: user.email || '',
          ...(notes ? { notes } : {}),
        },
      },
    });

    const booking = bookingPayload.data || {};
    const bookingUid =
      (typeof booking.uid === 'string' && booking.uid) ||
      (typeof booking.id === 'number' ? String(booking.id) : null);
    const bookingStatus = (typeof booking.status === 'string' && booking.status) || 'accepted';
    const transactionId = bookingUid || requestId;

    await logBookingRequest({
      supabase: serviceSupabase,
      endpoint: 'internal-booking-create',
      requestId,
      statusCode: 200,
      details: {
        slug, date, requestedHours, startHour, endHour, shiftFit, segment,
        transactionId, bookingUid, bookingStatus,
        booked_by_user_id: user.id,
        booked_by_email: user.email,
      },
    });

    return json(req, 200, { requestId, transactionId, bookingUid, status: bookingStatus });
  } catch (error) {
    console.error('internal-booking-create error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (error instanceof CalApiError) {
      const isConflict =
        error.status === 409 ||
        (typeof message === 'string' && /not available|already booked|slot/i.test(message));

      try {
        await logBookingRequest({
          supabase: serviceSupabase,
          endpoint: 'internal-booking-create',
          requestId,
          statusCode: isConflict ? 409 : 502,
          details: { reason: isConflict ? 'cal_conflict' : 'cal_error', calStatus: error.status, error: message },
        });
      } catch (logError) {
        console.error('Failed to write booking request log:', logError);
      }

      if (isConflict) {
        return json(req, 409, { error: 'Selected date/time is no longer available', requestId });
      }
      return json(req, 502, { error: 'Upstream booking provider error', requestId });
    }

    try {
      await logBookingRequest({
        supabase: serviceSupabase,
        endpoint: 'internal-booking-create',
        requestId,
        statusCode: 500,
        details: { reason: 'unhandled_error', error: message },
      });
    } catch (logError) {
      console.error('Failed to write booking request log:', logError);
    }

    return json(req, 500, { error: message, requestId });
  }
});
