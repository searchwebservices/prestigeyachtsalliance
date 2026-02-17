export const BOOKING_POLICY_VERSION = 'v3';
export const BOOKING_TIMEZONE = 'America/Mazatlan';

export const BOOKING_MIN_HOURS = 3;
export const BOOKING_MAX_HOURS = 8;
export const INTER_BOOKING_BUFFER_HOURS = 2;

export const BOOKING_DAY_START_HOUR = 6;
export const BOOKING_DAY_END_HOUR = 18;
export const BOOKING_MORNING_END_HOUR = 13;
export const BOOKING_BUFFER_START_HOUR = 13;
export const BOOKING_BUFFER_END_HOUR = 15;
export const BOOKING_AFTERNOON_START_HOUR = 15;
export const BOOKING_TIME_STEP_MINUTES = 60;

export const BOOKING_WINDOWS = {
  operating: { startHour: BOOKING_DAY_START_HOUR, endHour: BOOKING_DAY_END_HOUR },
  morning: { startHour: BOOKING_DAY_START_HOUR, endHour: BOOKING_MORNING_END_HOUR },
  buffer: { startHour: BOOKING_BUFFER_START_HOUR, endHour: BOOKING_BUFFER_END_HOUR },
  afternoon: { startHour: BOOKING_AFTERNOON_START_HOUR, endHour: BOOKING_DAY_END_HOUR },
} as const;

export type BookingMode = 'legacy_embed' | 'policy_v2';
export type DayState = 'available' | 'booked' | 'closed';
export type ShiftFit = 'morning' | 'afternoon' | 'flexible';
export type DurationKey = '3' | '4' | '5' | '6' | '7' | '8';

export type ValidStartsByDuration = Record<DurationKey, number[]>;

export type DayAvailability = {
  am: DayState;
  pm: DayState;
  fullOpen: boolean;
  openHours: number[];
  validStartsByDuration: ValidStartsByDuration;
};

export const createEmptyValidStartsByDuration = (): ValidStartsByDuration => ({
  '3': [],
  '4': [],
  '5': [],
  '6': [],
  '7': [],
  '8': [],
});

const DURATION_KEYS: DurationKey[] = ['3', '4', '5', '6', '7', '8'];

export const getDurationKey = (hours: number): DurationKey | null => {
  const key = String(hours) as DurationKey;
  return DURATION_KEYS.includes(key) ? key : null;
};

export const formatHour = (hour24: number) => {
  const normalized = ((hour24 % 24) + 24) % 24;
  const suffix = normalized >= 12 ? 'PM' : 'AM';
  const hour12 = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${hour12}:00 ${suffix}`;
};

export const getShiftFit = (startHour: number, endHour: number): ShiftFit => {
  if (endHour <= BOOKING_MORNING_END_HOUR) return 'morning';
  if (startHour >= BOOKING_AFTERNOON_START_HOUR) return 'afternoon';
  return 'flexible';
};

export const getSegmentLabelFromShiftFit = (shiftFit: ShiftFit) => {
  if (shiftFit === 'morning') return 'AM';
  if (shiftFit === 'afternoon') return 'PM';
  return 'FLEXIBLE';
};

export const isStartAllowedByPolicy = (requestedHours: number, startHour: number) => {
  if (!Number.isInteger(requestedHours) || requestedHours < BOOKING_MIN_HOURS || requestedHours > BOOKING_MAX_HOURS) {
    return false;
  }

  if (!Number.isInteger(startHour)) return false;

  const endHour = startHour + requestedHours;
  if (startHour < BOOKING_DAY_START_HOUR || endHour > BOOKING_DAY_END_HOUR) return false;

  if (requestedHours === 3) {
    return endHour <= BOOKING_MORNING_END_HOUR || startHour >= BOOKING_AFTERNOON_START_HOUR;
  }

  if (requestedHours === 4) {
    return endHour <= BOOKING_MORNING_END_HOUR;
  }

  return true;
};

export const getTimeRangeLabel = (requestedHours: number, startHour: number | null) => {
  if (startHour === null) return 'Not selected';
  const endHour = startHour + requestedHours;
  return `${formatHour(startHour)} - ${formatHour(endHour)}`;
};
