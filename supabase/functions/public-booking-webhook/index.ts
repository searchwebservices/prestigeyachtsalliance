import {
  createServiceRoleClient,
  getCorsHeaders,
  isOriginAllowed,
  json,
  logBookingRequest,
  verifyCalWebhookSignature,
} from '../_shared/booking.ts';

const WEBHOOK_SECRET_ENV_KEYS = ['CAL_WEBHOOK_SECRET', 'CAL_WEBHOOK_SIGNING_SECRET'] as const;

const getWebhookSecret = () => {
  for (const key of WEBHOOK_SECRET_ENV_KEYS) {
    const value = Deno.env.get(key);
    if (value) return value;
  }
  return null;
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

  try {
    const rawBody = await req.text();
    const secret = getWebhookSecret();

    if (secret) {
      const signature = req.headers.get('x-cal-signature-256');
      const isValid = await verifyCalWebhookSignature({
        secret,
        bodyText: rawBody,
        signatureHeader: signature,
      });

      if (!isValid) {
        await logBookingRequest({
          supabase,
          endpoint: 'public-booking-webhook',
          requestId,
          statusCode: 401,
          details: { reason: 'invalid_signature' },
        });
        return json(req, 401, { error: 'Invalid webhook signature', requestId });
      }
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const triggerEvent =
      (typeof payload.triggerEvent === 'string' && payload.triggerEvent) ||
      (typeof payload.event === 'string' && payload.event) ||
      null;

    const eventPayload =
      typeof payload.payload === 'object' && payload.payload !== null
        ? (payload.payload as Record<string, unknown>)
        : {};

    const bookingUid =
      (typeof eventPayload.uid === 'string' && eventPayload.uid) ||
      (typeof eventPayload.rescheduleUid === 'string' && eventPayload.rescheduleUid) ||
      null;

    const { error: insertError } = await supabase.from('booking_webhook_events').insert({
      event_type: triggerEvent,
      booking_uid: bookingUid,
      payload,
    });

    if (insertError) throw insertError;

    await logBookingRequest({
      supabase,
      endpoint: 'public-booking-webhook',
      requestId,
      statusCode: 200,
      details: {
        eventType: triggerEvent,
        bookingUid,
      },
    });

    return json(req, 200, { success: true, requestId });
  } catch (error) {
    console.error('public-booking-webhook error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    try {
      await logBookingRequest({
        supabase,
        endpoint: 'public-booking-webhook',
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

