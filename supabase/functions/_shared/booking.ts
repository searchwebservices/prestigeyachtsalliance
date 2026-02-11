import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const BOOKING_POLICY_VERSION = 'v2';
export const BOOKING_TIMEZONE = 'America/Mazatlan';
export const MIN_HOURS = 3;
export const MAX_HOURS = 8;
export const PM_MAX_HOURS = 6;

export type DayState = 'available' | 'booked' | 'closed';
export type BookingHalf = 'am' | 'pm';
export type BlockScope = 'HALF_AM' | 'HALF_PM' | 'FULL_DAY';

export type DayAvailability = {
  am: DayState;
  pm: DayState;
  fullOpen: boolean;
};

export type YachtBookingConfig = {
  id: string;
  name: string;
  slug: string;
  vessel_type: string;
  capacity: number;
  booking_mode: string;
  booking_public_enabled: boolean;
  booking_v2_live_from: string | null;
  cal_event_type_id: number | null;
  cal_embed_url: string | null;
};

export const BLOCK_DURATIONS: Record<BlockScope, number> = {
  HALF_AM: 240,
  HALF_PM: 360,
  FULL_DAY: 480,
};

export type CalApiConfig = {
  baseUrl: string;
  apiKey: string;
};

export class CalApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'CalApiError';
    this.status = status;
    this.payload = payload;
  }
}

const CORS_ALLOWED_HEADERS = 'authorization, x-client-info, apikey, content-type, x-request-id';
const CORS_ALLOWED_METHODS = 'GET,POST,OPTIONS';
const DEFAULT_CAL_API_VERSION = '2024-08-13';

const toTrimmed = (value: string) => value.trim();

const getAllowedOrigins = () =>
  (Deno.env.get('BOOKING_ALLOWED_ORIGINS') || '')
    .split(',')
    .map(toTrimmed)
    .filter(Boolean);

export const isOriginAllowed = (req: Request) => {
  const origin = req.headers.get('origin');
  const allowedOrigins = getAllowedOrigins();

  if (!origin) return true;
  if (allowedOrigins.length === 0) return true;
  return allowedOrigins.includes(origin);
};

export const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get('origin');
  const allowedOrigins = getAllowedOrigins();

  const allowOrigin =
    !origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin) ? origin ?? '*' : 'null';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': CORS_ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': CORS_ALLOWED_METHODS,
    Vary: 'Origin',
  };
};

export const json = (req: Request, status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...getCorsHeaders(req),
      'Content-Type': 'application/json',
    },
  });

export const createServiceRoleClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, serviceRoleKey);
};

export const getCalApiConfig = (): CalApiConfig => {
  const baseUrl = Deno.env.get('CAL_API_BASE_URL') || '';
  const apiKey = Deno.env.get('CAL_API_KEY') || '';

  if (!baseUrl || !apiKey) {
    throw new Error('Missing CAL_API_BASE_URL or CAL_API_KEY');
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiKey,
  };
};

const pad2 = (value: number) => String(value).padStart(2, '0');

const isNumberString = (value: string) => /^\d+$/.test(value);

export const parseMonthKey = (value: string) => {
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  const [yearRaw, monthRaw] = value.split('-');
  if (!isNumberString(yearRaw) || !isNumberString(monthRaw)) return null;

  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;

  return { year, month };
};

export const isDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export const getCurrentMonthKey = (timeZone: string) => {
  const parts = toTimeZoneParts(new Date().toISOString(), timeZone);
  return `${parts.year}-${parts.month}`;
};

export const getDaysInMonth = (year: number, month: number) => {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
};

const parseOffsetInMinutes = (timeZoneName: string | undefined) => {
  if (!timeZoneName) return 0;

  const match = timeZoneName.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/i);
  if (!match) return 0;

  const hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  const sign = hours < 0 ? -1 : 1;

  return hours * 60 + sign * minutes;
};

const getOffsetMinutes = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  });
  const part = formatter.formatToParts(date).find((piece) => piece.type === 'timeZoneName');
  return parseOffsetInMinutes(part?.value);
};

export const zonedDateTimeToUtcIso = (
  dateKey: string,
  hour: number,
  minute: number,
  timeZone: string
) => {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const localAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  const firstOffset = getOffsetMinutes(new Date(localAsUtcMs), timeZone);
  let utcMs = localAsUtcMs - firstOffset * 60_000;

  const secondOffset = getOffsetMinutes(new Date(utcMs), timeZone);
  if (secondOffset !== firstOffset) {
    utcMs = localAsUtcMs - secondOffset * 60_000;
  }

  return new Date(utcMs).toISOString();
};

export const toTimeZoneParts = (isoString: string, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date(isoString));
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    if (part.type === 'literal') continue;
    partMap[part.type] = part.value;
  }

  const hourRaw = Number(partMap.hour);
  const hour = hourRaw === 24 ? 0 : hourRaw;

  return {
    year: partMap.year,
    month: partMap.month,
    day: partMap.day,
    dateKey: `${partMap.year}-${partMap.month}-${partMap.day}`,
    hour,
    minute: Number(partMap.minute),
  };
};

export const getMonthUtcRange = (monthKey: string, timeZone: string) => {
  const month = parseMonthKey(monthKey);
  if (!month) return null;

  const monthStart = `${month.year}-${pad2(month.month)}-01`;
  const monthEnd = `${month.year}-${pad2(month.month)}-${pad2(getDaysInMonth(month.year, month.month))}`;

  return {
    monthStart,
    monthEnd,
    startUtc: zonedDateTimeToUtcIso(monthStart, 0, 0, timeZone),
    endUtc: zonedDateTimeToUtcIso(monthEnd, 23, 59, timeZone),
  };
};

const DEFAULT_CAL_API_VERSION_BOOKINGS = '2024-08-13';
const DEFAULT_CAL_API_VERSION_SLOTS = '2024-09-04';

const makeCalHeaders = (_config: CalApiConfig, apiVersion?: string) => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${_config.apiKey}`,
    'cal-api-version': apiVersion || Deno.env.get('CAL_API_VERSION') || DEFAULT_CAL_API_VERSION_BOOKINGS,
    'Content-Type': 'application/json',
  };

  // Only include platform credentials when explicitly provided.
  const calClientId = Deno.env.get('CAL_PLATFORM_CLIENT_ID');
  const calSecretKey = Deno.env.get('CAL_PLATFORM_SECRET_KEY');
  if (calClientId && calSecretKey) {
    headers['x-cal-client-id'] = calClientId;
    headers['x-cal-secret-key'] = calSecretKey;
  }

  return headers;
};

export const calRequest = async <T>({
  config,
  method,
  path,
  searchParams,
  body,
  apiVersion,
}: {
  config: CalApiConfig;
  method: 'GET' | 'POST';
  path: string;
  searchParams?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  apiVersion?: string;
}) => {
  const url = new URL(`${config.baseUrl}${path}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === null || value === undefined || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method,
    headers: makeCalHeaders(config, apiVersion),
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      (payload as { error?: { message?: string }; message?: string } | null)?.error?.message ||
      (payload as { message?: string } | null)?.message ||
      `Cal API request failed (${response.status})`;

    throw new CalApiError(message, response.status, payload);
  }

  return payload as T;
};

type SlotRecord = { time?: string; start?: string } | string;

type CalSlotsPayload = {
  data?: Record<string, SlotRecord[]> | { slots?: Record<string, SlotRecord[]> };
};

type CalBookingPayload = {
  data?: Record<string, unknown>[] | Record<string, unknown>;
  pagination?: {
    totalItems?: number;
    currentPage?: number;
    totalPages?: number;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown) => (typeof value === 'string' ? value : null);

const getBookingStatus = (booking: Record<string, unknown>) => {
  const status = asString(booking.status) || '';
  return status.toLowerCase();
};

const isBlockingBookingStatus = (status: string) => ['accepted', 'pending', 'unconfirmed'].includes(status);

const inferBlockScope = ({
  startIso,
  endIso,
  timeZone,
}: {
  startIso: string;
  endIso: string;
  timeZone: string;
}): BlockScope => {
  const durationMinutes = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000);
  if (durationMinutes >= BLOCK_DURATIONS.FULL_DAY) return 'FULL_DAY';

  const localStart = toTimeZoneParts(startIso, timeZone);
  if (localStart.hour >= 13) return 'HALF_PM';
  return 'HALF_AM';
};

const getSlotIso = (slot: SlotRecord) => {
  if (typeof slot === 'string') return slot;
  if (typeof slot.start === 'string') return slot.start;
  if (typeof slot.time === 'string') return slot.time;
  return null;
};

type OpenState = { am: boolean; pm: boolean; full: boolean };

const createOpenState = (): OpenState => ({ am: false, pm: false, full: false });

const getOrCreate = <T>(map: Map<string, T>, key: string, create: () => T) => {
  const existing = map.get(key);
  if (existing) return existing;
  const next = create();
  map.set(key, next);
  return next;
};

const normalizeBlockScope = (scope: string | null): BlockScope | null => {
  if (scope === 'HALF_AM' || scope === 'HALF_PM' || scope === 'FULL_DAY') return scope;
  return null;
};

const getSlotsMap = (payload: CalSlotsPayload): Record<string, SlotRecord[]> => {
  const data = payload.data;
  if (!data || !isRecord(data)) return {};

  // Newer shape: { data: { "2026-02-11": [{ start: ... }] } }
  const directDayEntries = Object.entries(data).filter(([, value]) => Array.isArray(value));
  if (directDayEntries.length > 0) {
    return Object.fromEntries(directDayEntries) as Record<string, SlotRecord[]>;
  }

  // Legacy shape: { data: { slots: { "2026-02-11": [...] } } }
  const slots = (data as { slots?: unknown }).slots;
  if (!slots || !isRecord(slots)) return {};

  const slotEntries = Object.entries(slots).filter(([, value]) => Array.isArray(value));
  return Object.fromEntries(slotEntries) as Record<string, SlotRecord[]>;
};

/**
 * Fetch available time-slots from Cal.com using a 60-minute probe duration,
 * then derive AM / PM / Full-day availability from the returned hourly slots.
 *
 * Cal.com spaces slots by duration (non-overlapping), so querying with the
 * actual block durations (240, 360, 480) produces very few start times
 * and misses valid PM starts entirely. Using duration=60 gives us every
 * available hour, from which we can reliably check window coverage.
 *
 * AM  (08-12, 240 min): requires slot at 08:00
 * PM  (13-19, 360 min): requires slot at 13:00
 * Full (08-16, 480 min): requires slots at 08:00 AND 13:00
 *   (we check both anchors; Cal.com enforces the rest via its own schedule)
 */
const fetchSlotsOpenMap = async ({
  config,
  eventTypeId,
  monthRange,
  timeZone,
}: {
  config: CalApiConfig;
  eventTypeId: number;
  monthRange: { startUtc: string; endUtc: string };
  timeZone: string;
}) => {
  const openMap = new Map<string, OpenState>();

  // Single query with duration=60 to get all available hourly slots.
  const payload = await calRequest<CalSlotsPayload>({
    config,
    method: 'GET',
    path: '/v2/slots',
    searchParams: {
      eventTypeId,
      start: monthRange.startUtc,
      end: monthRange.endUtc,
      timeZone,
      duration: 60,
    },
    apiVersion: DEFAULT_CAL_API_VERSION_SLOTS,
  });

  const slotMap = getSlotsMap(payload);

  // Build a set of available hours per date-key.
  const hoursPerDay = new Map<string, Set<number>>();

  for (const slots of Object.values(slotMap)) {
    for (const slot of slots) {
      const iso = getSlotIso(slot);
      if (!iso) continue;

      const local = toTimeZoneParts(iso, timeZone);
      if (local.minute !== 0) continue; // only full-hour slots

      const hours = getOrCreate(hoursPerDay, local.dateKey, () => new Set<number>());
      hours.add(local.hour);
    }
  }

  for (const [dateKey, hours] of hoursPerDay) {
    const day = getOrCreate(openMap, dateKey, createOpenState);

    // AM block starts at 08:00 (240 min → 08-12). Check anchor hour.
    day.am = hours.has(8);

    // PM block starts at 13:00 (360 min → 13-19). Check anchor hour.
    day.pm = hours.has(13);

    // Full-day block starts at 08:00 (480 min → 08-16). Both halves must be open.
    day.full = hours.has(8) && hours.has(13);
  }

  return openMap;
};

const fetchBookings = async ({
  config,
  eventTypeId,
  monthRange,
}: {
  config: CalApiConfig;
  eventTypeId: number;
  monthRange: { startUtc: string; endUtc: string };
}) => {
  const statuses = ['upcoming', 'unconfirmed'] as const;
  const take = 250;
  const allBookings: Record<string, unknown>[] = [];

  for (const status of statuses) {
    let skip = 0;
    for (let page = 0; page < 8; page += 1) {
      const payload = await calRequest<CalBookingPayload>({
        config,
        method: 'GET',
        path: '/v2/bookings',
        searchParams: {
          status,
          eventTypeId,
          afterStart: monthRange.startUtc,
          beforeEnd: monthRange.endUtc,
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

export const buildAvailabilityForMonth = async ({
  config,
  eventTypeId,
  monthKey,
  timeZone,
  liveFromDate,
}: {
  config: CalApiConfig;
  eventTypeId: number;
  monthKey: string;
  timeZone: string;
  liveFromDate?: string | null;
}) => {
  const monthRange = getMonthUtcRange(monthKey, timeZone);
  if (!monthRange) {
    throw new Error('Invalid month key');
  }

  const parsedMonth = parseMonthKey(monthKey);
  if (!parsedMonth) {
    throw new Error('Invalid month key');
  }

  const [openMap, bookings] = await Promise.all([
    fetchSlotsOpenMap({
      config,
      eventTypeId,
      monthRange,
      timeZone,
    }),
    fetchBookings({
      config,
      eventTypeId,
      monthRange,
    }),
  ]);

  const bookedMap = new Map<string, { am: boolean; pm: boolean }>();

  for (const booking of bookings) {
    const status = getBookingStatus(booking);
    if (!isBlockingBookingStatus(status)) continue;

    const startIso = asString(booking.start) || asString(booking.startTime);
    const endIso = asString(booking.end) || asString(booking.endTime);
    if (!startIso || !endIso) continue;

    const metadata = isRecord(booking.metadata) ? booking.metadata : {};
    const explicitScope = normalizeBlockScope(asString(metadata.block_scope));
    const requestedHoursRaw = asString(metadata.requested_hours);
    const requestedHours = requestedHoursRaw ? Number(requestedHoursRaw) : Number.NaN;
    const blockScopeFromHours =
      Number.isFinite(requestedHours) && requestedHours >= 5 ? 'FULL_DAY' : null;
    const blockScope = blockScopeFromHours || explicitScope || inferBlockScope({ startIso, endIso, timeZone });
    const local = toTimeZoneParts(startIso, timeZone);

    const day = getOrCreate(bookedMap, local.dateKey, () => ({ am: false, pm: false }));
    if (blockScope === 'HALF_AM') day.am = true;
    if (blockScope === 'HALF_PM') day.pm = true;
    if (blockScope === 'FULL_DAY') {
      day.am = true;
      day.pm = true;
    }
  }

  const days: Record<string, DayAvailability> = {};
  const totalDays = getDaysInMonth(parsedMonth.year, parsedMonth.month);

  for (let day = 1; day <= totalDays; day += 1) {
    const dateKey = `${parsedMonth.year}-${pad2(parsedMonth.month)}-${pad2(day)}`;
    const open = openMap.get(dateKey) || createOpenState();
    const booked = bookedMap.get(dateKey) || { am: false, pm: false };

    const isBeforeGoLive = !!liveFromDate && dateKey < liveFromDate;

    const amState: DayState = isBeforeGoLive
      ? 'closed'
      : booked.am
        ? 'booked'
        : open.am
          ? 'available'
          : 'closed';

    const pmState: DayState = isBeforeGoLive
      ? 'closed'
      : booked.pm
        ? 'booked'
        : open.pm
          ? 'available'
          : 'closed';

    days[dateKey] = {
      am: amState,
      pm: pmState,
      fullOpen: !isBeforeGoLive && open.full,
    };
  }

  return {
    monthStart: monthRange.monthStart,
    monthEnd: monthRange.monthEnd,
    days,
  };
};

export const resolveBookingBlock = ({
  requestedHours,
  half,
}: {
  requestedHours: number;
  half: BookingHalf | null;
}):
  | { ok: true; blockScope: BlockScope; blockMinutes: number; startHour: number }
  | { ok: false; message: string } => {
  if (!Number.isInteger(requestedHours) || requestedHours < MIN_HOURS || requestedHours > MAX_HOURS) {
    return { ok: false, message: `requestedHours must be an integer between ${MIN_HOURS} and ${MAX_HOURS}` };
  }

  if (half !== 'am' && half !== 'pm') {
    return { ok: false, message: 'half (am or pm) is required for all bookings' };
  }

  if (half === 'pm' && requestedHours > PM_MAX_HOURS) {
    return { ok: false, message: `PM bookings support up to ${PM_MAX_HOURS} hours` };
  }

  const startHour = half === 'am' ? 8 : 13;
  const blockMinutes = requestedHours * 60;
  const blockScope: BlockScope =
    requestedHours >= 5 ? 'FULL_DAY' : half === 'am' ? 'HALF_AM' : 'HALF_PM';

  return { ok: true, blockScope, blockMinutes, startHour };
};

export const isSelectionAvailable = ({
  day,
  requestedHours,
  half,
}: {
  day: DayAvailability;
  requestedHours: number;
  half: BookingHalf | null;
}) => {
  if (requestedHours >= 5) {
    // 5+ hour requests reserve the full day inventory regardless of AM/PM start preference.
    return day.am === 'available' && day.pm === 'available';
  }

  if (half === 'am') return day.am === 'available';
  if (half === 'pm') return day.pm === 'available';
  return false;
};

export const sha256Hex = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const getClientIp = (req: Request) => {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (!forwardedFor) return 'unknown';
  return forwardedFor.split(',')[0].trim() || 'unknown';
};

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};

export const verifyTurnstileToken = async ({
  token,
  ip,
}: {
  token: string | null;
  ip: string;
}) => {
  const secret =
    Deno.env.get('TURNSTILE_SECRET_KEY') ||
    Deno.env.get('CLOUDFLARE_TURNSTILE_SECRET_KEY') ||
    Deno.env.get('CF_TURNSTILE_SECRET_KEY');

  if (!secret) return { success: true, reason: 'Turnstile secret not configured' };

  if (!token) return { success: false, reason: 'Missing Turnstile token' };

  const body = new URLSearchParams({
    secret,
    response: token,
    remoteip: ip,
  });

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success !== true) {
    return { success: false, reason: 'Turnstile verification failed', payload };
  }

  return { success: true, reason: 'ok' };
};

export const verifyCalWebhookSignature = async ({
  secret,
  bodyText,
  signatureHeader,
}: {
  secret: string;
  bodyText: string;
  signatureHeader: string | null;
}) => {
  if (!signatureHeader) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(bodyText));
  const expected = `sha256=${Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;

  return timingSafeEqual(signatureHeader, expected);
};

export const logBookingRequest = async ({
  supabase,
  endpoint,
  requestId,
  statusCode,
  details,
}: {
  supabase: ReturnType<typeof createServiceRoleClient>;
  endpoint: string;
  requestId: string;
  statusCode: number;
  details?: Record<string, unknown>;
}) => {
  await supabase.from('booking_request_logs').insert({
    endpoint,
    request_id: requestId,
    status_code: statusCode,
    details: details || {},
  });
};
