// Cal.com integration temporarily disabled — internal-only mode.
// Reschedule updates reservation_details.start_at / end_at after re-validating availability.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  BOOKING_TIMEZONE,
  createServiceRoleClient,
  getCorsHeaders,
  isDateKey,
  isOriginAllowed,
  json,
  logBookingRequest,
  zonedDateTimeToUtcIso,
} from '../_shared/booking.ts';
import {
  buildAvailabilityForMonth,
  isStartAllowedByPolicy,
  isStartSelectionAvailable,
  loadReservationsForRange,
} from '../_shared/internal-availability.ts';

const ENDPOINT = 'internal-calendar-booking-reschedule';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: getCorsHeaders(req) });
  if (!isOriginAllowed(req)) return json(req, 403, { error: 'Origin not allowed' });
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed' });

  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  const serviceSupabase = createServiceRoleClient();

  const authHeader = req.headers.get('authorization');
  if (!authHeader) return json(req, 401, { error: 'Authorization header required', requestId });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await anonClient.auth.getUser();
  if (authError || !user) return json(req, 401, { error: 'Unauthorized', requestId });

  const { data: roleRow } = await serviceSupabase
    .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
  if (!roleRow) return json(req, 403, { error: 'Admin access required', requestId });

  try {
    let body: { slug?: string; bookingUid?: string; date?: string; requestedHours?: number; startHour?: number; reason?: string };
    try { body = await req.json(); }
    catch { return json(req, 400, { error: 'Request body must be valid JSON', requestId }); }

    const slug = body.slug?.trim();
    const bookingUid = body.bookingUid?.trim();
    const date = body.date?.trim();
    const requestedHours = Number(body.requestedHours);
    const startHour = Number(body.startHour);
    const reason = body.reason?.trim() || '';

    if (!slug || !bookingUid || !date || !isDateKey(date)) {
      return json(req, 400, { error: 'slug, bookingUid, and date (YYYY-MM-DD) are required', requestId });
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
    if (!yacht || yacht.booking_mode !== 'policy_v2') {
      return json(req, 404, { error: 'Yacht not found or not eligible', requestId });
    }

    const { data: existing } = await serviceSupabase
      .from('reservation_details')
      .select('id,booking_uid_history,start_at,end_at')
      .eq('booking_uid_current', bookingUid)
      .maybeSingle();
    if (!existing) return json(req, 404, { error: 'Booking not found', requestId });

    // Build availability ignoring the current booking
    const monthKey = date.slice(0, 7);
    // Custom availability: load all month reservations excluding this one
    const m = monthKey.split('-');
    const firstDk = `${m[0]}-${m[1]}-01`;
    const lastDay = new Date(Date.UTC(Number(m[0]), Number(m[1]), 0)).getUTCDate();
    const lastDk = `${m[0]}-${m[1]}-${String(lastDay).padStart(2,'0')}`;
    const startUtc = zonedDateTimeToUtcIso(firstDk, 0, 0, BOOKING_TIMEZONE);
    const endUtc = zonedDateTimeToUtcIso(lastDk, 23, 59, BOOKING_TIMEZONE);
    const reservations = await loadReservationsForRange({
      supabase: serviceSupabase, yachtSlug: yacht.slug,
      startUtcIso: startUtc, endUtcIso: endUtc, excludeBookingUid: bookingUid,
    });

    // Quick overlap check
    const newStart = new Date(zonedDateTimeToUtcIso(date, startHour, 0, BOOKING_TIMEZONE)).getTime();
    const newEnd = new Date(zonedDateTimeToUtcIso(date, endHour, 0, BOOKING_TIMEZONE)).getTime();
    const BUFFER_MS = 2 * 60 * 60 * 1000;
    const conflict = reservations.some((r) => {
      const rs = new Date(r.start_at).getTime() - BUFFER_MS;
      const re = new Date(r.end_at).getTime() + BUFFER_MS;
      return newStart < re && newEnd > rs;
    });
    if (conflict) {
      return json(req, 409, { error: 'Selected date/time is no longer available', requestId });
    }

    const newStartUtc = zonedDateTimeToUtcIso(date, startHour, 0, BOOKING_TIMEZONE);
    const newEndUtc = zonedDateTimeToUtcIso(date, endHour, 0, BOOKING_TIMEZONE);

    const history = Array.isArray(existing.booking_uid_history) ? [...existing.booking_uid_history] : [];
    if (!history.includes(bookingUid)) history.push(bookingUid);

    await serviceSupabase
      .from('reservation_details')
      .update({
        start_at: newStartUtc,
        end_at: newEndUtc,
        status: 'booked',
        booking_uid_history: history,
        updated_by: user.id,
      })
      .eq('id', existing.id);

    await serviceSupabase.from('reservation_change_log').insert({
      reservation_id: existing.id,
      booking_uid: bookingUid,
      action: 'rescheduled',
      actor_user_id: user.id,
      payload: { date, startHour, requestedHours, reason: reason || null, changeMode: 'internal_update' },
    });

    await logBookingRequest({
      supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode: 200,
      details: { reason: 'reschedule_success', bookingUid, slug, date, requestedHours, startHour, userId: user.id },
    });

    return json(req, 200, {
      requestId,
      changeMode: 'internal_update',
      bookingUid,
      previousBookingUid: bookingUid,
      status: 'rescheduled',
    });
  } catch (error) {
    console.error(`${ENDPOINT} error:`, error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    try {
      await logBookingRequest({ supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode: 500, details: { reason: 'unhandled_error', error: message } });
    } catch {}
    return json(req, 500, { error: message, requestId });
  }
});
