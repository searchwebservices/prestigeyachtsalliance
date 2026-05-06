// Internal availability builder — replaces Cal.com slot fetching with
// reservation_details lookups. Cal.com integration is temporarily disabled.

import {
  parseMonthKey,
  toTimeZoneParts,
  zonedDateTimeToUtcIso,
  type createServiceRoleClient,
} from './booking.ts';

export const OPEN_START = 6;
export const OPEN_END = 18;
export const MIN_HOURS = 3;
export const MAX_HOURS = 8;
export const BUFFER_HOURS = 2;

export type DayState = 'available' | 'booked' | 'closed';

export type DayAvailability = {
  am: DayState;
  pm: DayState;
  fullOpen: boolean;
  openHours: number[];
  validStartsByDuration: Record<string, number[]>;
};

export type Reservation = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
};

const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

export const loadReservationsForRange = async ({
  supabase,
  yachtSlug,
  startUtcIso,
  endUtcIso,
  excludeBookingUid,
}: {
  supabase: ReturnType<typeof createServiceRoleClient>;
  yachtSlug: string;
  startUtcIso: string;
  endUtcIso: string;
  excludeBookingUid?: string | null;
}): Promise<Reservation[]> => {
  let q = supabase
    .from('reservation_details')
    .select('id,start_at,end_at,status,booking_uid_current')
    .eq('yacht_slug', yachtSlug)
    .neq('status', 'cancelled')
    .lt('start_at', endUtcIso)
    .gt('end_at', startUtcIso);

  const { data, error } = await q;
  if (error) throw error;
  const rows = (data || []) as (Reservation & { booking_uid_current: string })[];
  return excludeBookingUid
    ? rows.filter((r) => r.booking_uid_current !== excludeBookingUid)
    : rows;
};

const hourFloat = (iso: string, timeZone: string) => {
  const p = toTimeZoneParts(iso, timeZone);
  return p.hour + p.minute / 60;
};

const dayKey = (iso: string, timeZone: string) => {
  const p = toTimeZoneParts(iso, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
};

export const buildAvailabilityForMonth = async ({
  supabase,
  yachtSlug,
  monthKey,
  timeZone,
  liveFromDate,
}: {
  supabase: ReturnType<typeof createServiceRoleClient>;
  yachtSlug: string;
  monthKey: string;
  timeZone: string;
  liveFromDate?: string | null;
}): Promise<{ days: Record<string, DayAvailability> }> => {
  const m = parseMonthKey(monthKey);
  if (!m) throw new Error('invalid_month');

  const lastDay = new Date(Date.UTC(m.year, m.month, 0)).getUTCDate();
  const firstDateKey = dateKey(m.year, m.month, 1);
  const lastDateKey = dateKey(m.year, m.month, lastDay);

  // Fetch a slightly larger window so buffer-spanning bookings are caught
  const startUtc = zonedDateTimeToUtcIso(firstDateKey, 0, 0, timeZone);
  const endUtc = zonedDateTimeToUtcIso(lastDateKey, 23, 59, timeZone);

  const reservations = await loadReservationsForRange({
    supabase,
    yachtSlug,
    startUtcIso: startUtc,
    endUtcIso: endUtc,
  });

  // Bucket reservations by local date key (using start_at). We treat each
  // reservation as occurring on its start day (all bookings are same-day).
  const byDate = new Map<string, Array<{ start: number; end: number }>>();
  for (const r of reservations) {
    const dk = dayKey(r.start_at, timeZone);
    const startH = hourFloat(r.start_at, timeZone);
    const endH = hourFloat(r.end_at, timeZone);
    if (!byDate.has(dk)) byDate.set(dk, []);
    byDate.get(dk)!.push({ start: startH, end: endH });
  }

  const days: Record<string, DayAvailability> = {};
  for (let d = 1; d <= lastDay; d++) {
    const dk = dateKey(m.year, m.month, d);
    const beforeLive = liveFromDate && dk < liveFromDate;
    const blocked = byDate.get(dk) || [];

    const openHours: number[] = [];
    if (!beforeLive) {
      for (let h = OPEN_START; h < OPEN_END; h++) {
        // hour h is "open" if no reservation interval (expanded by buffer) covers it
        const conflict = blocked.some(
          (b) => h < b.end + BUFFER_HOURS && h + 1 > b.start - BUFFER_HOURS,
        );
        if (!conflict) openHours.push(h);
      }
    }

    const validStartsByDuration: Record<string, number[]> = {
      '3': [], '4': [], '5': [], '6': [], '7': [], '8': [],
    };
    if (!beforeLive) {
      for (let dur = MIN_HOURS; dur <= MAX_HOURS; dur++) {
        for (let s = OPEN_START; s + dur <= OPEN_END; s++) {
          const e = s + dur;
          // No overlap with any [b.start - buffer, b.end + buffer)
          const conflict = blocked.some(
            (b) => s < b.end + BUFFER_HOURS && e > b.start - BUFFER_HOURS,
          );
          if (!conflict) validStartsByDuration[String(dur)].push(s);
        }
      }
    }

    const amOpen = openHours.some((h) => h < 13);
    const pmOpen = openHours.some((h) => h >= 13);
    const fullyClosed = beforeLive;

    days[dk] = {
      am: fullyClosed ? 'closed' : amOpen ? 'available' : 'booked',
      pm: fullyClosed ? 'closed' : pmOpen ? 'available' : 'booked',
      fullOpen: !fullyClosed && openHours.length === OPEN_END - OPEN_START,
      openHours,
      validStartsByDuration,
    };
  }

  return { days };
};

export const isStartSelectionAvailable = (
  day: DayAvailability,
  requestedHours: number,
  startHour: number,
): boolean => {
  const list = day.validStartsByDuration[String(requestedHours)] || [];
  return list.includes(startHour);
};

export const isStartAllowedByPolicy = (requestedHours: number, startHour: number) => {
  if (!Number.isInteger(requestedHours) || requestedHours < MIN_HOURS || requestedHours > MAX_HOURS) return false;
  if (!Number.isInteger(startHour)) return false;
  const end = startHour + requestedHours;
  return startHour >= OPEN_START && end <= OPEN_END;
};
