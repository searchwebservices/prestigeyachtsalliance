// Cal.com integration temporarily disabled — internal-only mode.
// Calendar events are read directly from reservation_details.

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
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: getCorsHeaders(req) });
  if (!isOriginAllowed(req)) return json(req, 403, { error: 'Origin not allowed' });

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

  // Admin check
  const { data: roleRow } = await serviceSupabase
    .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
  if (!roleRow) return json(req, 403, { error: 'Admin access required', requestId });

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug')?.trim();
    const start = url.searchParams.get('start')?.trim();
    const end = url.searchParams.get('end')?.trim();
    const timezone = url.searchParams.get('timezone')?.trim() || BOOKING_TIMEZONE;

    if (!slug) return json(req, 400, { error: 'slug query parameter is required', requestId });
    if (!start || !isDateKey(start)) return json(req, 400, { error: 'start must be YYYY-MM-DD', requestId });
    if (!end || !isDateKey(end)) return json(req, 400, { error: 'end must be YYYY-MM-DD', requestId });

    const { data: yacht, error: yachtError } = await serviceSupabase
      .from('yachts')
      .select('id,name,slug,vessel_type,capacity,booking_mode')
      .eq('slug', slug)
      .maybeSingle();
    if (yachtError) throw yachtError;
    if (!yacht) return json(req, 404, { error: 'Yacht not found', requestId });
    if (yacht.booking_mode !== 'policy_v2') {
      return json(req, 404, { error: 'Yacht is not eligible for calendar view', requestId });
    }

    const startUtc = zonedDateTimeToUtcIso(start, 0, 0, timezone);
    const endUtc = zonedDateTimeToUtcIso(end, 23, 59, timezone);

    const { data: rows, error: rowsErr } = await serviceSupabase
      .from('reservation_details')
      .select('id,booking_uid_current,yacht_slug,yacht_name,start_at,end_at,status,concierge_notes,guest_profile_id,guest_profiles(full_name,email,phone)')
      .eq('yacht_slug', slug)
      .neq('status', 'cancelled')
      .lt('start_at', endUtc)
      .gt('end_at', startUtc)
      .order('start_at', { ascending: true });
    if (rowsErr) throw rowsErr;

    const events: NormalizedCalendarEvent[] = (rows || []).map((r: any) => {
      const guest = r.guest_profiles || null;
      return {
        id: r.id,
        bookingUid: r.booking_uid_current,
        title: r.yacht_name || yacht.name,
        startIso: r.start_at,
        endIso: r.end_at,
        status: (r.status || 'booked').toLowerCase(),
        yachtSlug: r.yacht_slug,
        yachtName: r.yacht_name || yacht.name,
        attendeeName: guest?.full_name || null,
        attendeeEmail: guest?.email || null,
        attendeePhone: guest?.phone || null,
        notes: r.concierge_notes || null,
      };
    });

    await logBookingRequest({
      supabase: serviceSupabase,
      endpoint: 'internal-calendar-bookings',
      requestId,
      statusCode: 200,
      details: { slug, start, end, timezone, userId: user.id, eventCount: events.length },
    });

    return json(req, 200, { requestId, timezone, slug, rangeStart: start, rangeEnd: end, events });
  } catch (error) {
    console.error('internal-calendar-bookings error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    try {
      await logBookingRequest({ supabase: serviceSupabase, endpoint: 'internal-calendar-bookings', requestId, statusCode: 500, details: { error: message } });
    } catch {}
    return json(req, 500, { error: message, requestId });
  }
});
