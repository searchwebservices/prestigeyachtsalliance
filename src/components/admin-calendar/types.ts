export type CalendarViewMode = 'week' | 'day' | 'month';

export type CalendarActionView = 'view' | 'reschedule' | 'remove_confirm' | 'submitting';

export type AdminCalendarYacht = {
  id: string;
  name: string;
  slug: string;
  vessel_type: string;
  capacity: number;
};

export type AdminCalendarEvent = {
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
  calBookingUrl?: string | null;
};

export type RescheduleDraft = {
  date: string | null;
  requestedHours: number | null;
  startHour: number | null;
  isDateValid: boolean;
  isDurationValid: boolean;
  isStartValid: boolean;
};

export type CalendarActionResult = {
  ok: boolean;
  status?: number;
  error?: string;
};
