export const BOOKING_POLICY_VERSION = 'v2';

export const BOOKING_TIMEZONE = 'America/Mazatlan';

export const BOOKING_WINDOWS = {
  am: { startHour: 8, endHour: 12 },
  pm: { startHour: 13, endHour: 19 },
  full: { startHour: 8, endHour: 19 },
} as const;

export const BOOKING_MIN_HOURS = 4;
export const BOOKING_MAX_HOURS = 8;

export const PM_MAX_HOURS = 6;

export type BookingMode = 'legacy_embed' | 'policy_v2';
export type BookingHalf = 'am' | 'pm';
export type DayState = 'available' | 'booked' | 'closed';

export type DayAvailability = {
  am: DayState;
  pm: DayState;
  fullOpen: boolean;
};

