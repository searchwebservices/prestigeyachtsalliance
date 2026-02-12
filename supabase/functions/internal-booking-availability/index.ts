import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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

const pad = (n: number) => String(n).padStart(2, '0');

Deno.serve(async (req) => {
  // Always handle OPTIONS first for CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  if (!isOriginAllowed(req)) {
    return json(req, 403, { error: 'Origin not allowed' });
  }

  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  const serviceSupabase = createServiceRoleClient();

  // ── Auth: require Supabase JWT ──
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    await logBookingRequest({
      supabase: serviceSupabase,
      endpoint: 'internal-booking-availability',
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
      endpoint: 'internal-booking-availability',
      requestId,
      statusCode: 401,
      details: { reason: 'invalid_token' },
    });
    return json(req, 401, { error: 'Unauthorized', requestId });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug')?.trim();
    const month = url.searchParams.get('month')?.trim() || getCurrentMonthKey(BOOKING_TIMEZONE);

    if (!slug) {
      await logBookingRequest({
        supabase: serviceSupabase,
        endpoint: 'internal-booking-availability',
        requestId,
        statusCode: 400,
        details: { reason: 'missing_slug' },
      });
      return json(req, 400, { error: 'slug is required', requestId });
    }

    if (!parseMonthKey(month)) {
      await logBookingRequest({
        supabase: serviceSupabase,
        endpoint: 'internal-booking-availability',
        requestId,
        statusCode: 400,
        details: { reason: 'invalid_month', month },
      });
      return json(req, 400, { error: 'month must be in YYYY-MM format', requestId });
    }

    // Internal: ignore booking_public_enabled, require policy_v2 + cal_event_type_id
    const { data: yacht, error: yachtError } = await serviceSupabase
      .from('yachts')
      .select(
        'id,name,slug,vessel_type,capacity,booking_mode,booking_public_enabled,booking_v2_live_from,cal_event_type_id,cal_embed_url'
      )
      .eq('slug', slug)
      .maybeSingle();

    if (yachtError) throw yachtError;

    if (!yacht) {
      await logBookingRequest({
        supabase: serviceSupabase,
        endpoint: 'internal-booking-availability',
        requestId,
        statusCode: 404,
        details: { slug, reason: 'not_found' },
      });
      return json(req, 404, { error: 'Yacht not found', requestId });
    }

    if (yacht.booking_mode !== 'policy_v2' || !yacht.cal_event_type_id) {
      await logBookingRequest({
        supabase: serviceSupabase,
        endpoint: 'internal-booking-availability',
        requestId,
        statusCode: 404,
        details: { slug, reason: 'not_internally_eligible' },
      });
      return json(req, 404, { error: 'Yacht is not eligible for internal booking', requestId });
    }

    const availability = await buildAvailabilityForMonth({
      config: getCalApiConfig(),
      eventTypeId: yacht.cal_event_type_id,
      monthKey: month,
      timeZone: BOOKING_TIMEZONE,
      liveFromDate: yacht.booking_v2_live_from,
    });

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
      supabase: serviceSupabase,
      endpoint: 'internal-booking-availability',
      requestId,
      statusCode: 200,
      details: { slug, month, eventTypeId: yacht.cal_event_type_id, userId: user.id },
    });

    return json(req, 200, payload);
  } catch (error) {
    console.error('internal-booking-availability error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    try {
      await logBookingRequest({
        supabase: serviceSupabase,
        endpoint: 'internal-booking-availability',
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
