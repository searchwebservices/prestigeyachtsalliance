// Cal.com integration temporarily disabled — internal-only mode.
// Cancellation simply flips reservation_details.status to "cancelled".

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  createServiceRoleClient,
  getCorsHeaders,
  isOriginAllowed,
  json,
  logBookingRequest,
} from '../_shared/booking.ts';

const ENDPOINT = 'internal-calendar-booking-cancel';

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
    let body: { slug?: string; bookingUid?: string; reason?: string };
    try { body = await req.json(); }
    catch { return json(req, 400, { error: 'Request body must be valid JSON', requestId }); }

    const slug = body.slug?.trim();
    const bookingUid = body.bookingUid?.trim();
    const reason = body.reason?.trim();

    if (!slug || !bookingUid || !reason) {
      return json(req, 400, { error: 'slug, bookingUid, and reason are required', requestId });
    }

    const { data: existing } = await serviceSupabase
      .from('reservation_details')
      .select('id,status')
      .eq('booking_uid_current', bookingUid)
      .maybeSingle();

    if (!existing) {
      await logBookingRequest({ supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode: 200, details: { reason: 'cancel_idempotent_not_found', bookingUid } });
      return json(req, 200, { requestId, bookingUid, status: 'canceled' });
    }

    await serviceSupabase
      .from('reservation_details')
      .update({ status: 'cancelled', updated_by: user.id })
      .eq('id', existing.id);

    await serviceSupabase.from('reservation_change_log').insert({
      reservation_id: existing.id,
      booking_uid: bookingUid,
      action: 'cancelled',
      actor_user_id: user.id,
      payload: { reason },
    });

    await logBookingRequest({ supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode: 200, details: { reason: 'cancel_success', bookingUid, slug, cancelReason: reason, userId: user.id } });
    return json(req, 200, { requestId, bookingUid, status: 'canceled' });
  } catch (error) {
    console.error(`${ENDPOINT} error:`, error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    try {
      await logBookingRequest({ supabase: serviceSupabase, endpoint: ENDPOINT, requestId, statusCode: 500, details: { reason: 'unhandled_error', error: message } });
    } catch {}
    return json(req, 500, { error: message, requestId });
  }
});
