export const BOOKING_POLICY_VERSION = 'v2';

export const BOOKING_TIMEZONE = 'America/Mazatlan';

export const BOOKING_WINDOWS = {
  am: { startHour: 8, endHour: 12 },
  pm: { startHour: 13, endHour: 19 },
  full: { startHour: 8, endHour: 19 },
} as const;

export const BOOKING_MIN_HOURS = 3;
export const BOOKING_MAX_HOURS = 11;

export const BLOCK_DURATIONS_MINUTES = {
  HALF_AM: 240,
  HALF_PM: 360,
  FULL_DAY: 660,
} as const;

export type BookingMode = 'legacy_embed' | 'policy_v2';
export type BookingHalf = 'am' | 'pm';
export type DayState = 'available' | 'booked' | 'closed';
export type BlockScope = keyof typeof BLOCK_DURATIONS_MINUTES;

export type DayAvailability = {
  am: DayState;
  pm: DayState;
  fullOpen: boolean;
};

export const isHalfDayBooking = (hours: number) => hours === 3 || hours === 4;
export const isFullDayBooking = (hours: number) => hours >= 5;

