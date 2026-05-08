import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { addMonths, format, startOfMonth } from 'date-fns';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCopy,
  MessageCircle,
  Phone,
} from 'lucide-react';
import HeroBackdrop from '@/components/reserve/HeroBackdrop';
import BookingWizard from '@/components/calendar/BookingWizard';
import StepYacht, { CalendarYachtOption } from '@/components/calendar/StepYacht';
import StepDay from '@/components/calendar/StepDay';
import StepDuration from '@/components/calendar/StepDuration';
import StepStartTimes from '@/components/calendar/StepStartTimes';
import StepClient from '@/components/calendar/StepClient';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  BOOKING_TIMEZONE,
  DayAvailability,
  getDurationKey,
  getSegmentLabelFromShiftFit,
  getShiftFit,
  getTimeRangeLabel,
} from '@/lib/bookingPolicy';
import { submitToNetlifyForm } from '@/lib/netlifyForms';

type AvailabilityResponse = {
  requestId: string;
  yacht: {
    id: string;
    name: string;
    slug: string;
    vessel_type: string;
    capacity: number;
  };
  month: string;
  timezone: string;
  days: Record<string, DayAvailability>;
  error?: string;
};

type CreateBookingResponse = {
  requestId: string;
  bookingUid: string | null;
  transactionId?: string;
  status: string;
  error?: string;
};

type WizardStep = 1 | 2 | 3 | 4 | 5;

type DraftState = {
  yachtSlug: string | null;
  requestedHours: number | null;
  date: string | null;
  startHour: number | null;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string;
  notes: string;
};

type ConfirmationState = {
  submittedAt: string;
  transactionId: string;
  bookingUid: string | null;
  status: string;
  yachtName: string;
  yachtSlug: string;
  date: string;
  requestedHours: number;
  startHour: number;
  endHour: number;
  shiftFit: 'morning' | 'afternoon' | 'flexible';
  segment: 'AM' | 'PM' | 'FLEXIBLE';
  timeRange: string;
  timezone: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string | null;
  notes: string;
  notificationDelayed: boolean;
};

const INITIAL_DRAFT: DraftState = {
  yachtSlug: null,
  requestedHours: null,
  date: null,
  startHour: null,
  attendeeName: '',
  attendeeEmail: '',
  attendeePhone: '',
  notes: '',
};

const TOTAL_STEPS = 5;
const apiBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const RICARDO_PHONE_E164 = '526242664411';
const RICARDO_PHONE_DISPLAY = '+52 624 266 4411';

const TURNSTILE_SCRIPT_ID = 'cf-turnstile-script';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        }
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

function TurnstileWidget({
  siteKey,
  onTokenChange,
}: {
  siteKey: string;
  onTokenChange: (token: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const renderWidget = () => {
      if (!mounted || !window.turnstile || !containerRef.current || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onTokenChange(token),
        'expired-callback': () => onTokenChange(null),
        'error-callback': () => onTokenChange(null),
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      let script = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = TURNSTILE_SCRIPT_ID;
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onload = renderWidget;
        document.body.appendChild(script);
      } else {
        script.addEventListener('load', renderWidget);
      }
    }

    return () => {
      mounted = false;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
      onTokenChange(null);
    };
  }, [siteKey, onTokenChange]);

  return <div ref={containerRef} className="my-2" />;
}

const COPY = {
  title: 'Reserve your day',
  subtitle: 'Pick your yacht, date, hours, and start time.',
  stepLabel: 'Step',
  ofLabel: 'of',
  back: 'Back',
  continue: 'Continue',
  submit: 'Confirm booking',
  submitting: 'Confirming...',
  retry: 'Retry',
  yachtsError: 'Failed to load yachts. Please try again.',
  yachtsEmpty: 'No yachts are currently available for online booking. Please reach out to our team.',
  availabilityError: 'Could not load availability for this yacht. Try again.',
  endpointNotReady:
    'Our booking system is briefly unavailable. Please try again shortly or call us directly.',
  endpointNotReadyTitle: 'Booking temporarily unavailable',
  submitError: 'Unable to confirm this booking. Please try again.',
  slotConflictHelp: 'That start time was just taken. Please choose another start time.',
  bookingSubmittedTitle: 'Booking confirmed',
  bookingSubmittedDescription: 'Your booking is confirmed. Check your email for next steps.',
  notificationDelayed: 'Booking confirmed. Email notification may be slightly delayed.',
  confirmationPageTitle: "You're booked.",
  confirmationPageSubtitle: 'Confirm payment and operational details with Ricardo to finalize.',
  confirmationRicardoTitle: 'Contact Ricardo',
  confirmationRicardoDescription: `WhatsApp or call ${RICARDO_PHONE_DISPLAY} to close the loop on payment and arrival logistics.`,
  confirmationWhatsAppCta: 'WhatsApp Ricardo',
  confirmationCallCta: 'Call Ricardo',
  confirmationCopyCta: 'Copy reservation',
  confirmationCopiedTitle: 'Reservation copied',
  confirmationCopiedDescription: 'All booking details copied to clipboard.',
  confirmationDetailsTitle: 'Reservation details',
  confirmationClientTitle: 'Your details',
  confirmationMetaTitle: 'Booking status',
  confirmationSubmittedAt: 'Submitted',
  confirmationTransactionId: 'Transaction ID',
  confirmationBookingUid: 'Booking UID',
  confirmationStatus: 'Status',
  confirmationBoat: 'Boat',
  confirmationDate: 'Date',
  confirmationTime: 'Time',
  confirmationDuration: 'Duration',
  confirmationShift: 'Shift',
  confirmationSegment: 'Segment',
  confirmationTimezone: 'Timezone',
  confirmationClientName: 'Name',
  confirmationClientEmail: 'Email',
  confirmationClientPhone: 'Phone',
  confirmationNotes: 'Notes',
  confirmationNotAvailable: 'N/A',
  clearSuccess: 'Make another booking',
  noDaysAvailable: 'No available days in this month. Try another month.',
  hoursUnit: 'hours',
  capacityLabel: 'Capacity',
  stepTitles: {
    1: 'Choose your yacht',
    2: 'Choose your day',
    3: 'How many hours?',
    4: 'Choose start time',
    5: 'Your details',
  },
  stepSubtitles: {
    1: 'Pick the boat for your day on the water.',
    2: 'Tap a date to continue.',
    3: 'Choose how long you want to be out.',
    4: 'Pick a start time.',
    5: 'Tell us how to reach you, then confirm.',
  },
  durationDefault: 'Select a trip length to continue.',
  duration3: '3-hour trips must stay in the morning or afternoon window.',
  duration4: '4-hour trips must fit inside the morning window.',
  duration5: '5+ hour trips can start any hour if they end by 6:00 PM.',
  previousMonth: 'Prev',
  nextMonth: 'Next',
  timeSectionTitle: 'Available start times',
  selectDateHint: 'Select a date to see start times.',
  noTimesForDate: 'No start times available for this date and duration.',
  selectedTripLabel: 'Selected trip',
  shiftFitLabel: 'Shift',
  shiftMorning: 'Morning',
  shiftAfternoon: 'Afternoon',
  shiftFlexible: 'Flexible',
  weekdayLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  summaryLabel: 'Booking summary',
  nameLabel: 'Full name',
  namePlaceholder: 'Your full name',
  emailLabel: 'Email',
  emailPlaceholder: 'you@example.com',
  phoneLabel: 'Phone (optional)',
  phonePlaceholder: '+1...',
  notesLabel: 'Notes (optional)',
  notesPlaceholder: 'Special requests, occasion, dietary preferences',
  turnstileNote: 'Please complete the verification before confirming.',
} as const;

const monthKeyFromDate = (date: Date) => format(date, 'yyyy-MM');

const buildReservationReportText = (details: ConfirmationState) =>
  [
    'Prestige Yachts - Booking Confirmation',
    `Transaction ID: ${details.transactionId}`,
    `Booking UID: ${details.bookingUid || 'N/A'}`,
    `Status: ${details.status}`,
    `Boat: ${details.yachtName} (${details.yachtSlug})`,
    `Date: ${details.date}`,
    `Time: ${details.timeRange} (${details.timezone})`,
    `Hours: ${details.requestedHours}`,
    `Shift: ${details.shiftFit}`,
    `Segment: ${details.segment}`,
    `Name: ${details.attendeeName}`,
    `Email: ${details.attendeeEmail}`,
    `Phone: ${details.attendeePhone || 'N/A'}`,
    `Notes: ${details.notes || 'N/A'}`,
    `Submitted At: ${details.submittedAt}`,
    `Ricardo: ${RICARDO_PHONE_DISPLAY}`,
  ].join('\n');

const buildRicardoWhatsAppText = (details: ConfirmationState) =>
  [
    'Hi Ricardo, booking confirmed.',
    `Transaction ID: ${details.transactionId}`,
    `Boat: ${details.yachtName}`,
    `Date: ${details.date}`,
    `Time: ${details.timeRange}`,
    `Client: ${details.attendeeName} (${details.attendeeEmail})`,
    `Phone: ${details.attendeePhone || 'N/A'}`,
    `Notes: ${details.notes || 'N/A'}`,
  ].join('\n');

const isEndpointUnavailable = (status: number, errorMessage?: string) => {
  if (![404, 405, 501].includes(status)) return false;
  if (!errorMessage) return true;
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes('function') ||
    normalized.includes('endpoint') ||
    normalized.includes('not deployed') ||
    normalized.includes('no route')
  );
};

const getDateKeyInTimeZone = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) return format(date, 'yyyy-MM-dd');
  return `${year}-${month}-${day}`;
};

export default function ReserveBook() {
  const { toast } = useToast();

  const [step, setStep] = useState<WizardStep>(1);
  const [draft, setDraft] = useState<DraftState>(INITIAL_DRAFT);
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);

  const [yachts, setYachts] = useState<CalendarYachtOption[]>([]);
  const [loadingYachts, setLoadingYachts] = useState(true);
  const [yachtsError, setYachtsError] = useState<string | null>(null);

  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [blockingEndpointError, setBlockingEndpointError] = useState<string | null>(null);
  const [submitInlineError, setSubmitInlineError] = useState<string | null>(null);
  const [cfToken, setCfToken] = useState<string | null>(null);

  const todayDateKey = useMemo(() => getDateKeyInTimeZone(new Date(), BOOKING_TIMEZONE), []);
  const minMonthDate = useMemo(() => {
    const [yearRaw, monthRaw] = todayDateKey.split('-');
    return new Date(Number(yearRaw), Number(monthRaw) - 1, 1);
  }, [todayDateKey]);

  const monthKey = useMemo(() => monthKeyFromDate(monthDate), [monthDate]);
  const monthLabel = useMemo(() => format(monthDate, 'MMMM yyyy'), [monthDate]);
  const canGoPreviousMonth = useMemo(
    () => startOfMonth(monthDate).getTime() > minMonthDate.getTime(),
    [minMonthDate, monthDate]
  );

  const selectedYacht = useMemo(
    () => yachts.find((y) => y.slug === draft.yachtSlug) || null,
    [draft.yachtSlug, yachts]
  );

  const selectedDay = useMemo(
    () => (draft.date && availability ? availability.days[draft.date] || null : null),
    [availability, draft.date]
  );

  const hasAnyValidStartOnSelectedDay = useMemo(() => {
    if (!selectedDay) return false;
    return Object.values(selectedDay.validStartsByDuration).some((starts) => starts.length > 0);
  }, [selectedDay]);

  const startHourOptions = useMemo(() => {
    if (!selectedDay || !draft.requestedHours) return [];
    const key = getDurationKey(draft.requestedHours);
    if (!key) return [];
    return [...selectedDay.validStartsByDuration[key]].sort((a, b) => a - b);
  }, [selectedDay, draft.requestedHours]);

  const disabledDurationHours = useMemo(() => {
    if (!selectedDay) return [];
    const disabled: number[] = [];
    for (let h = 3; h <= 8; h += 1) {
      const key = String(h) as keyof typeof selectedDay.validStartsByDuration;
      if ((selectedDay.validStartsByDuration[key] || []).length === 0) disabled.push(h);
    }
    return disabled;
  }, [selectedDay]);

  const stepTitle = COPY.stepTitles[step];
  const stepSubtitle = COPY.stepSubtitles[step];

  const canContinue = useMemo(() => {
    if (step === 1) return !!draft.yachtSlug && (selectedYacht?.bookingReady ?? false);
    if (step === 2) return !!draft.date && hasAnyValidStartOnSelectedDay;
    if (step === 3) return !!draft.requestedHours && startHourOptions.length > 0;
    if (step === 4) return draft.startHour !== null && startHourOptions.includes(draft.startHour);
    return false;
  }, [draft.date, draft.requestedHours, draft.startHour, draft.yachtSlug, hasAnyValidStartOnSelectedDay, selectedYacht, startHourOptions, step]);

  const canSubmit = useMemo(
    () =>
      step === 5 &&
      !blockingEndpointError &&
      !!draft.yachtSlug &&
      !!draft.requestedHours &&
      !!draft.date &&
      draft.startHour !== null &&
      !!draft.attendeeName.trim() &&
      !!draft.attendeeEmail.trim() &&
      (!turnstileSiteKey || !!cfToken),
    [blockingEndpointError, cfToken, draft, step]
  );

  const loadYachts = useCallback(async () => {
    setLoadingYachts(true);
    setYachtsError(null);

    try {
      const [yachtsResult, imagesResult] = await Promise.all([
        supabase
          .from('yachts')
          .select('id,name,slug,vessel_type,capacity,booking_mode,booking_public_enabled,cal_event_type_id,display_order,is_flagship')
          .eq('booking_public_enabled', true)
          .eq('booking_mode', 'policy_v2')
          .not('cal_event_type_id', 'is', null)
          .order('display_order', { ascending: true }),
        supabase
          .from('yacht_images')
          .select('yacht_id,image_url,is_primary,display_order')
          .order('display_order', { ascending: true }),
      ]);

      if (yachtsResult.error) throw yachtsResult.error;

      const imagesByYacht = new Map<string, string>();
      for (const img of imagesResult.data || []) {
        if (!imagesByYacht.has(img.yacht_id)) imagesByYacht.set(img.yacht_id, img.image_url);
        if (img.is_primary) imagesByYacht.set(img.yacht_id, img.image_url);
      }

      const rows = (yachtsResult.data || []).map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        vessel_type: row.vessel_type,
        capacity: row.capacity,
        imageUrl: imagesByYacht.get(row.id),
        isFlagship: row.is_flagship || false,
        bookingReady: true,
      }));

      setYachts(rows);
    } catch (error) {
      console.error('Failed to load yachts:', error);
      setYachtsError(COPY.yachtsError);
    } finally {
      setLoadingYachts(false);
    }
  }, []);

  const loadAvailability = useCallback(async () => {
    if (!draft.yachtSlug) {
      setAvailability(null);
      return;
    }
    setLoadingAvailability(true);
    setAvailabilityError(null);

    try {
      const response = await fetch(
        `${apiBase}/public-booking-availability?slug=${encodeURIComponent(draft.yachtSlug)}&month=${monthKey}`,
        {
          method: 'GET',
          headers: {
            apikey: anonKey,
            'Content-Type': 'application/json',
          },
        }
      );

      const payload = (await response.json().catch(() => ({}))) as AvailabilityResponse;

      if (!response.ok) {
        if (isEndpointUnavailable(response.status, payload.error)) {
          setBlockingEndpointError(COPY.endpointNotReady);
          setAvailabilityError(COPY.endpointNotReady);
          setAvailability(null);
          return;
        }
        throw new Error(payload.error || COPY.availabilityError);
      }

      setBlockingEndpointError(null);
      setAvailability(payload);
    } catch (error) {
      console.error('Failed to load availability:', error);
      const message = error instanceof Error ? error.message : COPY.availabilityError;
      setAvailabilityError(message);
      setAvailability(null);
    } finally {
      setLoadingAvailability(false);
    }
  }, [draft.yachtSlug, monthKey]);

  useEffect(() => {
    void loadYachts();
  }, [loadYachts]);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  useEffect(() => {
    if (!draft.date || !draft.requestedHours) {
      if (draft.startHour !== null) setDraft((prev) => ({ ...prev, startHour: null }));
      return;
    }
    if (startHourOptions.length === 0) {
      if (draft.startHour !== null) setDraft((prev) => ({ ...prev, startHour: null }));
      return;
    }
    if (draft.startHour === null || !startHourOptions.includes(draft.startHour)) {
      setDraft((prev) => ({ ...prev, startHour: startHourOptions[0] }));
    }
  }, [draft.date, draft.requestedHours, draft.startHour, startHourOptions]);

  useEffect(() => {
    if (!draft.requestedHours) return;
    if (!disabledDurationHours.includes(draft.requestedHours)) return;
    setDraft((prev) => ({ ...prev, requestedHours: null, startHour: null }));
  }, [disabledDurationHours, draft.requestedHours]);

  const clearClientFields = () => ({
    attendeeName: '',
    attendeeEmail: '',
    attendeePhone: '',
    notes: '',
  });

  const handleSelectYacht = (slug: string) => {
    setDraft({ ...INITIAL_DRAFT, yachtSlug: slug });
    setStep(1);
    setMonthDate(new Date());
    setConfirmation(null);
    setSubmitInlineError(null);
  };

  const handleSelectDate = (date: string) => {
    setDraft((prev) => ({
      ...prev,
      date,
      requestedHours: null,
      startHour: null,
      ...clearClientFields(),
    }));
    setSubmitInlineError(null);
  };

  const handleSelectDuration = (hours: number) => {
    setDraft((prev) => ({
      ...prev,
      requestedHours: hours,
      startHour: null,
      ...clearClientFields(),
    }));
    setSubmitInlineError(null);
  };

  const handleContinue = () => {
    if (!canContinue) return;
    setStep((prev) => (prev >= TOTAL_STEPS ? prev : ((prev + 1) as WizardStep)));
  };

  const handleBack = () => {
    setStep((prev) => (prev <= 1 ? prev : ((prev - 1) as WizardStep)));
  };

  const handleSubmit = async () => {
    if (!canSubmit || !draft.yachtSlug || !draft.requestedHours || !draft.date || draft.startHour === null) {
      return;
    }

    setSubmitting(true);
    setSubmitInlineError(null);

    try {
      const response = await fetch(`${apiBase}/public-booking-create`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slug: draft.yachtSlug,
          date: draft.date,
          requestedHours: draft.requestedHours,
          startHour: draft.startHour,
          attendee: {
            name: draft.attendeeName.trim(),
            email: draft.attendeeEmail.trim().toLowerCase(),
            phoneNumber: draft.attendeePhone.trim() || undefined,
          },
          notes: draft.notes.trim(),
          cfToken,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as CreateBookingResponse;

      if (!response.ok) {
        if (isEndpointUnavailable(response.status, payload.error)) {
          setBlockingEndpointError(COPY.endpointNotReady);
          setSubmitInlineError(COPY.endpointNotReady);
          return;
        }
        if (response.status === 409) {
          await loadAvailability();
          setStep(4);
          setSubmitInlineError(`${payload.error || COPY.submitError} ${COPY.slotConflictHelp}`);
          return;
        }
        setSubmitInlineError(payload.error || COPY.submitError);
        return;
      }

      const endHour = draft.startHour + draft.requestedHours;
      const shiftFit = getShiftFit(draft.startHour, endHour);
      const segment = getSegmentLabelFromShiftFit(shiftFit) as 'AM' | 'PM' | 'FLEXIBLE';
      const transactionId = payload.transactionId || payload.bookingUid || payload.requestId;
      const timeRange = getTimeRangeLabel(draft.requestedHours, draft.startHour);

      // Best-effort Netlify Form post for email notification. Booking is the
      // source of truth — if this fails we still surface the success state and
      // flag a delayed-notification warning.
      let notificationDelayed = false;
      try {
        await submitToNetlifyForm('reservation', {
          yacht_slug: draft.yachtSlug,
          yacht_name: selectedYacht?.name || draft.yachtSlug,
          date: draft.date,
          start_time: format(new Date(0, 0, 0, draft.startHour), 'h:mm a'),
          end_time: format(new Date(0, 0, 0, endHour), 'h:mm a'),
          duration_hours: draft.requestedHours,
          guest_name: draft.attendeeName.trim(),
          guest_email: draft.attendeeEmail.trim().toLowerCase(),
          guest_phone: draft.attendeePhone.trim(),
          notes: draft.notes.trim(),
          cal_booking_id: payload.bookingUid || '',
          transaction_id: transactionId,
        });
      } catch (notifyError) {
        notificationDelayed = true;
        console.warn('Netlify form notification failed:', notifyError);
      }

      const confirmationDetails: ConfirmationState = {
        submittedAt: new Date().toISOString(),
        transactionId,
        bookingUid: payload.bookingUid,
        status: payload.status,
        yachtName: selectedYacht?.name || draft.yachtSlug,
        yachtSlug: draft.yachtSlug,
        date: draft.date,
        requestedHours: draft.requestedHours,
        startHour: draft.startHour,
        endHour,
        shiftFit,
        segment,
        timeRange,
        timezone: availability?.timezone || BOOKING_TIMEZONE,
        attendeeName: draft.attendeeName.trim(),
        attendeeEmail: draft.attendeeEmail.trim().toLowerCase(),
        attendeePhone: draft.attendeePhone.trim() || null,
        notes: draft.notes.trim(),
        notificationDelayed,
      };

      setConfirmation(confirmationDetails);

      toast({
        title: COPY.bookingSubmittedTitle,
        description: notificationDelayed ? COPY.notificationDelayed : COPY.bookingSubmittedDescription,
      });

      await loadAvailability();
    } catch (error) {
      const message = error instanceof Error ? error.message : COPY.submitError;
      setSubmitInlineError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetWizard = () => {
    setDraft(INITIAL_DRAFT);
    setStep(1);
    setMonthDate(new Date());
    setConfirmation(null);
    setAvailability(null);
    setAvailabilityError(null);
    setSubmitInlineError(null);
    setCfToken(null);
  };

  const clientSummary = useMemo(() => {
    if (!selectedYacht || !draft.requestedHours || !draft.date || draft.startHour === null) return '-';
    const endHour = draft.startHour + draft.requestedHours;
    const shiftFit = getShiftFit(draft.startHour, endHour);
    const shiftLabel = shiftFit === 'morning' ? COPY.shiftMorning : shiftFit === 'afternoon' ? COPY.shiftAfternoon : COPY.shiftFlexible;
    return `${selectedYacht.name} • ${draft.date} • ${getTimeRangeLabel(draft.requestedHours, draft.startHour)} • ${COPY.shiftFitLabel}: ${shiftLabel}`;
  }, [draft.date, draft.requestedHours, draft.startHour, selectedYacht]);

  const confirmationShiftLabel = useMemo(() => {
    if (!confirmation) return COPY.confirmationNotAvailable;
    if (confirmation.shiftFit === 'morning') return COPY.shiftMorning;
    if (confirmation.shiftFit === 'afternoon') return COPY.shiftAfternoon;
    return COPY.shiftFlexible;
  }, [confirmation]);

  const handleCopyReservation = async () => {
    if (!confirmation) return;
    try {
      await navigator.clipboard.writeText(buildReservationReportText(confirmation));
      toast({
        title: COPY.confirmationCopiedTitle,
        description: COPY.confirmationCopiedDescription,
      });
    } catch {
      toast({ variant: 'destructive', title: COPY.submitError });
    }
  };

  const confirmationWhatsAppHref = useMemo(() => {
    if (!confirmation) return '#';
    return `https://wa.me/${RICARDO_PHONE_E164}?text=${encodeURIComponent(buildRicardoWhatsAppText(confirmation))}`;
  }, [confirmation]);

  return (
    <HeroBackdrop>
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-8 md:px-6 md:py-12">
        <Link
          to="/reserve"
          className="inline-flex items-center gap-2 self-start text-sm text-white/80 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="mt-4 mb-6 text-white">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{COPY.title}</h1>
          <p className="mt-2 text-sm text-white/75 md:text-base">{COPY.subtitle}</p>
        </div>

        {blockingEndpointError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>{COPY.endpointNotReadyTitle}</AlertTitle>
            <AlertDescription>{blockingEndpointError}</AlertDescription>
          </Alert>
        )}

        {confirmation ? (
          <Card className="overflow-hidden border-emerald-500/40 bg-card/95 shadow-2xl backdrop-blur-xl">
            <CardHeader className="border-b border-emerald-500/20 bg-emerald-500/5">
              <CardTitle className="flex items-center gap-2 text-xl">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                {COPY.confirmationPageTitle}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{COPY.confirmationPageSubtitle}</p>
            </CardHeader>
            <CardContent className="space-y-5 p-5 md:p-6">
              {confirmation.notificationDelayed && (
                <Alert>
                  <AlertTitle>Confirmation email may be delayed</AlertTitle>
                  <AlertDescription>
                    Your booking is confirmed, but our notification system was briefly unavailable.
                    The team will see your booking in the calendar regardless — copy the details below
                    if you'd like to share directly.
                  </AlertDescription>
                </Alert>
              )}

              <div className="rounded-xl border border-border/70 bg-background/90 p-4">
                <p className="text-sm font-semibold text-foreground">{COPY.confirmationRicardoTitle}</p>
                <p className="mt-1 text-sm text-muted-foreground">{COPY.confirmationRicardoDescription}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild>
                    <a href={confirmationWhatsAppHref} target="_blank" rel="noreferrer">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      {COPY.confirmationWhatsAppCta}
                    </a>
                  </Button>
                  <Button asChild variant="outline">
                    <a href={`tel:+${RICARDO_PHONE_E164}`}>
                      <Phone className="mr-2 h-4 w-4" />
                      {COPY.confirmationCallCta}
                    </a>
                  </Button>
                  <Button variant="secondary" onClick={handleCopyReservation}>
                    <ClipboardCopy className="mr-2 h-4 w-4" />
                    {COPY.confirmationCopyCta}
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-background/80 p-4">
                  <p className="mb-3 text-sm font-semibold text-foreground">{COPY.confirmationMetaTitle}</p>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">{COPY.confirmationSubmittedAt}:</span> {format(new Date(confirmation.submittedAt), 'MMM d, yyyy h:mm a')}</p>
                    <p><span className="font-medium">{COPY.confirmationTransactionId}:</span> {confirmation.transactionId}</p>
                    <p><span className="font-medium">{COPY.confirmationBookingUid}:</span> {confirmation.bookingUid || COPY.confirmationNotAvailable}</p>
                    <p><span className="font-medium">{COPY.confirmationStatus}:</span> {confirmation.status}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-background/80 p-4">
                  <p className="mb-3 text-sm font-semibold text-foreground">{COPY.confirmationDetailsTitle}</p>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">{COPY.confirmationBoat}:</span> {confirmation.yachtName}</p>
                    <p><span className="font-medium">{COPY.confirmationDate}:</span> {confirmation.date}</p>
                    <p><span className="font-medium">{COPY.confirmationTime}:</span> {confirmation.timeRange}</p>
                    <p><span className="font-medium">{COPY.confirmationDuration}:</span> {confirmation.requestedHours} {COPY.hoursUnit}</p>
                    <p><span className="font-medium">{COPY.confirmationShift}:</span> {confirmationShiftLabel}</p>
                    <p><span className="font-medium">{COPY.confirmationSegment}:</span> {confirmation.segment}</p>
                    <p><span className="font-medium">{COPY.confirmationTimezone}:</span> {confirmation.timezone}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-background/80 p-4">
                <p className="mb-3 text-sm font-semibold text-foreground">{COPY.confirmationClientTitle}</p>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">{COPY.confirmationClientName}:</span> {confirmation.attendeeName}</p>
                  <p><span className="font-medium">{COPY.confirmationClientEmail}:</span> {confirmation.attendeeEmail}</p>
                  <p><span className="font-medium">{COPY.confirmationClientPhone}:</span> {confirmation.attendeePhone || COPY.confirmationNotAvailable}</p>
                  <p><span className="font-medium">{COPY.confirmationNotes}:</span> {confirmation.notes || COPY.confirmationNotAvailable}</p>
                </div>
              </div>

              <Button variant="outline" onClick={resetWizard}>{COPY.clearSuccess}</Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-white/30 bg-card/95 shadow-2xl backdrop-blur-xl">
            <CardHeader>
              <CardTitle>{stepTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <BookingWizard
                step={step}
                totalSteps={TOTAL_STEPS}
                title={stepTitle}
                subtitle={stepSubtitle}
                stepLabel={COPY.stepLabel}
                ofLabel={COPY.ofLabel}
                backLabel={COPY.back}
                continueLabel={COPY.continue}
                submitLabel={COPY.submit}
                submittingLabel={COPY.submitting}
                canGoBack={step > 1}
                canContinue={canContinue}
                canSubmit={canSubmit}
                isSubmitting={submitting}
                onBack={handleBack}
                onContinue={handleContinue}
                onSubmit={handleSubmit}
              >
                {step === 1 && (
                  <StepYacht
                    yachts={yachts}
                    selectedYachtSlug={draft.yachtSlug}
                    loading={loadingYachts}
                    error={yachtsError}
                    emptyLabel={COPY.yachtsEmpty}
                    capacityLabel={COPY.capacityLabel}
                    retryLabel={COPY.retry}
                    onRetry={() => void loadYachts()}
                    onSelect={handleSelectYacht}
                  />
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    {loadingAvailability && (
                      <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-60 w-full" />
                      </div>
                    )}

                    {availabilityError && !loadingAvailability && (
                      <Alert variant="destructive">
                        <AlertTitle>{COPY.availabilityError}</AlertTitle>
                        <AlertDescription>{availabilityError}</AlertDescription>
                      </Alert>
                    )}

                    {!loadingAvailability && availability && (
                      <StepDay
                        monthDate={monthDate}
                        days={availability.days}
                        selectedDate={draft.date}
                        minDateKey={todayDateKey}
                        canGoPreviousMonth={canGoPreviousMonth}
                        copy={{
                          weekdayLabels: COPY.weekdayLabels,
                          previousMonth: COPY.previousMonth,
                          nextMonth: COPY.nextMonth,
                          monthLabel,
                          noDaysAvailable: COPY.noDaysAvailable,
                        }}
                        onPreviousMonth={() =>
                          setMonthDate((current) => {
                            const previous = addMonths(current, -1);
                            if (startOfMonth(previous).getTime() < minMonthDate.getTime()) return current;
                            return previous;
                          })
                        }
                        onNextMonth={() => setMonthDate((current) => addMonths(current, 1))}
                        onSelectDate={handleSelectDate}
                      />
                    )}
                  </div>
                )}

                {step === 3 && (
                  <StepDuration
                    requestedHours={draft.requestedHours}
                    disabledHours={disabledDurationHours}
                    onSelectHours={handleSelectDuration}
                    hoursLabel={COPY.hoursUnit}
                    helperCopy={{
                      defaultText: COPY.durationDefault,
                      threeHours: COPY.duration3,
                      fourHours: COPY.duration4,
                      fivePlusHours: COPY.duration5,
                    }}
                  />
                )}

                {step === 4 && draft.requestedHours && (
                  <StepStartTimes
                    requestedHours={draft.requestedHours}
                    selectedDate={draft.date}
                    selectedStartHour={draft.startHour}
                    startHourOptions={startHourOptions}
                    copy={{
                      timeSectionTitle: COPY.timeSectionTitle,
                      selectDateHint: COPY.selectDateHint,
                      noTimesForDate: COPY.noTimesForDate,
                      selectedTripLabel: COPY.selectedTripLabel,
                      shiftFitLabel: COPY.shiftFitLabel,
                      shiftMorning: COPY.shiftMorning,
                      shiftAfternoon: COPY.shiftAfternoon,
                      shiftFlexible: COPY.shiftFlexible,
                    }}
                    onSelectStartHour={(hour) => setDraft((prev) => ({ ...prev, startHour: hour }))}
                  />
                )}

                {step === 5 && (
                  <div className="space-y-4">
                    {submitInlineError && (
                      <Alert variant="destructive">
                        <AlertTitle>{COPY.submitError}</AlertTitle>
                        <AlertDescription>{submitInlineError}</AlertDescription>
                      </Alert>
                    )}

                    <StepClient
                      summary={clientSummary}
                      copy={{
                        summaryLabel: COPY.summaryLabel,
                        nameLabel: COPY.nameLabel,
                        namePlaceholder: COPY.namePlaceholder,
                        emailLabel: COPY.emailLabel,
                        emailPlaceholder: COPY.emailPlaceholder,
                        phoneLabel: COPY.phoneLabel,
                        phonePlaceholder: COPY.phonePlaceholder,
                        notesLabel: COPY.notesLabel,
                        notesPlaceholder: COPY.notesPlaceholder,
                      }}
                      attendeeName={draft.attendeeName}
                      attendeeEmail={draft.attendeeEmail}
                      attendeePhone={draft.attendeePhone}
                      notes={draft.notes}
                      onAttendeeNameChange={(value) => setDraft((prev) => ({ ...prev, attendeeName: value }))}
                      onAttendeeEmailChange={(value) => setDraft((prev) => ({ ...prev, attendeeEmail: value }))}
                      onAttendeePhoneChange={(value) => setDraft((prev) => ({ ...prev, attendeePhone: value }))}
                      onNotesChange={(value) => setDraft((prev) => ({ ...prev, notes: value }))}
                    />

                    {turnstileSiteKey && (
                      <div className="rounded-md border border-border/60 bg-muted/30 p-3">
                        <p className="mb-2 text-xs text-muted-foreground">{COPY.turnstileNote}</p>
                        <TurnstileWidget siteKey={turnstileSiteKey} onTokenChange={setCfToken} />
                      </div>
                    )}
                  </div>
                )}
              </BookingWizard>
            </CardContent>
          </Card>
        )}
      </div>
    </HeroBackdrop>
  );
}
