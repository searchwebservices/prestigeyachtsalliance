import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  CalApiError,
  calRequest,
  createServiceRoleClient,
  getCalApiConfig,
  getCorsHeaders,
  isOriginAllowed,
  json,
  logBookingRequest,
} from '../_shared/booking.ts';

const ENDPOINT = 'internal-calendar-booking-cancel';

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
    let body: { slug?: string; bookingUid?: string; reason?: string };
    try {
      body = await req.json();
    } catch {
      await logBookingRequest({ supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode: 400, details: { reason: 'invalid_input' } });
      return json(req, 400, { error: 'Request body must be valid JSON', requestId });
    }

    const slug = body.slug?.trim();
    const bookingUid = body.bookingUid?.trim();
    const reason = body.reason?.trim();

    if (!slug || !bookingUid || !reason) {
      await logBookingRequest({ supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode: 400, details: { reason: 'invalid_input', slug, bookingUid, hasReason: !!reason } });
      return json(req, 400, { error: 'slug, bookingUid, and reason are required', requestId });
    }

    // ── Yacht eligibility ──
    const { data: yacht, error: yachtError } = await serviceSupabase
      .from('yachts')
      .select('id,name,slug,booking_mode,cal_event_type_id')
      .eq('slug', slug)
      .maybeSingle();

    if (yachtError) throw yachtError;

    if (!yacht || yacht.booking_mode !== 'policy_v2' || !yacht.cal_event_type_id) {
      await logBookingRequest({ supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode: 404, details: { reason: 'not_eligible', slug } });
      return json(req, 404, { error: 'Yacht not found or not eligible', requestId });
    }

    // ── Cancel via Cal ──
    const calConfig = getCalApiConfig();

    try {
      await calRequest<unknown>({
        config: calConfig,
        method: 'POST',
        path: `/v2/bookings/${bookingUid}/cancel`,
        apiVersion: '2024-08-13',
        body: { cancellationReason: reason },
      });
    } catch (err) {
      if (err instanceof CalApiError) {
        // Treat 404 / already-cancelled as idempotent success
        const msg = String(err.message).toLowerCase();
        if (err.status === 404 || msg.includes('already cancelled') || msg.includes('already canceled')) {
          await logBookingRequest({ supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode: 200, details: { reason: 'cancel_success', bookingUid, note: 'already_cancelled_idempotent' } });
          return json(req, 200, { requestId, bookingUid, status: 'canceled' });
        }
        throw err;
      }
      throw err;
    }

    // ── Sync reservation_details ──
    const { data: existingRes } = await serviceSupabase
      .from('reservation_details')
      .select('id')
      .eq('booking_uid_current', bookingUid)
      .maybeSingle();

    if (existingRes) {
      await serviceSupabase
        .from('reservation_details')
        .update({ status: 'cancelled', updated_by: user.id })
        .eq('id', existingRes.id);

      await serviceSupabase.from('reservation_change_log').insert({
        reservation_id: existingRes.id,
        booking_uid: bookingUid,
        action: 'cancelled',
        actor_user_id: user.id,
        payload: { reason },
      });
    }

    await logBookingRequest({ supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode: 200, details: { reason: 'cancel_success', bookingUid, slug, cancelReason: reason, userId: user.id, reservationSynced: !!existingRes } });
    return json(req, 200, { requestId, bookingUid, status: 'canceled' });
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
