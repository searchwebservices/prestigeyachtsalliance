import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  BOOKING_POLICY_VERSION,
  BOOKING_TIMEZONE,
  CalApiError,
  buildAvailabilityForMonth,
  calRequest,
  checkProviderSlotAvailable,
  createServiceRoleClient,
  deriveShiftFit,
  deriveSegment,
  getCalApiConfig,
  getCorsHeaders,
  isDateKey,
  isOriginAllowed,
  isStartAllowedByPolicy,
  isStartSelectionAvailable,
  json,
  logBookingRequest,
  resolveStartHourForCreate,
  zonedDateTimeToUtcIso,
} from '../_shared/booking.ts';

const ENDPOINT = 'internal-calendar-booking-reschedule';
const BOOKING_SOURCE = 'internal_calendar_action_v1';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const asStr = (v: unknown): string | null => (typeof v === 'string' ? v : null);

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
  const serviceSupabase = createServiceRoleClient();

  // ── Auth ──
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

  // ── Admin check ──
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
    let body: { slug?: string; bookingUid?: string; date?: string; requestedHours?: number; startHour?: number; reason?: string };
    try {
      body = await req.json();
    } catch {
      await logBookingRequest({ supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode: 400, details: { reason: 'invalid_input' } });
      return json(req, 400, { error: 'Request body must be valid JSON', requestId });
    }

    const slug = body.slug?.trim();
    const bookingUid = body.bookingUid?.trim();
    const date = body.date?.trim();
    const requestedHours = Number(body.requestedHours);
    const startHourInput = Number(body.startHour);
    const reason = body.reason?.trim() || '';

    if (!slug || !bookingUid || !date || !isDateKey(date)) {
      await logBookingRequest({ supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode: 400, details: { reason: 'invalid_input', slug, bookingUid, date } });
      return json(req, 400, { error: 'slug, bookingUid, and date (YYYY-MM-DD) are required', requestId });
    }

    // ── V3 policy validation ──
    const startResolution = resolveStartHourForCreate({ startHour: startHourInput, requestedHours });
    if (!startResolution.ok) {
      await logBookingRequest({ supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode: 400, details: { reason: 'invalid_input', message: startResolution.message } });
      return json(req, 400, { error: startResolution.message, requestId });
    }

    const { startHour, endHour, shiftFit, segment } = startResolution;

    // ── Yacht eligibility ──
    const { data: yacht, error: yachtError } = await serviceSupabase
      .from('yachts')
      .select('id,name,slug,booking_mode,cal_event_type_id,booking_v2_live_from')
      .eq('slug', slug)
      .maybeSingle();

    if (yachtError) throw yachtError;

    if (!yacht || yacht.booking_mode !== 'policy_v2' || !yacht.cal_event_type_id) {
      await logBookingRequest({ supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode: 404, details: { reason: 'not_eligible', slug } });
      return json(req, 404, { error: 'Yacht not found or not eligible', requestId });
    }

    // ── Re-check server availability (policy cache) ──
    const calConfig = getCalApiConfig();
    const availability = await buildAvailabilityForMonth({
      config: calConfig,
      eventTypeId: yacht.cal_event_type_id,
      monthKey: date.slice(0, 7),
      timeZone: BOOKING_TIMEZONE,
      liveFromDate: yacht.booking_v2_live_from,
    });

    const selectedDay = availability.days[date];
    if (!selectedDay || !isStartSelectionAvailable(selectedDay, requestedHours, startHour)) {
      await logBookingRequest({ supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode: 409, details: { reason: 'slot_not_available_policy_cache', slug, date, requestedHours, startHour } });
      return json(req, 409, { error: 'Selected date/time is no longer available', requestId });
    }

    // ── Provider slot recheck ──
    const providerAvailable = await checkProviderSlotAvailable({
      config: calConfig,
      eventTypeId: yacht.cal_event_type_id,
      date,
      startHour,
      requestedHours,
      timeZone: BOOKING_TIMEZONE,
    });

    if (!providerAvailable) {
      await logBookingRequest({ supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode: 409, details: { reason: 'slot_not_available_provider', slug, date, requestedHours, startHour } });
      return json(req, 409, { error: 'Selected date/time is no longer available', requestId });
    }

    // ── Fetch existing booking from Cal ──
    let existingBooking: Record<string, unknown>;
    try {
      const result = await calRequest<{ data?: Record<string, unknown> }>({
        config: calConfig,
        method: 'GET',
        path: `/v2/bookings/${bookingUid}`,
        apiVersion: '2024-08-13',
      });
      if (!result.data || !isRecord(result.data)) {
        await logBookingRequest({ supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode: 404, details: { reason: 'invalid_input', bookingUid, note: 'booking_not_found_in_cal' } });
        return json(req, 404, { error: 'Booking not found', requestId });
      }
      existingBooking = result.data;
    } catch (err) {
      if (err instanceof CalApiError && err.status === 404) {
        await logBookingRequest({ supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode: 404, details: { reason: 'invalid_input', bookingUid, note: 'booking_not_found_in_cal' } });
        return json(req, 404, { error: 'Booking not found', requestId });
      }
      throw err;
    }

    // Derive original duration from existing booking
    const origStartIso = asStr(existingBooking.start) || asStr(existingBooking.startTime);
    const origEndIso = asStr(existingBooking.end) || asStr(existingBooking.endTime);
    let originalDurationMinutes = 0;
    if (origStartIso && origEndIso) {
      originalDurationMinutes = Math.round((new Date(origEndIso).getTime() - new Date(origStartIso).getTime()) / 60_000);
    }

    const newDurationMinutes = requestedHours * 60;
    const sameDuration = originalDurationMinutes === newDurationMinutes;

    // Extract attendee from original booking
    const attendees = Array.isArray(existingBooking.attendees) ? existingBooking.attendees : [];
    const firstAttendee = attendees.length > 0 && isRecord(attendees[0]) ? attendees[0] : null;
    const attendeeName = asStr(firstAttendee?.name) || 'Guest';
    const attendeeEmail = asStr(firstAttendee?.email) || '';
    const attendeePhone = asStr(firstAttendee?.phoneNumber) || asStr(firstAttendee?.phone) || '';

    const selectedHalf = segment === 'am' ? 'am' : segment === 'pm' ? 'pm' : '';
    const bookingStartUtc = zonedDateTimeToUtcIso(date, startHour, 0, BOOKING_TIMEZONE);

    let resultBookingUid: string | null = null;
    let changeMode: 'native_reschedule' | 'recreate_cancel';

    if (sameDuration) {
      // ── Native reschedule ──
      changeMode = 'native_reschedule';
      const rescheduleResult = await calRequest<{ data?: Record<string, unknown> }>({
        config: calConfig,
        method: 'POST',
        path: `/v2/bookings/${bookingUid}/reschedule`,
        apiVersion: '2024-08-13',
        body: {
          start: bookingStartUtc,
          ...(reason ? { reschedulingReason: reason } : {}),
        },
      });

      const rData = rescheduleResult.data || {};
      resultBookingUid = asStr(rData.uid) || asStr(rData.id ? String(rData.id) : null) || bookingUid;
    } else {
      // ── Recreate + cancel ──
      changeMode = 'recreate_cancel';

      // Create new booking
      const metadata: Record<string, string> = {
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
        previous_booking_uid: bookingUid,
      };
      if (reason) metadata.reschedule_reason = reason;

      const createResult = await calRequest<{ data?: Record<string, unknown> }>({
        config: calConfig,
        method: 'POST',
        path: '/v2/bookings',
        apiVersion: '2024-08-13',
        body: {
          start: bookingStartUtc,
          eventTypeId: yacht.cal_event_type_id,
          lengthInMinutes: newDurationMinutes,
          attendee: {
            name: attendeeName,
            email: attendeeEmail,
            timeZone: BOOKING_TIMEZONE,
            ...(attendeePhone ? { phoneNumber: attendeePhone } : {}),
          },
          metadata,
        },
      });

      const newBooking = createResult.data || {};
      resultBookingUid = asStr(newBooking.uid) || (typeof newBooking.id === 'number' ? String(newBooking.id) : null);

      // Cancel old booking
      try {
        await calRequest<unknown>({
          config: calConfig,
          method: 'POST',
          path: `/v2/bookings/${bookingUid}/cancel`,
          apiVersion: '2024-08-13',
          body: { cancellationReason: reason || 'Rescheduled with duration change' },
        });
      } catch (cancelErr) {
        // Log but don't fail – new booking already created
        console.error('Failed to cancel old booking after recreate:', cancelErr);
      }
    }

    await logBookingRequest({
      supabase: serviceSupabase,
      endpoint: ENDPOINT,
      requestId,
      statusCode: 200,
      details: {
        reason: changeMode === 'native_reschedule' ? 'reschedule_native_success' : 'reschedule_recreate_cancel_success',
        changeMode,
        bookingUid: resultBookingUid,
        previousBookingUid: bookingUid,
        slug,
        date,
        requestedHours,
        startHour,
        userId: user.id,
      },
    });

    return json(req, 200, {
      requestId,
      changeMode,
      bookingUid: resultBookingUid,
      previousBookingUid: bookingUid,
      status: 'rescheduled',
    });
  } catch (error) {
    console.error(`${ENDPOINT} error:`, error);
    const isCalError = error instanceof CalApiError;
    const statusCode = isCalError ? 502 : 500;
    const message = isCalError ? `Upstream calendar service error: ${error.message}` : (error instanceof Error ? error.message : 'Unknown error');

    try {
      await logBookingRequest({ supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode, details: { reason: isCalError ? 'cal_error' : 'unhandled_error', error: message, ...(isCalError ? { calStatus: (error as CalApiError).status } : {}) } });
    } catch (logErr) {
      console.error('Failed to log:', logErr);
    }

    return json(req, statusCode, { error: message, requestId });
  }
});
