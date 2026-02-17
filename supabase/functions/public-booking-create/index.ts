import {
  BOOKING_POLICY_VERSION,
  BOOKING_TIMEZONE,
  CalApiError,
  checkProviderSlotAvailable,
  BookingHalf,
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
  verifyTurnstileToken,
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
  cfToken?: string | null;
};

const BOOKING_SOURCE = 'prestigeyachtsalliance_public_booking_v3';


const normalizePhoneNumber = (value: string | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  let normalized = trimmed.replace(/[^\d+]/g, '');

  if (normalized.startsWith('00')) {
    normalized = `+${normalized.slice(2)}`;
  }

  if (!normalized.startsWith('+')) return null;

  const digitsOnly = normalized.slice(1);
  if (!/^\d{8,15}$/.test(digitsOnly)) return null;

  return `+${digitsOnly}`;
};

const normalizeCalErrorMessage = (error: CalApiError, fallback: string) => {
  if (typeof fallback === 'string' && fallback.trim()) return fallback;

  const payload = error.payload;
  if (payload && typeof payload === 'object') {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;

    const errorMessage = (payload as { error?: { message?: unknown } }).error?.message;
    if (typeof errorMessage === 'string' && errorMessage.trim()) return errorMessage;
  }

  return 'Booking provider rejected this request';
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
    const startHourInput = body.startHour != null ? Number(body.startHour) : null;
    const half = body.half ?? null;
    const attendeeName = body.attendee?.name?.trim();
    const attendeeEmail = body.attendee?.email?.trim().toLowerCase();
    const attendeePhoneRaw = body.attendee?.phoneNumber;
    const attendeePhone = normalizePhoneNumber(attendeePhoneRaw);
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

    // V3: resolve start hour via policy
    const startResolution = resolveStartHourForCreate({
      startHour: startHourInput,
      half,
      requestedHours,
    });

    if (!startResolution.ok) {
      await logBookingRequest({
        supabase,
        endpoint: 'public-booking-create',
        requestId,
        statusCode: 400,
        details: {
          reason: 'invalid_booking_rule',
          requestedHours,
          startHour: startHourInput,
          half,
        },
      });
      return json(req, 400, { error: startResolution.message, requestId });
    }

    const { startHour, endHour, shiftFit, segment } = startResolution;

    // ── Yacht lookup ──
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
      return json(req, 409, { error: 'Yacht is not ready for booking', requestId });
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

    // ── Rate limiting ──
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

    // ── Turnstile ──
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

    // ── Re-check availability server-side (policy cache) ──
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
        supabase,
        endpoint: 'public-booking-create',
        requestId,
        statusCode: 409,
        details: {
          reason: 'slot_not_available_policy_cache',
          slug,
          date,
          requestedHours,
          startHour,
        },
      });
      return json(req, 409, { error: 'Selected date/time is no longer available', requestId });
    }

    // ── Provider slot recheck for exact duration ──
    const calConfig = getCalApiConfig();
    const providerAvailable = await checkProviderSlotAvailable({
      config: calConfig,
      eventTypeId: yacht.cal_event_type_id,
      date,
      startHour,
      requestedHours,
      timeZone: BOOKING_TIMEZONE,
    });
    if (!providerAvailable) {
      await logBookingRequest({
        supabase,
        endpoint: 'public-booking-create',
        requestId,
        statusCode: 409,
        details: {
          reason: 'slot_not_available_provider',
          slug,
          date,
          requestedHours,
          startHour,
        },
      });
      return json(req, 409, { error: 'Selected date/time is no longer available', requestId });
    }

    // ── Create Cal.com booking ──
    const bookingStartUtc = zonedDateTimeToUtcIso(date, startHour, 0, BOOKING_TIMEZONE);
    const lengthInMinutes = requestedHours * 60;

    // Derive selected_half for legacy compat
    const selectedHalf = half || (segment === 'am' ? 'am' : segment === 'pm' ? 'pm' : '');

    const createBookingBodyBase = {
      start: bookingStartUtc,
      eventTypeId: yacht.cal_event_type_id,
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
        ...(notes ? { notes } : {}),
        ...(attendeePhoneRaw?.trim() && !attendeePhone ? { phone_number_ignored: 'invalid_format' } : {}),
      },
    };

    const createBooking = (body: Record<string, unknown>) =>
      calRequest<{ data?: Record<string, unknown> }>({
        config: getCalApiConfig(),
        method: 'POST',
        path: '/v2/bookings',
        apiVersion: '2024-08-13',
        body,
      });

    let bookingPayload: { data?: Record<string, unknown> };

    try {
      bookingPayload = await createBooking({
        ...createBookingBodyBase,
        lengthInMinutes,
      });
    } catch (error) {
      if (!(error instanceof CalApiError)) throw error;

      const providerMessage = normalizeCalErrorMessage(error, error.message);
      const shouldRetryWithoutLength =
        error.status === 400 &&
        /can't specify\s+'lengthInMinutes'\s+because event type does not have multiple possible lengths/i.test(
          providerMessage,
        );

      if (!shouldRetryWithoutLength) throw error;

      bookingPayload = await createBooking(createBookingBodyBase);
    }

    const booking = bookingPayload.data || {};
    const bookingUid =
      (typeof booking.uid === 'string' && booking.uid) ||
      (typeof booking.id === 'number' ? String(booking.id) : null);
    const bookingStatus =
      (typeof booking.status === 'string' && booking.status) || 'accepted';
    const transactionId = bookingUid || requestId;

    await logBookingRequest({
      supabase,
      endpoint: 'public-booking-create',
      requestId,
      statusCode: 200,
      details: {
        slug,
        date,
        requestedHours,
        startHour,
        endHour,
        shiftFit,
        segment,
        transactionId,
        bookingUid,
        bookingStatus,
      },
    });

    return json(req, 200, {
      requestId,
      transactionId,
      bookingUid,
      status: bookingStatus,
    });
  } catch (error) {
    console.error('public-booking-create error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    const errorStatus =
      error instanceof CalApiError
        ? error.status
        : typeof error === 'object' && error !== null && typeof (error as { status?: unknown }).status === 'number'
          ? (error as { status: number }).status
          : null;
    const errorPayload =
      error instanceof CalApiError
        ? error.payload
        : typeof error === 'object' && error !== null
          ? (error as { payload?: unknown }).payload ?? null
          : null;
    const isCalLikeError = error instanceof CalApiError || (errorStatus !== null && errorStatus >= 400);

    if (isCalLikeError && errorStatus !== null) {
      const providerMessage =
        error instanceof CalApiError
          ? normalizeCalErrorMessage(error, message)
          : typeof message === 'string' && message.trim()
            ? message
            : 'Booking provider rejected this request';

      const isConflict =
        errorStatus === 409 ||
        (typeof providerMessage === 'string' && /not available|already booked|slot/i.test(providerMessage));
      const isCalClientError = errorStatus >= 400 && errorStatus < 500;
      const isPhoneInvalid = /attendeephonenumber.*invalid_number/i.test(providerMessage);

      const responseStatusCode = isConflict ? 409 : isCalClientError ? 400 : 502;
      const reason = isConflict
        ? 'cal_conflict'
        : isPhoneInvalid
          ? 'cal_phone_invalid'
          : isCalClientError
            ? 'cal_client_error'
            : 'cal_error';

      try {
        await logBookingRequest({
          supabase,
          endpoint: 'public-booking-create',
          requestId,
          statusCode: responseStatusCode,
          details: {
            reason,
            calStatus: errorStatus,
            error: providerMessage,
            payload: errorPayload,
          },
        });
      } catch (logError) {
        console.error('Failed to write booking request log:', logError);
      }

      if (isConflict) {
        return json(req, 409, { error: 'Selected date/time is no longer available', requestId });
      }

      if (isCalClientError) {
        if (isPhoneInvalid) {
          return json(req, 400, {
            error: 'A valid attendee phone number is required by the booking provider (use international format, e.g. +521234567890).',
            requestId,
          });
        }

        return json(req, 400, {
          error: providerMessage,
          requestId,
        });
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
