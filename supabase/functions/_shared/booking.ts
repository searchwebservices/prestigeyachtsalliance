import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── V3 Policy Constants ──────────────────────────────────────────────
export const BOOKING_POLICY_VERSION = 'v3';
export const BOOKING_TIMEZONE = 'America/Mazatlan';
export const MIN_HOURS = 3;
export const MAX_HOURS = 8;

// Legacy export kept for compatibility
export const PM_MAX_HOURS = 6;

// V3 Windows
export const OPERATING_START = 6;
export const OPERATING_END = 18;
export const MORNING_START = 6;
export const MORNING_END = 13;
export const BUFFER_START = 13;
export const BUFFER_END = 15;
export const AFTERNOON_START = 15;
export const AFTERNOON_END = 18;

export type DayState = 'available' | 'booked' | 'closed';
export type BookingHalf = 'am' | 'pm';
// Legacy type kept for compatibility
export type BlockScope = 'HALF_AM' | 'HALF_PM' | 'FULL_DAY';

export type V3DayAvailability = {
  am: DayState;
  pm: DayState;
  fullOpen: boolean;
  openHours: number[];
  validStartsByDuration: Record<string, number[]>;
};

// Legacy type alias
export type DayAvailability = V3DayAvailability;

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

// Legacy export kept for compatibility
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
// Shared across internal/public edge functions; include mutation verbs used by internal APIs.
const CORS_ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
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

// ── V3 Policy Helpers ────────────────────────────────────────────────

/**
 * Checks if a specific startHour is allowed by V3 policy for a given duration.
 *
 * Duration  Allowed starts
 * --------  --------------
 * 3h        06-10 (end<=13)  OR  15 (end=18)
 * 4h        06-09 (end<=13)
 * 5h        06-13 (end<=18)
 * 6h        06-12
 * 7h        06-11
 * 8h        06-10
 */
export const isStartAllowedByPolicy = (requestedHours: number, startHour: number): boolean => {
  if (!Number.isInteger(requestedHours) || requestedHours < MIN_HOURS || requestedHours > MAX_HOURS) return false;
  if (!Number.isInteger(startHour)) return false;

  const endHour = startHour + requestedHours;

  // Must fit within operating window
  if (startHour < OPERATING_START || endHour > OPERATING_END) return false;

  if (requestedHours === 3) {
    // Morning: end <= 13 (starts 6-10)
    if (endHour <= MORNING_END) return true;
    // Afternoon: start at 15 exactly (end = 18)
    if (startHour === AFTERNOON_START) return true;
    return false;
  }

  if (requestedHours === 4) {
    // Morning only: end <= 13 (starts 6-9)
    return endHour <= MORNING_END;
  }

  // 5-8h: can start any valid hour as long as end <= 18 (already checked above)
  return true;
};

/**
 * For a given day's open hours, return the valid start hours for a specific duration,
 * filtered by policy and contiguous block availability.
 */
export const getValidStartsForDay = (openHours: number[], requestedHours: number): number[] => {
  const openSet = new Set(openHours);
  const validStarts: number[] = [];

  for (let startHour = OPERATING_START; startHour <= OPERATING_END - requestedHours; startHour++) {
    if (!isStartAllowedByPolicy(requestedHours, startHour)) continue;

    // Check contiguous block: all hours from startHour to startHour + requestedHours - 1 must be open
    let contiguous = true;
    for (let h = startHour; h < startHour + requestedHours; h++) {
      if (!openSet.has(h)) {
        contiguous = false;
        break;
      }
    }

    if (contiguous) validStarts.push(startHour);
  }

  return validStarts;
};

/**
 * Derive shift classification from start/end hours.
 */
export const deriveShiftFit = (startHour: number, endHour: number): 'morning' | 'afternoon' | 'flexible' => {
  if (endHour <= MORNING_END) return 'morning';
  if (startHour >= AFTERNOON_START) return 'afternoon';
  return 'flexible';
};

/**
 * Derive AM/PM segment string from shift fit.
 */
export const deriveSegment = (shiftFit: string): string => {
  if (shiftFit === 'morning') return 'am';
  if (shiftFit === 'afternoon') return 'pm';
  return 'flexible';
};

/**
 * Resolve the start hour for a booking create request.
 * Uses startHour if provided; otherwise falls back to legacy half mapping.
 */
export const resolveStartHourForCreate = ({
  startHour,
  half,
  requestedHours,
}: {
  startHour?: number | null;
  half?: BookingHalf | null;
  requestedHours: number;
}):
  | { ok: true; startHour: number; endHour: number; shiftFit: string; segment: string }
  | { ok: false; message: string } => {

  if (!Number.isInteger(requestedHours) || requestedHours < MIN_HOURS || requestedHours > MAX_HOURS) {
    return { ok: false, message: `requestedHours must be an integer between ${MIN_HOURS} and ${MAX_HOURS}` };
  }

  let resolved: number;
  if (startHour != null && Number.isInteger(startHour)) {
    resolved = startHour;
  } else if (half === 'am') {
    resolved = 6;
  } else if (half === 'pm') {
    resolved = 15;
  } else {
    return { ok: false, message: 'startHour or half (am/pm) is required' };
  }

  if (!isStartAllowedByPolicy(requestedHours, resolved)) {
    return {
      ok: false,
      message: `Start hour ${resolved}:00 is not allowed for ${requestedHours}h booking by V3 policy`,
    };
  }

  const endHour = resolved + requestedHours;
  const shiftFit = deriveShiftFit(resolved, endHour);
  const segment = deriveSegment(shiftFit);

  return { ok: true, startHour: resolved, endHour, shiftFit, segment };
};

/**
 * Check if a specific start hour is available in the day's validStartsByDuration.
 */
export const isStartSelectionAvailable = (
  day: V3DayAvailability,
  requestedHours: number,
  startHour: number,
): boolean => {
  const validStarts = day.validStartsByDuration[String(requestedHours)];
  if (!validStarts) return false;
  return validStarts.includes(startHour);
};

// ── Cal.com Data Fetching ────────────────────────────────────────────

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

const getSlotIso = (slot: SlotRecord) => {
  if (typeof slot === 'string') return slot;
  if (typeof slot.start === 'string') return slot.start;
  if (typeof slot.time === 'string') return slot.time;
  return null;
};

const getOrCreate = <T>(map: Map<string, T>, key: string, create: () => T) => {
  const existing = map.get(key);
  if (existing) return existing;
  const next = create();
  map.set(key, next);
  return next;
};

const getSlotsMap = (payload: CalSlotsPayload): Record<string, SlotRecord[]> => {
  const data = payload.data;
  if (!data || !isRecord(data)) return {};

  const directDayEntries = Object.entries(data).filter(([, value]) => Array.isArray(value));
  if (directDayEntries.length > 0) {
    return Object.fromEntries(directDayEntries) as Record<string, SlotRecord[]>;
  }

  const slots = (data as { slots?: unknown }).slots;
  if (!slots || !isRecord(slots)) return {};

  const slotEntries = Object.entries(slots).filter(([, value]) => Array.isArray(value));
  return Object.fromEntries(slotEntries) as Record<string, SlotRecord[]>;
};

/**
 * Fetch available time-slots from Cal.com using duration=60.
 * Returns a Map of dateKey -> Set<hour> of available hours within operating window.
 */
const fetchSlotsOpenHours = async ({
  config,
  eventTypeId,
  monthRange,
  timeZone,
}: {
  config: CalApiConfig;
  eventTypeId: number;
  monthRange: { startUtc: string; endUtc: string };
  timeZone: string;
}): Promise<Map<string, Set<number>>> => {
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
  const hoursPerDay = new Map<string, Set<number>>();

  for (const slots of Object.values(slotMap)) {
    for (const slot of slots) {
      const iso = getSlotIso(slot);
      if (!iso) continue;

      const local = toTimeZoneParts(iso, timeZone);
      if (local.minute !== 0) continue;
      if (local.hour < OPERATING_START || local.hour >= OPERATING_END) continue;

      const hours = getOrCreate(hoursPerDay, local.dateKey, () => new Set<number>());
      hours.add(local.hour);
    }
  }

  return hoursPerDay;
};

/**
 * Fetch available slots from Cal.com for a specific duration (in minutes).
 * Returns a Map of dateKey -> Set<startHour> for slots within operating window.
 */
const fetchSlotsForDuration = async ({
  config,
  eventTypeId,
  monthRange,
  timeZone,
  durationMinutes,
}: {
  config: CalApiConfig;
  eventTypeId: number;
  monthRange: { startUtc: string; endUtc: string };
  timeZone: string;
  durationMinutes: number;
}): Promise<Map<string, Set<number>>> => {
  const payload = await calRequest<CalSlotsPayload>({
    config,
    method: 'GET',
    path: '/v2/slots',
    searchParams: {
      eventTypeId,
      start: monthRange.startUtc,
      end: monthRange.endUtc,
      timeZone,
      duration: durationMinutes,
    },
    apiVersion: DEFAULT_CAL_API_VERSION_SLOTS,
  });

  const slotMap = getSlotsMap(payload);
  const startsPerDay = new Map<string, Set<number>>();

  for (const slots of Object.values(slotMap)) {
    for (const slot of slots) {
      const iso = getSlotIso(slot);
      if (!iso) continue;

      const local = toTimeZoneParts(iso, timeZone);
      if (local.hour < OPERATING_START || local.hour >= OPERATING_END) continue;

      const starts = getOrCreate(startsPerDay, local.dateKey, () => new Set<number>());
      starts.add(local.hour);
    }
  }

  return startsPerDay;
};

/**
 * Check if Cal.com provider has an available slot for a specific date, start hour, and duration.
 * Used as a pre-create recheck to avoid false-positive 409s.
 */
export const checkProviderSlotAvailable = async ({
  config,
  eventTypeId,
  date,
  startHour,
  requestedHours,
  timeZone,
}: {
  config: CalApiConfig;
  eventTypeId: number;
  date: string;
  startHour: number;
  requestedHours: number;
  timeZone: string;
}): Promise<boolean> => {
  const startUtc = zonedDateTimeToUtcIso(date, 0, 0, timeZone);
  const endUtc = zonedDateTimeToUtcIso(date, 23, 59, timeZone);

  const payload = await calRequest<CalSlotsPayload>({
    config,
    method: 'GET',
    path: '/v2/slots',
    searchParams: {
      eventTypeId,
      start: startUtc,
      end: endUtc,
      timeZone,
      duration: requestedHours * 60,
    },
    apiVersion: DEFAULT_CAL_API_VERSION_SLOTS,
  });

  const slotMap = getSlotsMap(payload);
  for (const slots of Object.values(slotMap)) {
    for (const slot of slots) {
      const iso = getSlotIso(slot);
      if (!iso) continue;
      const local = toTimeZoneParts(iso, timeZone);
      if (local.dateKey === date && local.hour === startHour) return true;
    }
  }
  return false;
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

// ── Build Availability ───────────────────────────────────────────────

const DURATIONS = [3, 4, 5, 6, 7, 8];

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

  // Fetch duration=60 slots (for openHours/am-pm display), bookings,
  // and per-duration provider slots in parallel
  const [slotsMap, bookings, ...providerStartsMaps] = await Promise.all([
    fetchSlotsOpenHours({
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
    ...DURATIONS.map(dur =>
      fetchSlotsForDuration({
        config,
        eventTypeId,
        monthRange,
        timeZone,
        durationMinutes: dur * 60,
      })
    ),
  ]);

  // Build blocked hours per day from exact booked intervals
  const blockedHoursMap = new Map<string, Set<number>>();

  for (const booking of bookings) {
    const status = getBookingStatus(booking);
    if (!isBlockingBookingStatus(status)) continue;

    const startIso = asString(booking.start) || asString(booking.startTime);
    const endIso = asString(booking.end) || asString(booking.endTime);
    if (!startIso || !endIso) continue;

    const localStart = toTimeZoneParts(startIso, timeZone);
    const localEnd = toTimeZoneParts(endIso, timeZone);

    // Block each hour in the interval [startHour, endHour)
    const startH = localStart.hour;
    const endDateKey = localEnd.dateKey;

    // If booking spans across days, only block hours on the start day within operating window
    // (multi-day bookings are edge cases for this yacht use case)
    if (localStart.dateKey === endDateKey || localEnd.hour === 0) {
      const endH = localStart.dateKey === endDateKey ? localEnd.hour : OPERATING_END;
      const blocked = getOrCreate(blockedHoursMap, localStart.dateKey, () => new Set<number>());
      for (let h = startH; h < endH; h++) {
        if (h >= OPERATING_START && h < OPERATING_END) blocked.add(h);
      }
    } else {
      // Spans multiple days - block remaining hours on start day
      const blocked1 = getOrCreate(blockedHoursMap, localStart.dateKey, () => new Set<number>());
      for (let h = startH; h < OPERATING_END; h++) {
        if (h >= OPERATING_START) blocked1.add(h);
      }
      // Block hours on end day
      const blocked2 = getOrCreate(blockedHoursMap, endDateKey, () => new Set<number>());
      for (let h = OPERATING_START; h < localEnd.hour; h++) {
        blocked2.add(h);
      }
    }
  }

  const days: Record<string, V3DayAvailability> = {};
  const totalDays = getDaysInMonth(parsedMonth.year, parsedMonth.month);

  for (let day = 1; day <= totalDays; day += 1) {
    const dateKey = `${parsedMonth.year}-${pad2(parsedMonth.month)}-${pad2(day)}`;
    const isBeforeGoLive = !!liveFromDate && dateKey < liveFromDate;

    if (isBeforeGoLive) {
      days[dateKey] = {
        am: 'closed',
        pm: 'closed',
        fullOpen: false,
        openHours: [],
        validStartsByDuration: { '3': [], '4': [], '5': [], '6': [], '7': [], '8': [] },
      };
      continue;
    }

    const slotHours = slotsMap.get(dateKey) || new Set<number>();
    const blockedHours = blockedHoursMap.get(dateKey) || new Set<number>();

    // V3 operating model: if Cal exposes any slot on a day, treat the full
    // operating window as open for policy evaluation and only subtract booked
    // intervals. This keeps start-times anchored to 06:00-18:00 consistently.
    const isDayOpen = slotHours.size > 0 || blockedHours.size > 0;

    // Open hours = operating window hours that are NOT blocked (for open days)
    const openHours: number[] = [];
    for (let h = OPERATING_START; h < OPERATING_END; h++) {
      if (isDayOpen && !blockedHours.has(h)) {
        openHours.push(h);
      }
    }

    // Compute validStartsByDuration: intersect provider-valid starts with policy
    const validStartsByDuration: Record<string, number[]> = {};
    for (let i = 0; i < DURATIONS.length; i++) {
      const dur = DURATIONS[i];
      const providerStarts = providerStartsMaps[i].get(dateKey) || new Set<number>();
      const validStarts: number[] = [];
      for (const sh of providerStarts) {
        if (isStartAllowedByPolicy(dur, sh)) {
          validStarts.push(sh);
        }
      }
      validStarts.sort((a, b) => a - b);
      validStartsByDuration[String(dur)] = validStarts;
    }

    // Derive am/pm/fullOpen for hybrid calendar highlighting
    // Use booked-hour evidence per window for accurate booked indicators
    const hasAnyMorningStarts = DURATIONS.some(d => validStartsByDuration[String(d)].some(s => s < MORNING_END));
    const hasAnyAfternoonStarts = DURATIONS.some(d => validStartsByDuration[String(d)].some(s => s >= AFTERNOON_START));

    // Check if any morning hours (6-12) are booked
    let hasMorningBooking = false;
    for (let h = MORNING_START; h < MORNING_END; h++) {
      if (blockedHours.has(h)) { hasMorningBooking = true; break; }
    }
    // Check if any afternoon hours (15-17) are booked
    let hasAfternoonBooking = false;
    for (let h = AFTERNOON_START; h < AFTERNOON_END; h++) {
      if (blockedHours.has(h)) { hasAfternoonBooking = true; break; }
    }

    const amState: DayState = hasAnyMorningStarts ? 'available' : (hasMorningBooking ? 'booked' : 'closed');
    const pmState: DayState = hasAnyAfternoonStarts ? 'available' : (hasAfternoonBooking ? 'booked' : 'closed');
    const fullOpen = hasAnyMorningStarts && hasAnyAfternoonStarts;

    days[dateKey] = {
      am: amState,
      pm: pmState,
      fullOpen,
      openHours,
      validStartsByDuration,
    };
  }

  return {
    monthStart: monthRange.monthStart,
    monthEnd: monthRange.monthEnd,
    days,
  };
};

// ── Legacy Helpers (kept for backward compat during migration) ───────

export const resolveBookingBlock = ({
  requestedHours,
  half,
}: {
  requestedHours: number;
  half: BookingHalf | null;
}):
  | { ok: true; blockScope: BlockScope; blockMinutes: number; startHour: number }
  | { ok: false; message: string } => {
  // Delegate to V3 resolver
  const resolution = resolveStartHourForCreate({ half, requestedHours });
  if (!resolution.ok) return resolution;

  const blockMinutes = requestedHours * 60;
  const blockScope: BlockScope =
    requestedHours >= 5 ? 'FULL_DAY' : (half === 'pm' ? 'HALF_PM' : 'HALF_AM');

  return { ok: true, blockScope, blockMinutes, startHour: resolution.startHour };
};

export const isSelectionAvailable = ({
  day,
  requestedHours,
  half,
}: {
  day: V3DayAvailability;
  requestedHours: number;
  half: BookingHalf | null;
}): boolean => {
  // V3: use validStartsByDuration
  const resolved = resolveStartHourForCreate({ half, requestedHours });
  if (!resolved.ok) return false;
  return isStartSelectionAvailable(day, requestedHours, resolved.startHour);
};

// ── Utility Exports ──────────────────────────────────────────────────

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
