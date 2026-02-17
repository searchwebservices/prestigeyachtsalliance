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
  bookingUid?: string | null;
  changeMode?: string;
};

export type ReservationCenterView = 'view' | 'edit' | 'reschedule' | 'remove_confirm' | 'submitting';

export type GuestProfile = {
  id: string | null;
  fullName: string;
  preferredName: string;
  email: string;
  phone: string;
  whatsapp: string;
  nationality: string;
  preferredLanguage: string;
  notes: string;
};

export type ReservationStay = {
  id: string | null;
  propertyName: string;
  locationLabel: string;
  checkInDate: string;
  checkOutDate: string;
  unitOrRoom: string;
  notes: string;
  sortOrder: number;
};

export type ReservationDetails = {
  id: string | null;
  bookingUidCurrent: string;
  bookingUidHistory: string[];
  yachtSlug: string;
  yachtName: string;
  startAt: string;
  endAt: string;
  status: string;
  guestProfileId: string | null;
  guestCount: number | null;
  adultCount: number | null;
  kidsCount: number | null;
  kidsNotes: string;
  stayingMultiplePlaces: boolean;
  allergies: string[];
  preferences: string[];
  dietaryNotes: string;
  mobilityNotes: string;
  occasionNotes: string;
  conciergeNotes: string;
  internalNotes: string;
  source: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ReservationAuditSummary = {
  totalChanges: number;
  lastAction: string | null;
  lastActionAt: string | null;
  lastActorUserId: string | null;
};

export type ReservationRecord = {
  reservation: ReservationDetails;
  guest: GuestProfile;
  stays: ReservationStay[];
  auditSummary: ReservationAuditSummary | null;
  completionScore: number | null;
};

