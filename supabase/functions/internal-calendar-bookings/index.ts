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
  zonedDateTimeToUtcIso,
  isDateKey,
} from '../_shared/booking.ts';

type CalBookingPayload = {
  data?: Record<string, unknown>[] | Record<string, unknown>;
  pagination?: {
    totalItems?: number;
    currentPage?: number;
    totalPages?: number;
  };
};

type NormalizedCalendarEvent = {
  id: string;
  bookingUid: string | null;
  title: string;
  startIso: string;
  endIso: string;
  status: string;
  yachtSlug: string;
  yachtName: string;
  attendeeName: string | null;
  attendeeEmail: string | null;
  attendeePhone: string | null;
  notes: string | null;
  calBookingUrl: string | null;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const asStr = (v: unknown): string | null => (typeof v === 'string' ? v : null);

const DEFAULT_CAL_API_VERSION_BOOKINGS = '2024-08-13';

const fetchBookingsForRange = async ({
  config,
  eventTypeId,
  startUtc,
  endUtc,
}: {
  config: ReturnType<typeof getCalApiConfig>;
  eventTypeId: number;
  startUtc: string;
  endUtc: string;
}) => {
  const statuses = ['upcoming', 'unconfirmed'] as const;
  const take = 250;
  const allBookings: Record<string, unknown>[] = [];

  for (const status of statuses) {
    let skip = 0;
    for (let page = 0; page < 8; page++) {
      const payload = await calRequest<CalBookingPayload>({
        config,
        method: 'GET',
        path: '/v2/bookings',
        searchParams: {
          status,
          eventTypeId,
          afterStart: startUtc,
          beforeEnd: endUtc,
          take,
          skip,
          sortStart: 'asc',
        },
        apiVersion: DEFAULT_CAL_API_VERSION_BOOKINGS,
      });

      const pageData = payload.data;
      const items = Array.isArray(pageData)
        ? pageData
        : isRecord(pageData) && Array.isArray(pageData.bookings)
          ? (pageData.bookings as Record<string, unknown>[])
          : [];

      allBookings.push(...items);
      if (items.length < take) break;
      skip += take;
    }
  }

  return allBookings;
};

const normalizeBooking = (
  booking: Record<string, unknown>,
  yachtSlug: string,
  yachtName: string,
): NormalizedCalendarEvent | null => {
  const id = asStr(booking.id) || asStr(booking.uid) || crypto.randomUUID();
  const bookingUid = asStr(booking.uid) || asStr(booking.id) || null;

  const startIso = asStr(booking.start) || asStr(booking.startTime) || null;
  const endIso = asStr(booking.end) || asStr(booking.endTime) || null;
  if (!startIso || !endIso) return null;

  const status = (asStr(booking.status) || 'booked').toLowerCase();

  // Title: prefer eventType title, fall back to yacht name
  const eventType = isRecord(booking.eventType) ? booking.eventType : null;
  const title = asStr(eventType?.title) || asStr(booking.title) || yachtName || 'Booking';

  // Attendee info
  const attendees = Array.isArray(booking.attendees) ? booking.attendees : [];
  const firstAttendee = attendees.length > 0 && isRecord(attendees[0]) ? attendees[0] : null;

  const attendeeName = asStr(firstAttendee?.name) || null;
  const attendeeEmail = asStr(firstAttendee?.email) || null;
  const attendeePhone =
    asStr(firstAttendee?.phoneNumber) ||
    asStr(firstAttendee?.phone) ||
    asStr(booking.smsReminderNumber) ||
    null;

  // Notes from responses or description
  let notes: string | null = null;
  if (Array.isArray(booking.responses)) {
    const noteResponse = booking.responses.find(
      (r: unknown) => isRecord(r) && (r.label === 'notes' || r.label === 'Notes'),
    );
    if (isRecord(noteResponse)) notes = asStr(noteResponse.value);
  } else if (isRecord(booking.responses) && booking.responses.notes) {
    notes = asStr(booking.responses.notes);
  }
  if (!notes) notes = asStr(booking.description) || null;

  // Cal booking URL
  const calBookingUrl = bookingUid
    ? `https://app.cal.com/booking/${bookingUid}`
    : null;

  return {
    id: String(id),
    bookingUid,
    title,
    startIso,
    endIso,
    status,
    yachtSlug,
    yachtName,
    attendeeName,
    attendeeEmail,
    attendeePhone,
    notes,
    calBookingUrl,
  };
};

Deno.serve(async (req) => {
  // OPTIONS first for CORS
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
      endpoint: 'internal-calendar-bookings',
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
      endpoint: 'internal-calendar-bookings',
      requestId,
      statusCode: 401,
      details: { reason: 'invalid_token' },
    });
    return json(req, 401, { error: 'Unauthorized', requestId });
  }

  // ── Admin role check ──
  const { data: roleRow } = await serviceSupabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (!roleRow) {
    await logBookingRequest({
      supabase: serviceSupabase,
      endpoint: 'internal-calendar-bookings',
      requestId,
      statusCode: 403,
      details: { reason: 'forbidden_non_admin', userId: user.id },
    });
    return json(req, 403, { error: 'Admin access required', requestId });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug')?.trim();
    const start = url.searchParams.get('start')?.trim();
    const end = url.searchParams.get('end')?.trim();
    const timezone = url.searchParams.get('timezone')?.trim() || BOOKING_TIMEZONE;

    // Validate required params
    if (!slug) {
      await logBookingRequest({
        supabase: serviceSupabase,
        endpoint: 'internal-calendar-bookings',
        requestId,
        statusCode: 400,
        details: { reason: 'missing_slug' },
      });
      return json(req, 400, { error: 'slug query parameter is required', requestId });
    }

    if (!start || !isDateKey(start)) {
      await logBookingRequest({
        supabase: serviceSupabase,
        endpoint: 'internal-calendar-bookings',
        requestId,
        statusCode: 400,
        details: { reason: 'invalid_start', start },
      });
      return json(req, 400, { error: 'start must be YYYY-MM-DD', requestId });
    }

    if (!end || !isDateKey(end)) {
      await logBookingRequest({
        supabase: serviceSupabase,
        endpoint: 'internal-calendar-bookings',
        requestId,
        statusCode: 400,
        details: { reason: 'invalid_end', end },
      });
      return json(req, 400, { error: 'end must be YYYY-MM-DD', requestId });
    }

    // Lookup yacht: internal eligibility = policy_v2 + cal_event_type_id (ignore booking_public_enabled)
    const { data: yacht, error: yachtError } = await serviceSupabase
      .from('yachts')
      .select('id,name,slug,vessel_type,capacity,booking_mode,cal_event_type_id')
      .eq('slug', slug)
      .maybeSingle();

    if (yachtError) throw yachtError;

    if (!yacht) {
      await logBookingRequest({
        supabase: serviceSupabase,
        endpoint: 'internal-calendar-bookings',
        requestId,
        statusCode: 404,
        details: { slug, reason: 'not_found' },
      });
      return json(req, 404, { error: 'Yacht not found', requestId });
    }

    if (yacht.booking_mode !== 'policy_v2' || !yacht.cal_event_type_id) {
      await logBookingRequest({
        supabase: serviceSupabase,
        endpoint: 'internal-calendar-bookings',
        requestId,
        statusCode: 404,
        details: { slug, reason: 'not_eligible' },
      });
      return json(req, 404, { error: 'Yacht is not eligible for calendar view', requestId });
    }

    // Build UTC range from start/end dates in the given timezone
    const startUtc = zonedDateTimeToUtcIso(start, 0, 0, timezone);
    const endUtc = zonedDateTimeToUtcIso(end, 23, 59, timezone);

    const calConfig = getCalApiConfig();

    const rawBookings = await fetchBookingsForRange({
      config: calConfig,
      eventTypeId: yacht.cal_event_type_id,
      startUtc,
      endUtc,
    });

    const events: NormalizedCalendarEvent[] = [];
    for (const booking of rawBookings) {
      const normalized = normalizeBooking(booking, yacht.slug, yacht.name);
      if (normalized) events.push(normalized);
    }

    // Sort by start time
    events.sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime());

    const payload = {
      requestId,
      timezone,
      slug: yacht.slug,
      rangeStart: start,
      rangeEnd: end,
      events,
    };

    await logBookingRequest({
      supabase: serviceSupabase,
      endpoint: 'internal-calendar-bookings',
      requestId,
      statusCode: 200,
      details: {
        slug,
        start,
        end,
        timezone,
        eventTypeId: yacht.cal_event_type_id,
        userId: user.id,
        eventCount: events.length,
      },
    });

    return json(req, 200, payload);
  } catch (error) {
    console.error('internal-calendar-bookings error:', error);

    const isCalError = error instanceof CalApiError;
    const statusCode = isCalError ? 502 : 500;
    const message = isCalError
      ? `Upstream calendar service error: ${error.message}`
      : error instanceof Error
        ? error.message
        : 'Unknown error';

    try {
      await logBookingRequest({
        supabase: serviceSupabase,
        endpoint: 'internal-calendar-bookings',
        requestId,
        statusCode,
        details: {
          error: message,
          ...(isCalError ? { calStatus: (error as CalApiError).status } : {}),
        },
      });
    } catch (logError) {
      console.error('Failed to write booking request log:', logError);
    }

    return json(req, statusCode, { error: message, requestId });
  }
});
