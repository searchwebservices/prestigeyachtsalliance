import {
  BOOKING_POLICY_VERSION,
  BOOKING_TIMEZONE,
  CalApiError,
  BookingHalf,
  buildAvailabilityForMonth,
  calRequest,
  createServiceRoleClient,
  getCalApiConfig,
  getClientIp,
  getCorsHeaders,
  isDateKey,
  isOriginAllowed,
  isSelectionAvailable,
  json,
  logBookingRequest,
  resolveBookingBlock,
  sha256Hex,
  verifyTurnstileToken,
  zonedDateTimeToUtcIso,
} from '../_shared/booking.ts';

type CreateBookingBody = {
  slug?: string;
  date?: string;
  requestedHours?: number;
  half?: BookingHalf | null;
  attendee?: {
    name?: string;
    email?: string;
    phoneNumber?: string;
  };
  notes?: string;
  cfToken?: string | null;
};

const BOOKING_SOURCE = 'prestigeyachtsalliance_public_booking_v2';

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
  const supabase = createServiceRoleClient();
  const ipAddress = getClientIp(req);

  try {
    let body: CreateBookingBody;
    try {
      body = (await req.json()) as CreateBookingBody;
    } catch {
      await logBookingRequest({
        supabase,
        endpoint: 'public-booking-create',
        requestId,
        statusCode: 400,
        details: { reason: 'invalid_json_body' },
      });
      return json(req, 400, { error: 'Request body must be valid JSON', requestId });
    }

    const slug = body.slug?.trim();
    const date = body.date?.trim();
    const requestedHours = Number(body.requestedHours);
    const half = body.half ?? null;
    const attendeeName = body.attendee?.name?.trim();
    const attendeeEmail = body.attendee?.email?.trim().toLowerCase();
    const attendeePhone = body.attendee?.phoneNumber?.trim();
    const notes = body.notes?.trim() || '';

    if (!slug || !date || !isDateKey(date)) {
      await logBookingRequest({
        supabase,
        endpoint: 'public-booking-create',
        requestId,
        statusCode: 400,
        details: { reason: 'invalid_slug_or_date', slug, date },
      });
      return json(req, 400, { error: 'slug and date (YYYY-MM-DD) are required', requestId });
    }

    if (!attendeeName || !attendeeEmail) {
      await logBookingRequest({
        supabase,
        endpoint: 'public-booking-create',
        requestId,
        statusCode: 400,
        details: { reason: 'missing_attendee' },
      });
      return json(req, 400, { error: 'attendee.name and attendee.email are required', requestId });
    }

    const blockResolution = resolveBookingBlock({ requestedHours, half });
    if (!blockResolution.ok) {
      await logBookingRequest({
        supabase,
        endpoint: 'public-booking-create',
        requestId,
        statusCode: 400,
        details: {
          reason: 'invalid_booking_rule',
          requestedHours,
          half,
        },
      });
      return json(req, 400, { error: blockResolution.message, requestId });
    }

    const { data: yacht, error: yachtError } = await supabase
      .from('yachts')
      .select(
        'id,name,slug,booking_mode,booking_public_enabled,booking_v2_live_from,cal_event_type_id'
      )
      .eq('slug', slug)
      .maybeSingle();

    if (yachtError) throw yachtError;

    if (!yacht || !yacht.booking_public_enabled) {
      await logBookingRequest({
        supabase,
        endpoint: 'public-booking-create',
        requestId,
        statusCode: 404,
        details: { reason: 'not_found_or_public_disabled', slug },
      });
      return json(req, 404, { error: 'Public booking page not found', requestId });
    }

    if (yacht.booking_mode !== 'policy_v2' || !yacht.cal_event_type_id) {
      await logBookingRequest({
        supabase,
        endpoint: 'public-booking-create',
        requestId,
        statusCode: 409,
        details: { reason: 'invalid_yacht_mode_or_event_type', slug },
      });
      return json(req, 409, { error: 'Yacht is not ready for booking v2', requestId });
    }

    if (yacht.booking_v2_live_from && date < yacht.booking_v2_live_from) {
      await logBookingRequest({
        supabase,
        endpoint: 'public-booking-create',
        requestId,
        statusCode: 409,
        details: { reason: 'before_go_live', slug, date, liveFrom: yacht.booking_v2_live_from },
      });
      return json(req, 409, { error: 'Booking date is before this yacht go-live date', requestId });
    }

    const rateLimitSettings = readRateLimitSettings();
    const limiterSince = new Date(
      Date.now() - rateLimitSettings.windowMinutes * 60_000
    ).toISOString();
    const ipHash = await sha256Hex(`${rateLimitSettings.salt}:ip:${ipAddress}`);
    const emailHash = await sha256Hex(`${rateLimitSettings.salt}:email:${attendeeEmail}`);

    const [{ count: ipCount, error: ipCountError }, { count: emailCount, error: emailCountError }] =
      await Promise.all([
        supabase
          .from('booking_rate_limits')
          .select('id', { count: 'exact', head: true })
          .eq('ip_hash', ipHash)
          .gte('created_at', limiterSince),
        supabase
          .from('booking_rate_limits')
          .select('id', { count: 'exact', head: true })
          .eq('email_hash', emailHash)
          .gte('created_at', limiterSince),
      ]);

    if (ipCountError) throw ipCountError;
    if (emailCountError) throw emailCountError;

    if ((ipCount || 0) >= rateLimitSettings.maxRequests || (emailCount || 0) >= rateLimitSettings.maxRequests) {
      await logBookingRequest({
        supabase,
        endpoint: 'public-booking-create',
        requestId,
        statusCode: 429,
        details: {
          reason: 'rate_limited',
          slug,
          ipCount: ipCount || 0,
          emailCount: emailCount || 0,
          windowMinutes: rateLimitSettings.windowMinutes,
        },
      });
      return json(req, 429, {
        error: 'Too many booking attempts. Please try again later.',
        requestId,
      });
    }

    const { error: limiterInsertError } = await supabase.from('booking_rate_limits').insert({
      ip_hash: ipHash,
      email_hash: emailHash,
      request_id: requestId,
    });
    if (limiterInsertError) throw limiterInsertError;

    const turnstileResult = await verifyTurnstileToken({
      token: body.cfToken || null,
      ip: ipAddress,
    });
    if (!turnstileResult.success) {
      await logBookingRequest({
        supabase,
        endpoint: 'public-booking-create',
        requestId,
        statusCode: 400,
        details: { reason: 'turnstile_failed', slug },
      });
      return json(req, 400, { error: turnstileResult.reason, requestId });
    }

    // Re-check availability server-side right before booking create.
    const availability = await buildAvailabilityForMonth({
      config: getCalApiConfig(),
      eventTypeId: yacht.cal_event_type_id,
      monthKey: date.slice(0, 7),
      timeZone: BOOKING_TIMEZONE,
      liveFromDate: yacht.booking_v2_live_from,
    });
    const selectedDay = availability.days[date];
    if (!selectedDay || !isSelectionAvailable({ day: selectedDay, requestedHours, half })) {
      await logBookingRequest({
        supabase,
        endpoint: 'public-booking-create',
        requestId,
        statusCode: 409,
        details: {
          reason: 'slot_not_available',
          slug,
          date,
          requestedHours,
          half,
        },
      });
      return json(req, 409, { error: 'Selected date/segment is no longer available', requestId });
    }

    const bookingStartUtc = zonedDateTimeToUtcIso(
      date,
      blockResolution.startHour,
      0,
      BOOKING_TIMEZONE
    );

    const bookingPayload = await calRequest<{
      data?: Record<string, unknown>;
    }>({
      config: getCalApiConfig(),
      method: 'POST',
      path: '/v2/bookings',
      body: {
        start: bookingStartUtc,
        eventTypeId: yacht.cal_event_type_id,
        lengthInMinutes: blockResolution.blockMinutes,
        attendee: {
          name: attendeeName,
          email: attendeeEmail,
          timeZone: BOOKING_TIMEZONE,
          ...(attendeePhone ? { phoneNumber: attendeePhone } : {}),
        },
        metadata: {
          policy_version: BOOKING_POLICY_VERSION,
          yacht_slug: yacht.slug,
          block_scope: blockResolution.blockScope,
          requested_hours: String(requestedHours),
          timezone: BOOKING_TIMEZONE,
          source: BOOKING_SOURCE,
          ...(notes ? { notes } : {}),
        },
      },
    });

    const booking = bookingPayload.data || {};
    const bookingUid =
      (typeof booking.uid === 'string' && booking.uid) ||
      (typeof booking.id === 'number' ? String(booking.id) : null);
    const bookingStatus =
      (typeof booking.status === 'string' && booking.status) || 'accepted';

    await logBookingRequest({
      supabase,
      endpoint: 'public-booking-create',
      requestId,
      statusCode: 200,
      details: {
        slug,
        date,
        requestedHours,
        half,
        blockScope: blockResolution.blockScope,
        bookingUid,
        bookingStatus,
      },
    });

    return json(req, 200, {
      requestId,
      bookingUid,
      status: bookingStatus,
    });
  } catch (error) {
    console.error('public-booking-create error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (error instanceof CalApiError) {
      const isConflict =
        error.status === 409 ||
        (typeof message === 'string' &&
          /not available|already booked|slot/i.test(message));

      try {
        await logBookingRequest({
          supabase,
          endpoint: 'public-booking-create',
          requestId,
          statusCode: isConflict ? 409 : 502,
          details: {
            reason: isConflict ? 'cal_conflict' : 'cal_error',
            calStatus: error.status,
            error: message,
          },
        });
      } catch (logError) {
        console.error('Failed to write booking request log:', logError);
      }

      if (isConflict) {
        return json(req, 409, { error: 'Selected date/segment is no longer available', requestId });
      }
      return json(req, 502, { error: 'Upstream booking provider error', requestId });
    }

    try {
      await logBookingRequest({
        supabase,
        endpoint: 'public-booking-create',
        requestId,
        statusCode: 500,
        details: {
          reason: 'unhandled_error',
          error: message,
        },
      });
    } catch (logError) {
      console.error('Failed to write booking request log:', logError);
    }

    return json(req, 500, { error: message, requestId });
  }
});
