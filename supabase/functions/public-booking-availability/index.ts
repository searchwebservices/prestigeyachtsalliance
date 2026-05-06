// Cal.com integration temporarily disabled — internal-only mode.
// Public availability now reads from reservation_details, same as internal.

import {
  BOOKING_TIMEZONE,
  createServiceRoleClient,
  getCorsHeaders,
  getCurrentMonthKey,
  isOriginAllowed,
  json,
  logBookingRequest,
  parseMonthKey,
} from '../_shared/booking.ts';
import {
  buildAvailabilityForMonth,
  MAX_HOURS,
  MIN_HOURS,
  OPEN_END,
  OPEN_START,
} from '../_shared/internal-availability.ts';

const pad = (n: number) => String(n).padStart(2, '0');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: getCorsHeaders(req) });
  if (!isOriginAllowed(req)) return json(req, 403, { error: 'Origin not allowed' });

  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  const supabase = createServiceRoleClient();

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug')?.trim();
    const month = url.searchParams.get('month')?.trim() || getCurrentMonthKey(BOOKING_TIMEZONE);

    if (!slug) return json(req, 400, { error: 'slug is required', requestId });
    if (!parseMonthKey(month)) return json(req, 400, { error: 'month must be in YYYY-MM format', requestId });

    const { data: yacht, error: yachtError } = await supabase
      .from('yachts')
      .select('id,name,slug,vessel_type,capacity,booking_mode,booking_public_enabled,booking_v2_live_from')
      .eq('slug', slug)
      .maybeSingle();
    if (yachtError) throw yachtError;
    if (!yacht || !yacht.booking_public_enabled) {
      return json(req, 404, { error: 'Public booking page not found', requestId });
    }
    if (yacht.booking_mode !== 'policy_v2') {
      return json(req, 409, { error: 'Yacht is still configured for legacy booking mode', requestId });
    }

    const availability = await buildAvailabilityForMonth({
      supabase, yachtSlug: yacht.slug, monthKey: month,
      timeZone: BOOKING_TIMEZONE, liveFromDate: yacht.booking_v2_live_from,
    });

    const payload = {
      requestId,
      yacht: { id: yacht.id, name: yacht.name, slug: yacht.slug, vessel_type: yacht.vessel_type, capacity: yacht.capacity },
      month,
      timezone: BOOKING_TIMEZONE,
      constraints: {
        minHours: MIN_HOURS, maxHours: MAX_HOURS, timeStepMinutes: 60,
        operatingWindow: `${pad(OPEN_START)}:00-${pad(OPEN_END)}:00`,
        morningWindow: `${pad(OPEN_START)}:00-13:00`,
        bufferWindow: `13:00-15:00`,
        afternoonWindow: `15:00-${pad(OPEN_END)}:00`,
        policyVersion: 'v3-internal',
      },
      days: availability.days,
    };

    await logBookingRequest({ supabase, endpoint: 'public-booking-availability', requestId, statusCode: 200, details: { slug, month } });
    return json(req, 200, payload);
  } catch (error) {
    console.error('public-booking-availability error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    try {
      await logBookingRequest({ supabase, endpoint: 'public-booking-availability', requestId, statusCode: 500, details: { error: message } });
    } catch {}
    return json(req, 500, { error: message, requestId });
  }
});
