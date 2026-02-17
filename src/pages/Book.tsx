import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addMonths, format, startOfMonth } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import DashboardLayout from '@/components/layout/DashboardLayout';
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
import { CheckCircle2, ClipboardCopy, MessageCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import {
  BOOKING_TIMEZONE,
  DayAvailability,
  getDurationKey,
  getSegmentLabelFromShiftFit,
  getShiftFit,
  getTimeRangeLabel,
} from '@/lib/bookingPolicy';

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
  constraints: {
    minHours: number;
    maxHours: number;
    timeStepMinutes: number;
    operatingWindow: string;
    morningWindow: string;
    bufferWindow: string;
    afternoonWindow: string;
  };
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
const RICARDO_PHONE_E164 = '526242664411';
const RICARDO_PHONE_DISPLAY = '+52 624 266 4411';

const COPY = {
  en: {
    title: 'Book',
    subtitle: 'Simple internal booking flow for the team.',
    stepLabel: 'Step',
    ofLabel: 'of',
    back: 'Back',
    continue: 'Continue',
    submit: 'Submit booking',
    submitting: 'Submitting...',
    retry: 'Retry',
    yachtsError: 'Failed to load yachts. Please try again.',
    yachtsEmpty: 'No yachts are currently ready for internal booking.',
    availabilityError: 'Could not load availability for this yacht. Try again.',
    endpointNotReady:
      'Internal booking backend is not ready yet. Ask backend to deploy internal-booking-availability and internal-booking-create.',
    endpointNotReadyTitle: 'Booking backend unavailable',
    preselectInvalid:
      'This yacht is not currently eligible for internal booking. Choose another yacht or update booking settings.',
    submitError: 'Unable to submit this booking. Please try again.',
    slotConflictHelp: 'That start time is no longer available. Please choose another start time.',
    sessionExpired: 'Your session expired. Please sign in again.',
    bookingSubmittedTitle: 'Booking submitted',
    bookingSubmittedDescription: 'Booking created successfully.',
    confirmationPageTitle: 'Booking Confirmed',
    confirmationPageSubtitle: 'Everything is booked. Share this confirmation with Ricardo to close the loop.',
    confirmationRicardoTitle: 'Send to Ricardo',
    confirmationRicardoDescription: `Notify Ricardo on WhatsApp at ${RICARDO_PHONE_DISPLAY}.`,
    confirmationWhatsAppCta: 'WhatsApp Ricardo',
    confirmationCopyCta: 'Copy reservation',
    confirmationCopiedTitle: 'Reservation copied',
    confirmationCopiedDescription: 'All booking details copied to clipboard.',
    confirmationDetailsTitle: 'Reservation details',
    confirmationClientTitle: 'Client details',
    confirmationMetaTitle: 'Booking status',
    confirmationSubmittedAt: 'Submitted',
    confirmationTransactionId: 'Transaction ID',
    confirmationBookingUid: 'Booking UID',
    confirmationStatus: 'Status',
    confirmationBoat: 'Boat',
    confirmationDate: 'Date',
    confirmationTime: 'Time',
    confirmationDuration: 'Duration',
    confirmationShift: 'Shift fit',
    confirmationSegment: 'Segment',
    confirmationTimezone: 'Timezone',
    confirmationClientName: 'Name',
    confirmationClientEmail: 'Email',
    confirmationClientPhone: 'Phone',
    confirmationNotes: 'Notes',
    confirmationNotAvailable: 'N/A',
    clearSuccess: 'Start another booking',
    noDaysAvailable: 'No available days in this month. Try another month.',
    hoursUnit: 'hours',
    capacityLabel: 'Capacity',
    stepTitles: {
      1: 'Choose a yacht',
      2: 'Choose a day',
      3: 'Choose trip length',
      4: 'Choose start time',
      5: 'Client details',
    },
    stepSubtitles: {
      1: 'Pick the boat first.',
      2: 'Tap a date to continue.',
      3: 'Choose how many hours.',
      4: 'Pick a start time button.',
      5: 'Fill in client info and submit.',
    },
    durationDefault: 'Select a trip length to continue.',
    duration3: '3-hour trips must stay in morning or afternoon windows.',
    duration4: '4-hour trips must fit in the morning window.',
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
    nameLabel: 'Client name',
    namePlaceholder: 'Full name',
    emailLabel: 'Client email',
    emailPlaceholder: 'email@example.com',
    phoneLabel: 'Phone (optional)',
    phonePlaceholder: '+52...',
    notesLabel: 'Notes (optional)',
    notesPlaceholder: 'Special requests, preferences, or reminders',
  },
  es: {
    title: 'Reservar',
    subtitle: 'Flujo interno de reservas simple para el equipo.',
    stepLabel: 'Paso',
    ofLabel: 'de',
    back: 'Atrás',
    continue: 'Continuar',
    submit: 'Enviar reserva',
    submitting: 'Enviando...',
    retry: 'Reintentar',
    yachtsError: 'No se pudieron cargar los yates. Intenta de nuevo.',
    yachtsEmpty: 'No hay yates listos para reservas internas en este momento.',
    availabilityError: 'No se pudo cargar la disponibilidad de este yate. Intenta de nuevo.',
    endpointNotReady:
      'El backend interno de reservas no está listo. Pide al backend desplegar internal-booking-availability y internal-booking-create.',
    endpointNotReadyTitle: 'Backend de reservas no disponible',
    preselectInvalid:
      'Este yate no está listo para reservas internas. Elige otro yate o actualiza su configuración de reservas.',
    submitError: 'No se pudo enviar la reserva. Intenta de nuevo.',
    slotConflictHelp: 'Esa hora de inicio ya no está disponible. Elige otra hora de inicio.',
    sessionExpired: 'Tu sesión expiró. Inicia sesión de nuevo.',
    bookingSubmittedTitle: 'Reserva enviada',
    bookingSubmittedDescription: 'La reserva se creó correctamente.',
    confirmationPageTitle: 'Reserva confirmada',
    confirmationPageSubtitle: 'Todo quedó reservado. Comparte esta confirmación con Ricardo para cerrar el proceso.',
    confirmationRicardoTitle: 'Enviar a Ricardo',
    confirmationRicardoDescription: `Notifica a Ricardo por WhatsApp al ${RICARDO_PHONE_DISPLAY}.`,
    confirmationWhatsAppCta: 'WhatsApp Ricardo',
    confirmationCopyCta: 'Copiar reserva',
    confirmationCopiedTitle: 'Reserva copiada',
    confirmationCopiedDescription: 'Se copiaron todos los detalles al portapapeles.',
    confirmationDetailsTitle: 'Detalles de la reserva',
    confirmationClientTitle: 'Datos del cliente',
    confirmationMetaTitle: 'Estado de la reserva',
    confirmationSubmittedAt: 'Enviada',
    confirmationTransactionId: 'ID de transacción',
    confirmationBookingUid: 'Booking UID',
    confirmationStatus: 'Estado',
    confirmationBoat: 'Yate',
    confirmationDate: 'Fecha',
    confirmationTime: 'Hora',
    confirmationDuration: 'Duración',
    confirmationShift: 'Turno',
    confirmationSegment: 'Segmento',
    confirmationTimezone: 'Zona horaria',
    confirmationClientName: 'Nombre',
    confirmationClientEmail: 'Correo',
    confirmationClientPhone: 'Teléfono',
    confirmationNotes: 'Notas',
    confirmationNotAvailable: 'N/D',
    clearSuccess: 'Crear otra reserva',
    noDaysAvailable: 'No hay días disponibles en este mes. Prueba otro mes.',
    hoursUnit: 'horas',
    capacityLabel: 'Capacidad',
    stepTitles: {
      1: 'Elige un yate',
      2: 'Elige un día',
      3: 'Elige duración del viaje',
      4: 'Elige hora de inicio',
      5: 'Datos del cliente',
    },
    stepSubtitles: {
      1: 'Primero selecciona el barco.',
      2: 'Toca una fecha para continuar.',
      3: 'Elige cuántas horas.',
      4: 'Selecciona una hora de inicio.',
      5: 'Completa los datos del cliente y envía.',
    },
    durationDefault: 'Selecciona una duración para continuar.',
    duration3: 'Los viajes de 3 horas deben quedar en la mañana o en la tarde.',
    duration4: 'Los viajes de 4 horas deben quedar en la mañana.',
    duration5: 'Los viajes de 5+ horas pueden iniciar a cualquier hora si terminan antes de las 6:00 PM.',
    previousMonth: 'Anterior',
    nextMonth: 'Siguiente',
    timeSectionTitle: 'Horas de inicio disponibles',
    selectDateHint: 'Selecciona una fecha para ver horas de inicio.',
    noTimesForDate: 'No hay horas de inicio para esta fecha y duración.',
    selectedTripLabel: 'Viaje seleccionado',
    shiftFitLabel: 'Turno',
    shiftMorning: 'Mañana',
    shiftAfternoon: 'Tarde',
    shiftFlexible: 'Flexible',
    weekdayLabels: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    summaryLabel: 'Resumen de reserva',
    nameLabel: 'Nombre del cliente',
    namePlaceholder: 'Nombre completo',
    emailLabel: 'Correo del cliente',
    emailPlaceholder: 'correo@ejemplo.com',
    phoneLabel: 'Teléfono (opcional)',
    phonePlaceholder: '+52...',
    notesLabel: 'Notas (opcional)',
    notesPlaceholder: 'Solicitudes especiales, preferencias o recordatorios',
  },
} as const;

const monthKeyFromDate = (date: Date) => format(date, 'yyyy-MM');

const buildReservationReportText = (details: ConfirmationState) =>
  [
    'Prestige Yachts - Internal Booking Confirmation',
    `Transaction ID: ${details.transactionId}`,
    `Booking UID: ${details.bookingUid || 'N/A'}`,
    `Status: ${details.status}`,
    `Boat: ${details.yachtName} (${details.yachtSlug})`,
    `Date: ${details.date}`,
    `Time: ${details.timeRange} (${details.timezone})`,
    `Requested Hours: ${details.requestedHours}`,
    `Shift Fit: ${details.shiftFit}`,
    `Segment: ${details.segment}`,
    `Client Name: ${details.attendeeName}`,
    `Client Email: ${details.attendeeEmail}`,
    `Client Phone: ${details.attendeePhone || 'N/A'}`,
    `Notes: ${details.notes || 'N/A'}`,
    `Submitted At: ${details.submittedAt}`,
    `Ricardo Contact: ${RICARDO_PHONE_DISPLAY}`,
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
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) return format(date, 'yyyy-MM-dd');
  return `${year}-${month}-${day}`;
};

export default function Book() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const { trackEvent } = useActivityTracker();
  const [searchParams] = useSearchParams();
  const copy = COPY[language];
  const dateLocale = language === 'es' ? es : enUS;

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
  const [preselectMessage, setPreselectMessage] = useState<string | null>(null);
  const [blockingEndpointError, setBlockingEndpointError] = useState<string | null>(null);
  const [submitInlineError, setSubmitInlineError] = useState<string | null>(null);
  const [hasAppliedQueryPreselect, setHasAppliedQueryPreselect] = useState(false);

  const preselectedYachtSlug = useMemo(
    () => searchParams.get('yacht')?.trim() || null,
    [searchParams]
  );
  const preselectedStep = useMemo(
    () => searchParams.get('step')?.trim().toLowerCase() || null,
    [searchParams]
  );

  const todayDateKey = useMemo(() => getDateKeyInTimeZone(new Date(), BOOKING_TIMEZONE), []);

  const minMonthDate = useMemo(() => {
    const [yearRaw, monthRaw] = todayDateKey.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    return new Date(year, month - 1, 1);
  }, [todayDateKey]);

  const monthKey = useMemo(() => monthKeyFromDate(monthDate), [monthDate]);

  const monthLabel = useMemo(() => {
    const label = format(monthDate, 'MMMM yyyy', { locale: dateLocale });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [dateLocale, monthDate]);

  const canGoPreviousMonth = useMemo(
    () => startOfMonth(monthDate).getTime() > minMonthDate.getTime(),
    [minMonthDate, monthDate]
  );

  const selectedYacht = useMemo(
    () => yachts.find((yacht) => yacht.slug === draft.yachtSlug) || null,
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
    const durationKey = getDurationKey(draft.requestedHours);
    if (!durationKey) return [];
    return [...selectedDay.validStartsByDuration[durationKey]].sort((a, b) => a - b);
  }, [selectedDay, draft.requestedHours]);

  const disabledDurationHours = useMemo(() => {
    if (!selectedDay) return [];

    const disabled: number[] = [];
    for (let hours = 3; hours <= 8; hours += 1) {
      const durationKey = String(hours) as keyof typeof selectedDay.validStartsByDuration;
      const starts = selectedDay.validStartsByDuration[durationKey] || [];
      if (starts.length === 0) {
        disabled.push(hours);
      }
    }
    return disabled;
  }, [selectedDay]);

  const stepTitle = copy.stepTitles[step];
  const stepSubtitle = copy.stepSubtitles[step];

  const canContinue = useMemo(() => {
    if (step === 1) return !!draft.yachtSlug;
    if (step === 2) return !!draft.date && hasAnyValidStartOnSelectedDay;
    if (step === 3) return !!draft.requestedHours && startHourOptions.length > 0;
    if (step === 4) return draft.startHour !== null && startHourOptions.includes(draft.startHour);
    return false;
  }, [
    draft.date,
    draft.requestedHours,
    draft.startHour,
    draft.yachtSlug,
    hasAnyValidStartOnSelectedDay,
    startHourOptions,
    step,
  ]);

  const canSubmit = useMemo(
    () =>
      step === 5 &&
      !blockingEndpointError &&
      !!draft.yachtSlug &&
      !!draft.requestedHours &&
      !!draft.date &&
      draft.startHour !== null &&
      !!draft.attendeeName.trim() &&
      !!draft.attendeeEmail.trim(),
    [blockingEndpointError, draft, step]
  );

  const loadYachts = useCallback(async () => {
    setLoadingYachts(true);
    setYachtsError(null);

    try {
      const [yachtsResult, imagesResult] = await Promise.all([
        supabase
          .from('yachts')
          .select('id,name,slug,vessel_type,capacity,booking_mode,cal_event_type_id,display_order,is_flagship')
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
        if (!imagesByYacht.has(img.yacht_id)) {
          imagesByYacht.set(img.yacht_id, img.image_url);
        }
        if (img.is_primary) {
          imagesByYacht.set(img.yacht_id, img.image_url);
        }
      }

      const rows = (yachtsResult.data || []).map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        vessel_type: row.vessel_type,
        capacity: row.capacity,
        imageUrl: imagesByYacht.get(row.id),
        isFlagship: row.is_flagship || false,
      }));

      setYachts(rows);
    } catch (error) {
      console.error('Failed to load yachts:', error);
      setYachtsError(copy.yachtsError);
    } finally {
      setLoadingYachts(false);
    }
  }, [copy.yachtsError]);

  const loadAvailability = useCallback(async () => {
    if (!draft.yachtSlug) {
      setAvailability(null);
      return;
    }

    setLoadingAvailability(true);
    setAvailabilityError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        setBlockingEndpointError(copy.sessionExpired);
        setAvailabilityError(copy.sessionExpired);
        setAvailability(null);
        return;
      }

      const response = await fetch(
        `${apiBase}/internal-booking-availability?slug=${encodeURIComponent(draft.yachtSlug)}&month=${monthKey}`,
        {
          method: 'GET',
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const payload = (await response.json().catch(() => ({}))) as AvailabilityResponse;

      if (!response.ok) {
        if (isEndpointUnavailable(response.status, payload.error)) {
          setBlockingEndpointError(copy.endpointNotReady);
          setAvailabilityError(copy.endpointNotReady);
          setAvailability(null);
          return;
        }
        if (response.status === 401) {
          setBlockingEndpointError(copy.sessionExpired);
        }
        throw new Error(payload.error || copy.availabilityError);
      }

      setBlockingEndpointError(null);
      setAvailability(payload);
    } catch (error) {
      console.error('Failed to load availability:', error);
      const message = error instanceof Error ? error.message : copy.availabilityError;
      setAvailabilityError(message);
      setAvailability(null);
    } finally {
      setLoadingAvailability(false);
    }
  }, [copy.availabilityError, copy.endpointNotReady, copy.sessionExpired, draft.yachtSlug, monthKey]);

  useEffect(() => {
    void loadYachts();
  }, [loadYachts]);

  useEffect(() => {
    setHasAppliedQueryPreselect(false);
    setPreselectMessage(null);
  }, [preselectedStep, preselectedYachtSlug]);

  useEffect(() => {
    if (loadingYachts || hasAppliedQueryPreselect) return;
    if (!preselectedYachtSlug) {
      setHasAppliedQueryPreselect(true);
      return;
    }

    const normalizedSlug = preselectedYachtSlug.toLowerCase();
    const matchedYacht = yachts.find((yacht) => yacht.slug.toLowerCase() === normalizedSlug) || null;

    if (matchedYacht) {
      setDraft({ ...INITIAL_DRAFT, yachtSlug: matchedYacht.slug });
      setStep(preselectedStep === 'day' ? 2 : 1);
      setMonthDate(new Date());
      setPreselectMessage(null);
    } else {
      setStep(1);
      setPreselectMessage(copy.preselectInvalid);
    }

    setHasAppliedQueryPreselect(true);
  }, [
    copy.preselectInvalid,
    hasAppliedQueryPreselect,
    loadingYachts,
    preselectedStep,
    preselectedYachtSlug,
    yachts,
  ]);

  useEffect(() => {
    void trackEvent('calendar_wizard_step_viewed', {
      step,
      yacht_slug: draft.yachtSlug || '',
    });
    void trackEvent('book_wizard_step_viewed', {
      step,
      yacht_slug: draft.yachtSlug || '',
    });
  }, [draft.yachtSlug, step, trackEvent]);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  useEffect(() => {
    if (!draft.date || !draft.requestedHours) {
      if (draft.startHour !== null) {
        setDraft((prev) => ({ ...prev, startHour: null }));
      }
      return;
    }

    if (startHourOptions.length === 0) {
      if (draft.startHour !== null) {
        setDraft((prev) => ({ ...prev, startHour: null }));
      }
      return;
    }

    if (draft.startHour === null || !startHourOptions.includes(draft.startHour)) {
      setDraft((prev) => ({ ...prev, startHour: startHourOptions[0] }));
    }
  }, [draft.date, draft.requestedHours, draft.startHour, startHourOptions]);

  useEffect(() => {
    if (!draft.requestedHours) return;
    if (!disabledDurationHours.includes(draft.requestedHours)) return;

    setDraft((prev) => ({
      ...prev,
      requestedHours: null,
      startHour: null,
    }));
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
    setPreselectMessage(null);
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

    void trackEvent('calendar_wizard_step_completed', {
      step,
      yacht_slug: draft.yachtSlug || '',
      requested_hours: draft.requestedHours || 0,
    });
    void trackEvent('book_wizard_step_completed', {
      step,
      yacht_slug: draft.yachtSlug || '',
      requested_hours: draft.requestedHours || 0,
    });

    setStep((prev) => {
      if (prev >= TOTAL_STEPS) return prev;
      return (prev + 1) as WizardStep;
    });
  };

  const handleBack = () => {
    setStep((prev) => {
      if (prev <= 1) return prev;
      return (prev - 1) as WizardStep;
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit || !draft.yachtSlug || !draft.requestedHours || !draft.date || draft.startHour === null) return;
    if (blockingEndpointError) {
      setSubmitInlineError(blockingEndpointError);
      return;
    }

    setSubmitting(true);
    setSubmitInlineError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        setSubmitInlineError(copy.sessionExpired);
        return;
      }

      const response = await fetch(`${apiBase}/internal-booking-create`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
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
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as CreateBookingResponse;

      if (!response.ok) {
        if (isEndpointUnavailable(response.status, payload.error)) {
          setBlockingEndpointError(copy.endpointNotReady);
          setSubmitInlineError(copy.endpointNotReady);
          return;
        }

        if (response.status === 409) {
          await loadAvailability();
          setStep(4);
          setSubmitInlineError(`${payload.error || copy.submitError} ${copy.slotConflictHelp}`);
          return;
        }

        const message = payload.error || copy.submitError;
        setSubmitInlineError(message);
        return;
      }

      const endHour = draft.startHour + draft.requestedHours;
      const shiftFit = getShiftFit(draft.startHour, endHour);
      const segment = getSegmentLabelFromShiftFit(shiftFit) as 'AM' | 'PM' | 'FLEXIBLE';
      const transactionId = payload.transactionId || payload.bookingUid || payload.requestId;

      await trackEvent('trip_booked', {
        booking_transaction_id: transactionId,
        booking_uid: payload.bookingUid || '',
        booking_status: payload.status,
        yacht_name: selectedYacht?.name || draft.yachtSlug,
        yacht_slug: draft.yachtSlug,
        trip_date: draft.date,
        trip_time_range: getTimeRangeLabel(draft.requestedHours, draft.startHour),
        requested_hours: draft.requestedHours,
        start_hour: draft.startHour,
        end_hour: endHour,
        shift_fit: shiftFit,
        segment,
        selected_half: segment === 'AM' ? 'am' : segment === 'PM' ? 'pm' : '',
        customer_name: draft.attendeeName.trim(),
        customer_email: draft.attendeeEmail.trim().toLowerCase(),
        customer_phone: draft.attendeePhone.trim(),
      });

      await trackEvent('calendar_booking_submitted', {
        transaction_id: transactionId,
        yacht_slug: draft.yachtSlug,
        requested_hours: draft.requestedHours,
        start_hour: draft.startHour,
      });
      await trackEvent('book_booking_submitted', {
        transaction_id: transactionId,
        yacht_slug: draft.yachtSlug,
        requested_hours: draft.requestedHours,
        start_hour: draft.startHour,
      });

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
        timeRange: getTimeRangeLabel(draft.requestedHours, draft.startHour),
        timezone: availability?.timezone || BOOKING_TIMEZONE,
        attendeeName: draft.attendeeName.trim(),
        attendeeEmail: draft.attendeeEmail.trim().toLowerCase(),
        attendeePhone: draft.attendeePhone.trim() || null,
        notes: draft.notes.trim(),
      };

      setConfirmation(confirmationDetails);

      toast({
        title: copy.bookingSubmittedTitle,
        description: copy.bookingSubmittedDescription,
      });

      await loadAvailability();
    } catch (error) {
      const message = error instanceof Error ? error.message : copy.submitError;
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
    setPreselectMessage(null);
    setSubmitInlineError(null);
  };

  const clientSummary = useMemo(() => {
    if (!selectedYacht || !draft.requestedHours || !draft.date || draft.startHour === null) return '-';
    const endHour = draft.startHour + draft.requestedHours;
    const shiftFit = getShiftFit(draft.startHour, endHour);
    const shiftLabel =
      shiftFit === 'morning'
        ? copy.shiftMorning
        : shiftFit === 'afternoon'
          ? copy.shiftAfternoon
          : copy.shiftFlexible;

    return `${selectedYacht.name} • ${draft.date} • ${getTimeRangeLabel(draft.requestedHours, draft.startHour)} • ${copy.shiftFitLabel}: ${shiftLabel}`;
  }, [
    copy.shiftAfternoon,
    copy.shiftFitLabel,
    copy.shiftFlexible,
    copy.shiftMorning,
    draft.date,
    draft.requestedHours,
    draft.startHour,
    selectedYacht,
  ]);

  const confirmationShiftLabel = useMemo(() => {
    if (!confirmation) return copy.confirmationNotAvailable;
    if (confirmation.shiftFit === 'morning') return copy.shiftMorning;
    if (confirmation.shiftFit === 'afternoon') return copy.shiftAfternoon;
    return copy.shiftFlexible;
  }, [
    confirmation,
    copy.confirmationNotAvailable,
    copy.shiftAfternoon,
    copy.shiftFlexible,
    copy.shiftMorning,
  ]);

  const handleCopyReservation = async () => {
    if (!confirmation) return;
    try {
      await navigator.clipboard.writeText(buildReservationReportText(confirmation));
      toast({
        title: copy.confirmationCopiedTitle,
        description: copy.confirmationCopiedDescription,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : copy.submitError;
      toast({
        variant: 'destructive',
        title: copy.submitError,
        description: message,
      });
    }
  };

  const confirmationWhatsAppHref = useMemo(() => {
    if (!confirmation) return '#';
    return `https://wa.me/${RICARDO_PHONE_E164}?text=${encodeURIComponent(
      buildRicardoWhatsAppText(confirmation)
    )}`;
  }, [confirmation]);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-5">
        {confirmation && (
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground md:text-3xl">{copy.title}</h1>
            <p className="text-sm text-muted-foreground md:text-base">{copy.subtitle}</p>
          </div>
        )}

        {preselectMessage && (
          <Alert>
            <AlertTitle>{copy.title}</AlertTitle>
            <AlertDescription>{preselectMessage}</AlertDescription>
          </Alert>
        )}

        {blockingEndpointError && (
          <Alert variant="destructive">
            <AlertTitle>{copy.endpointNotReadyTitle}</AlertTitle>
            <AlertDescription>{blockingEndpointError}</AlertDescription>
          </Alert>
        )}

        {confirmation ? (
          <Card className="overflow-hidden border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-card to-card">
            <CardHeader className="border-b border-emerald-500/20 bg-emerald-500/5">
              <CardTitle className="flex items-center gap-2 text-xl">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                {copy.confirmationPageTitle}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{copy.confirmationPageSubtitle}</p>
            </CardHeader>
            <CardContent className="space-y-5 p-5 md:p-6">
              <div className="rounded-xl border border-border/70 bg-background/90 p-4">
                <p className="text-sm font-semibold text-foreground">{copy.confirmationRicardoTitle}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {copy.confirmationRicardoDescription}{' '}
                  <span className="font-medium text-foreground">{RICARDO_PHONE_DISPLAY}</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild>
                    <a href={confirmationWhatsAppHref} target="_blank" rel="noreferrer">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      {copy.confirmationWhatsAppCta}
                    </a>
                  </Button>
                  <Button variant="secondary" onClick={handleCopyReservation}>
                    <ClipboardCopy className="mr-2 h-4 w-4" />
                    {copy.confirmationCopyCta}
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-background/80 p-4">
                  <p className="mb-3 text-sm font-semibold text-foreground">{copy.confirmationMetaTitle}</p>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">{copy.confirmationSubmittedAt}:</span> {format(new Date(confirmation.submittedAt), 'MMM d, yyyy h:mm a', { locale: dateLocale })}</p>
                    <p><span className="font-medium">{copy.confirmationTransactionId}:</span> {confirmation.transactionId}</p>
                    <p><span className="font-medium">{copy.confirmationBookingUid}:</span> {confirmation.bookingUid || copy.confirmationNotAvailable}</p>
                    <p><span className="font-medium">{copy.confirmationStatus}:</span> {confirmation.status}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-background/80 p-4">
                  <p className="mb-3 text-sm font-semibold text-foreground">{copy.confirmationDetailsTitle}</p>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">{copy.confirmationBoat}:</span> {confirmation.yachtName}</p>
                    <p><span className="font-medium">{copy.confirmationDate}:</span> {confirmation.date}</p>
                    <p><span className="font-medium">{copy.confirmationTime}:</span> {confirmation.timeRange}</p>
                    <p><span className="font-medium">{copy.confirmationDuration}:</span> {confirmation.requestedHours} {copy.hoursUnit}</p>
                    <p><span className="font-medium">{copy.confirmationShift}:</span> {confirmationShiftLabel}</p>
                    <p><span className="font-medium">{copy.confirmationSegment}:</span> {confirmation.segment}</p>
                    <p><span className="font-medium">{copy.confirmationTimezone}:</span> {confirmation.timezone}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-background/80 p-4">
                <p className="mb-3 text-sm font-semibold text-foreground">{copy.confirmationClientTitle}</p>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">{copy.confirmationClientName}:</span> {confirmation.attendeeName}</p>
                  <p><span className="font-medium">{copy.confirmationClientEmail}:</span> {confirmation.attendeeEmail}</p>
                  <p><span className="font-medium">{copy.confirmationClientPhone}:</span> {confirmation.attendeePhone || copy.confirmationNotAvailable}</p>
                  <p><span className="font-medium">{copy.confirmationNotes}:</span> {confirmation.notes || copy.confirmationNotAvailable}</p>
                </div>
              </div>

              <Button variant="outline" onClick={resetWizard}>
                {copy.clearSuccess}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle>{stepTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <BookingWizard
                step={step}
                totalSteps={TOTAL_STEPS}
                title={stepTitle}
                subtitle={stepSubtitle}
                stepLabel={copy.stepLabel}
                ofLabel={copy.ofLabel}
                backLabel={copy.back}
                continueLabel={copy.continue}
                submitLabel={copy.submit}
                submittingLabel={copy.submitting}
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
                    emptyLabel={copy.yachtsEmpty}
                    capacityLabel={copy.capacityLabel}
                    retryLabel={copy.retry}
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
                        <AlertTitle>{copy.availabilityError}</AlertTitle>
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
                          weekdayLabels: copy.weekdayLabels,
                          previousMonth: copy.previousMonth,
                          nextMonth: copy.nextMonth,
                          monthLabel,
                          noDaysAvailable: copy.noDaysAvailable,
                        }}
                        onPreviousMonth={() =>
                          setMonthDate((current) => {
                            const previousMonth = addMonths(current, -1);
                            if (startOfMonth(previousMonth).getTime() < minMonthDate.getTime()) {
                              return current;
                            }
                            return previousMonth;
                          })
                        }
                        onNextMonth={() => setMonthDate((current) => addMonths(current, 1))}
                        onSelectDate={handleSelectDate}
                      />
                    )}
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    <StepDuration
                      requestedHours={draft.requestedHours}
                      disabledHours={disabledDurationHours}
                      onSelectHours={handleSelectDuration}
                      hoursLabel={copy.hoursUnit}
                      helperCopy={{
                        defaultText: copy.durationDefault,
                        threeHours: copy.duration3,
                        fourHours: copy.duration4,
                        fivePlusHours: copy.duration5,
                      }}
                    />
                  </div>
                )}

                {step === 4 && draft.requestedHours && (
                  <StepStartTimes
                    requestedHours={draft.requestedHours}
                    selectedDate={draft.date}
                    selectedStartHour={draft.startHour}
                    startHourOptions={startHourOptions}
                    copy={{
                      timeSectionTitle: copy.timeSectionTitle,
                      selectDateHint: copy.selectDateHint,
                      noTimesForDate: copy.noTimesForDate,
                      selectedTripLabel: copy.selectedTripLabel,
                      shiftFitLabel: copy.shiftFitLabel,
                      shiftMorning: copy.shiftMorning,
                      shiftAfternoon: copy.shiftAfternoon,
                      shiftFlexible: copy.shiftFlexible,
                    }}
                    onSelectStartHour={(hour) =>
                      setDraft((prev) => ({
                        ...prev,
                        startHour: hour,
                      }))
                    }
                  />
                )}

                {step === 5 && (
                  <div className="space-y-4">
                    {submitInlineError && (
                      <Alert variant="destructive">
                        <AlertTitle>{copy.submitError}</AlertTitle>
                        <AlertDescription>{submitInlineError}</AlertDescription>
                      </Alert>
                    )}

                    <StepClient
                      summary={clientSummary}
                      copy={{
                        summaryLabel: copy.summaryLabel,
                        nameLabel: copy.nameLabel,
                        namePlaceholder: copy.namePlaceholder,
                        emailLabel: copy.emailLabel,
                        emailPlaceholder: copy.emailPlaceholder,
                        phoneLabel: copy.phoneLabel,
                        phonePlaceholder: copy.phonePlaceholder,
                        notesLabel: copy.notesLabel,
                        notesPlaceholder: copy.notesPlaceholder,
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
                  </div>
                )}
              </BookingWizard>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
