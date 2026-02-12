import {
  BOOKING_TIMEZONE,
  MAX_HOURS,
  MIN_HOURS,
  OPERATING_START,
  OPERATING_END,
  MORNING_START,
  MORNING_END,
  BUFFER_START,
  BUFFER_END,
  AFTERNOON_START,
  AFTERNOON_END,
  buildAvailabilityForMonth,
  createServiceRoleClient,
  getCalApiConfig,
  getCorsHeaders,
  getCurrentMonthKey,
  isOriginAllowed,
  json,
  logBookingRequest,
  parseMonthKey,
} from '../_shared/booking.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  if (!isOriginAllowed(req)) {
    return json(req, 403, { error: 'Origin not allowed' });
  }

  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  const supabase = createServiceRoleClient();

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug')?.trim();
    const month =
      url.searchParams.get('month')?.trim() || getCurrentMonthKey(BOOKING_TIMEZONE);

    if (!slug) {
      await logBookingRequest({
        supabase,
        endpoint: 'public-booking-availability',
        requestId,
        statusCode: 400,
        details: { reason: 'missing_slug' },
      });
      return json(req, 400, { error: 'slug is required', requestId });
    }

    if (!parseMonthKey(month)) {
      await logBookingRequest({
        supabase,
        endpoint: 'public-booking-availability',
        requestId,
        statusCode: 400,
        details: { reason: 'invalid_month', month },
      });
      return json(req, 400, { error: 'month must be in YYYY-MM format', requestId });
    }

    const { data: yacht, error: yachtError } = await supabase
      .from('yachts')
      .select(
        'id,name,slug,vessel_type,capacity,booking_mode,booking_public_enabled,booking_v2_live_from,cal_event_type_id,cal_embed_url'
      )
      .eq('slug', slug)
      .maybeSingle();

    if (yachtError) {
      throw yachtError;
    }

    if (!yacht || !yacht.booking_public_enabled) {
      await logBookingRequest({
        supabase,
        endpoint: 'public-booking-availability',
        requestId,
        statusCode: 404,
        details: { slug, reason: 'not_found_or_public_disabled' },
      });
      return json(req, 404, { error: 'Public booking page not found', requestId });
    }

    if (yacht.booking_mode !== 'policy_v2') {
      await logBookingRequest({
        supabase,
        endpoint: 'public-booking-availability',
        requestId,
        statusCode: 409,
        details: { slug, reason: 'legacy_mode' },
      });
      return json(req, 409, { error: 'Yacht is still configured for legacy booking mode', requestId });
    }

    if (!yacht.cal_event_type_id) {
      await logBookingRequest({
        supabase,
        endpoint: 'public-booking-availability',
        requestId,
        statusCode: 409,
        details: { slug, reason: 'missing_event_type_id' },
      });
      return json(req, 409, { error: 'Yacht is missing Cal.com event type configuration', requestId });
    }

    const availability = await buildAvailabilityForMonth({
      config: getCalApiConfig(),
      eventTypeId: yacht.cal_event_type_id,
      monthKey: month,
      timeZone: BOOKING_TIMEZONE,
      liveFromDate: yacht.booking_v2_live_from,
    });

    const pad = (n: number) => String(n).padStart(2, '0');

    const payload = {
      requestId,
      yacht: {
        id: yacht.id,
        name: yacht.name,
        slug: yacht.slug,
        vessel_type: yacht.vessel_type,
        capacity: yacht.capacity,
      },
      month,
      timezone: BOOKING_TIMEZONE,
      constraints: {
        minHours: MIN_HOURS,
        maxHours: MAX_HOURS,
        timeStepMinutes: 60,
        operatingWindow: `${pad(OPERATING_START)}:00-${pad(OPERATING_END)}:00`,
        morningWindow: `${pad(MORNING_START)}:00-${pad(MORNING_END)}:00`,
        bufferWindow: `${pad(BUFFER_START)}:00-${pad(BUFFER_END)}:00`,
        afternoonWindow: `${pad(AFTERNOON_START)}:00-${pad(AFTERNOON_END)}:00`,
        policyVersion: 'v3',
      },
      days: availability.days,
    };

    await logBookingRequest({
      supabase,
      endpoint: 'public-booking-availability',
      requestId,
      statusCode: 200,
      details: {
        slug,
        month,
        eventTypeId: yacht.cal_event_type_id,
      },
    });

    return json(req, 200, payload);
  } catch (error) {
    console.error('public-booking-availability error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    try {
      await logBookingRequest({
        supabase,
        endpoint: 'public-booking-availability',
        requestId,
        statusCode: 500,
        details: { error: message },
      });
    } catch (logError) {
      console.error('Failed to write booking request log:', logError);
    }

    return json(req, 500, { error: message, requestId });
  }
});
