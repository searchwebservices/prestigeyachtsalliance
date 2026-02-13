import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { addDays, addMonths, addWeeks, endOfMonth, format, startOfMonth, startOfWeek } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { supabase } from '@/integrations/supabase/client';
import { BOOKING_TIMEZONE, DayAvailability } from '@/lib/bookingPolicy';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import CalendarToolbar from '@/components/admin-calendar/CalendarToolbar';
import YachtTabs from '@/components/admin-calendar/YachtTabs';
import TimeGrid from '@/components/admin-calendar/TimeGrid';
import MonthGrid from '@/components/admin-calendar/MonthGrid';
import EventDrawer from '@/components/admin-calendar/EventDrawer';
import {
  AdminCalendarEvent,
  AdminCalendarYacht,
  CalendarActionResult,
  CalendarViewMode,
} from '@/components/admin-calendar/types';

type CalendarApiResponse = {
  requestId: string;
  timezone?: string;
  slug?: string;
  rangeStart?: string;
  rangeEnd?: string;
  events?: unknown;
  error?: string;
};

type AvailabilityApiResponse = {
  requestId: string;
  month?: string;
  timezone?: string;
  days?: Record<string, DayAvailability>;
  error?: string;
};

type CalendarActionApiResponse = {
  requestId: string;
  bookingUid?: string | null;
  transactionId?: string;
  changeMode?: string;
  error?: string;
};

type TimeMarker = {
  dateKey: string;
  minutes: number;
};

const apiBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const monthKeyFromDate = (value: Date) => format(value, 'yyyy-MM');
const parseDateKeyToDate = (dateKey: string) => {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  return new Date(year, month - 1, day);
};

const COPY = {
  en: {
    title: 'Calendar',
    subtitle: 'Admin schedule view synced from Cal.com bookings.',
    loadingAuth: 'Loading access permissions...',
    loadingYachts: 'Loading yachts...',
    loadingEvents: 'Loading bookings...',
    refresh: 'Refresh',
    today: 'Today',
    previous: 'Previous',
    next: 'Next',
    month: 'Month',
    week: 'Week',
    day: 'Day',
    emptyYachts: 'No eligible yachts are configured for calendar view.',
    emptyEvents: 'No bookings found for this yacht and date range.',
    errorTitle: 'Calendar unavailable',
    defaultError: 'Unable to load calendar data right now.',
    sessionExpired: 'Your session expired. Please sign in again.',
    endpointNotReady: 'Internal calendar endpoint is not deployed yet. Ask backend to deploy internal-calendar-bookings.',
    actionsEndpointNotReady:
      'Internal calendar actions are not deployed yet. Ask backend to deploy internal-calendar-booking-reschedule and internal-calendar-booking-cancel.',
    permissionDenied: 'You do not have permission to manage reservations.',
    staleSlotError: 'That slot is no longer available. Choose another date or start time.',
    actionSuccessRescheduledTitle: 'Reservation updated',
    actionSuccessRescheduledDescription: 'The reservation was updated successfully.',
    actionSuccessRemovedTitle: 'Reservation removed',
    actionSuccessRemovedDescription: 'The reservation was removed successfully.',
    gmtLabel: 'GMT',
    drawer: {
      titleFallback: 'Booking',
      bookingUid: 'Booking UID',
      bookingId: 'Booking ID',
      yacht: 'Yacht',
      status: 'Status',
      attendee: 'Attendee',
      attendeeEmail: 'Email',
      attendeePhone: 'Phone',
      notes: 'Notes',
      noNotes: 'No notes attached to this booking.',
      openCal: 'Open in Cal.com',
      when: 'When',
      duration: 'Duration',
      actionDeckTitle: 'Action Deck',
      actionDeckDescription: 'Manage this yacht reservation proactively from here.',
      changeReservation: 'Change reservation',
      removeReservation: 'Remove reservation',
      close: 'Close',
      rescheduleTitle: 'Change reservation',
      removeTitle: 'Remove reservation',
      removeDescription: 'This will cancel the reservation for the selected trip.',
      removeReasonLabel: 'Removal reason',
      removeReasonPlaceholder: 'Provide a clear reason for the team log...',
      removeConfirm: 'Confirm removal',
      cancelAction: 'Back',
      saveChanges: 'Save changes',
      saving: 'Saving...',
      removeInProgress: 'Removing...',
      updateInProgress: 'Updating...',
      actionUnavailable: 'This reservation does not include a booking UID, so actions are unavailable.',
      actionErrorFallback: 'Unable to complete this action. Please try again.',
      durationHoursLabel: 'hours',
      durationDefault: 'Select trip length to continue.',
      duration3: '3-hour trips stay in morning or afternoon windows.',
      duration4: '4-hour trips must stay in the morning window.',
      duration5: '5+ hour trips can start any hour that still ends by 6:00 PM.',
      timeSectionTitle: 'Available start times',
      selectDateHint: 'Select a date to see start-time buttons.',
      noTimesForDate: 'No start times available for this date and duration.',
      selectedTripLabel: 'Selected trip',
      shiftFitLabel: 'Shift',
      shiftMorning: 'Morning',
      shiftAfternoon: 'Afternoon',
      shiftFlexible: 'Flexible',
      previousMonth: 'Prev',
      nextMonth: 'Next',
      noDaysAvailable: 'No available days in this month. Try another month.',
      dayStepLabel: 'Step 1: Day',
      durationStepLabel: 'Step 2: Hours',
      timeStepLabel: 'Step 3: Start time',
      loadingAvailability: 'Loading availability...',
      availabilityErrorTitle: 'Availability unavailable',
      removeReasonRequired: 'Please provide a reason before removing this reservation.',
      weekdayLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    },
  },
  es: {
    title: 'Calendario',
    subtitle: 'Vista de agenda para admins sincronizada con reservas de Cal.com.',
    loadingAuth: 'Cargando permisos de acceso...',
    loadingYachts: 'Cargando yates...',
    loadingEvents: 'Cargando reservas...',
    refresh: 'Actualizar',
    today: 'Hoy',
    previous: 'Anterior',
    next: 'Siguiente',
    month: 'Mes',
    week: 'Semana',
    day: 'Día',
    emptyYachts: 'No hay yates elegibles configurados para la vista de calendario.',
    emptyEvents: 'No hay reservas para este yate en este rango de fechas.',
    errorTitle: 'Calendario no disponible',
    defaultError: 'No se pudieron cargar los datos del calendario.',
    sessionExpired: 'Tu sesión expiró. Inicia sesión de nuevo.',
    endpointNotReady: 'El endpoint interno de calendario no está desplegado. Pide al backend desplegar internal-calendar-bookings.',
    actionsEndpointNotReady:
      'Las acciones internas de calendario no están desplegadas. Pide al backend desplegar internal-calendar-booking-reschedule y internal-calendar-booking-cancel.',
    permissionDenied: 'No tienes permisos para gestionar reservas.',
    staleSlotError: 'Ese horario ya no está disponible. Elige otra fecha u hora de inicio.',
    actionSuccessRescheduledTitle: 'Reserva actualizada',
    actionSuccessRescheduledDescription: 'La reserva se actualizó correctamente.',
    actionSuccessRemovedTitle: 'Reserva eliminada',
    actionSuccessRemovedDescription: 'La reserva se eliminó correctamente.',
    gmtLabel: 'GMT',
    drawer: {
      titleFallback: 'Reserva',
      bookingUid: 'Booking UID',
      bookingId: 'ID de reserva',
      yacht: 'Yate',
      status: 'Estado',
      attendee: 'Asistente',
      attendeeEmail: 'Correo',
      attendeePhone: 'Teléfono',
      notes: 'Notas',
      noNotes: 'No hay notas en esta reserva.',
      openCal: 'Abrir en Cal.com',
      when: 'Horario',
      duration: 'Duración',
      actionDeckTitle: 'Panel de acciones',
      actionDeckDescription: 'Gestiona esta reserva del yate de forma proactiva desde aquí.',
      changeReservation: 'Cambiar reserva',
      removeReservation: 'Eliminar reserva',
      close: 'Cerrar',
      rescheduleTitle: 'Cambiar reserva',
      removeTitle: 'Eliminar reserva',
      removeDescription: 'Esto cancelará la reserva del viaje seleccionado.',
      removeReasonLabel: 'Motivo de eliminación',
      removeReasonPlaceholder: 'Escribe un motivo claro para el registro del equipo...',
      removeConfirm: 'Confirmar eliminación',
      cancelAction: 'Volver',
      saveChanges: 'Guardar cambios',
      saving: 'Guardando...',
      removeInProgress: 'Eliminando...',
      updateInProgress: 'Actualizando...',
      actionUnavailable: 'Esta reserva no incluye booking UID, por lo que las acciones no están disponibles.',
      actionErrorFallback: 'No se pudo completar esta acción. Intenta de nuevo.',
      durationHoursLabel: 'horas',
      durationDefault: 'Selecciona la duración para continuar.',
      duration3: 'Los viajes de 3 horas van en mañana o tarde.',
      duration4: 'Los viajes de 4 horas deben ir en la mañana.',
      duration5: 'Los viajes de 5+ horas pueden iniciar en cualquier hora que termine antes de las 6:00 PM.',
      timeSectionTitle: 'Horas de inicio disponibles',
      selectDateHint: 'Selecciona una fecha para ver botones de horario.',
      noTimesForDate: 'No hay horas disponibles para esta fecha y duración.',
      selectedTripLabel: 'Viaje seleccionado',
      shiftFitLabel: 'Turno',
      shiftMorning: 'Mañana',
      shiftAfternoon: 'Tarde',
      shiftFlexible: 'Flexible',
      previousMonth: 'Anterior',
      nextMonth: 'Siguiente',
      noDaysAvailable: 'No hay días disponibles en este mes. Prueba otro mes.',
      dayStepLabel: 'Paso 1: Día',
      durationStepLabel: 'Paso 2: Horas',
      timeStepLabel: 'Paso 3: Inicio',
      loadingAvailability: 'Cargando disponibilidad...',
      availabilityErrorTitle: 'Disponibilidad no disponible',
      removeReasonRequired: 'Agrega un motivo antes de eliminar esta reserva.',
      weekdayLabels: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    },
  },
} as const;

const toTimeZoneParts = (isoString: string, timeZone: string) => {
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
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type === 'literal') continue;
    map[part.type] = part.value;
  }

  const hourRaw = Number(map.hour);
  const hour = hourRaw === 24 ? 0 : hourRaw;

  return {
    dateKey: `${map.year}-${map.month}-${map.day}`,
    hour,
    minute: Number(map.minute),
  };
};

const getTimeZoneOffsetLabel = (timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  });
  const part = formatter.formatToParts(new Date()).find((item) => item.type === 'timeZoneName')?.value;
  if (!part) return 'GMT';
  return part.replace('GMT', 'GMT ');
};

const getNowMarker = (timeZone: string): TimeMarker => {
  const now = toTimeZoneParts(new Date().toISOString(), timeZone);
  return {
    dateKey: now.dateKey,
    minutes: now.hour * 60 + now.minute,
  };
};

const isEndpointUnavailable = (status: number, errorMessage?: string) => {
  if (![404, 405, 501].includes(status)) return false;
  if (!errorMessage) return true;
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes('function') ||
    normalized.includes('endpoint') ||
    normalized.includes('not deployed') ||
    normalized.includes('no route') ||
    normalized.includes('not found')
  );
};

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const normalizeEvents = (value: unknown): AdminCalendarEvent[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): AdminCalendarEvent | null => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;

      const id =
        asString(row.id) ||
        asString(row.bookingUid) ||
        asString(row.booking_uid) ||
        asString(row.uid) ||
        crypto.randomUUID();

      const startIso = asString(row.startIso) || asString(row.start) || asString(row.startTime);
      const endIso = asString(row.endIso) || asString(row.end) || asString(row.endTime);
      if (!startIso || !endIso) return null;

      const title =
        asString(row.title) ||
        asString(row.eventTypeTitle) ||
        asString(row.event_type_title) ||
        asString(row.yachtName) ||
        asString(row.yacht_name) ||
        'Booking';

      return {
        id,
        bookingUid: asString(row.bookingUid) || asString(row.booking_uid) || asString(row.uid),
        title,
        startIso,
        endIso,
        status: asString(row.status) || 'booked',
        yachtSlug: asString(row.yachtSlug) || asString(row.yacht_slug) || '',
        yachtName: asString(row.yachtName) || asString(row.yacht_name) || '',
        attendeeName: asString(row.attendeeName) || asString(row.attendee_name),
        attendeeEmail: asString(row.attendeeEmail) || asString(row.attendee_email),
        attendeePhone: asString(row.attendeePhone) || asString(row.attendee_phone),
        notes: asString(row.notes),
        calBookingUrl: asString(row.calBookingUrl) || asString(row.cal_booking_url),
      };
    })
    .filter((item): item is AdminCalendarEvent => item !== null);
};

export default function Calendar() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { language } = useLanguage();
  const { trackEvent } = useActivityTracker();
  const { toast } = useToast();
  const copy = COPY[language];
  const locale = language === 'es' ? es : enUS;

  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const [yachts, setYachts] = useState<AdminCalendarYacht[]>([]);
  const [selectedYachtSlug, setSelectedYachtSlug] = useState<string | null>(null);
  const [events, setEvents] = useState<AdminCalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<AdminCalendarEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMonthDate, setDrawerMonthDate] = useState<Date>(new Date());
  const [drawerAvailabilityDays, setDrawerAvailabilityDays] = useState<Record<string, DayAvailability>>({});
  const [drawerAvailabilityLoading, setDrawerAvailabilityLoading] = useState(false);
  const [drawerAvailabilityError, setDrawerAvailabilityError] = useState<string | null>(null);

  const [loadingYachts, setLoadingYachts] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMarker, setNowMarker] = useState<TimeMarker>(() => getNowMarker(BOOKING_TIMEZONE));
  const hasTrackedPageView = useRef(false);
  const lastTrackedViewMode = useRef<CalendarViewMode | null>(null);
  const lastTrackedRangeKey = useRef<string | null>(null);
  const todayDateKey = useMemo(() => toTimeZoneParts(new Date().toISOString(), BOOKING_TIMEZONE).dateKey, []);

  const visibleDates = useMemo(() => {
    if (viewMode === 'day') return [anchorDate];
    if (viewMode === 'month') {
      const ms = startOfMonth(anchorDate);
      const me = endOfMonth(anchorDate);
      const days: Date[] = [];
      let d = ms;
      while (d <= me) {
        days.push(d);
        d = addDays(d, 1);
      }
      return days;
    }
    const weekStart = startOfWeek(anchorDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }, [anchorDate, viewMode]);

  const rangeStart = useMemo(() => format(visibleDates[0], 'yyyy-MM-dd'), [visibleDates]);
  const rangeEnd = useMemo(() => format(visibleDates[visibleDates.length - 1], 'yyyy-MM-dd'), [visibleDates]);

  const rangeLabel = useMemo(() => {
    if (viewMode === 'day') {
      return format(visibleDates[0], 'EEEE, MMM d, yyyy', { locale });
    }

    if (viewMode === 'month') {
      return format(anchorDate, 'MMMM yyyy', { locale });
    }

    const first = visibleDates[0];
    const last = visibleDates[visibleDates.length - 1];
    const sameMonth = format(first, 'yyyy-MM') === format(last, 'yyyy-MM');

    if (sameMonth) {
      return `${format(first, 'MMM d', { locale })} - ${format(last, 'd, yyyy', { locale })}`;
    }

    return `${format(first, 'MMM d', { locale })} - ${format(last, 'MMM d, yyyy', { locale })}`;
  }, [anchorDate, locale, viewMode, visibleDates]);

  const minMonthDate = useMemo(() => {
    const [yearRaw, monthRaw] = todayDateKey.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    return new Date(year, month - 1, 1);
  }, [todayDateKey]);

  const drawerMonthLabel = useMemo(() => {
    const label = format(drawerMonthDate, 'MMMM yyyy', { locale });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [drawerMonthDate, locale]);

  const canGoPreviousDrawerMonth = useMemo(
    () => startOfMonth(drawerMonthDate).getTime() > minMonthDate.getTime(),
    [drawerMonthDate, minMonthDate]
  );

  const loadYachts = useCallback(async () => {
    setLoadingYachts(true);

    try {
      const { data, error: yachtsError } = await supabase
        .from('yachts')
        .select('id,name,slug,vessel_type,capacity,display_order,booking_mode,cal_event_type_id')
        .eq('booking_mode', 'policy_v2')
        .not('cal_event_type_id', 'is', null)
        .order('display_order', { ascending: true });

      if (yachtsError) throw yachtsError;

      const eligibleYachts = (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        vessel_type: row.vessel_type,
        capacity: row.capacity,
      }));

      setYachts(eligibleYachts);
      setSelectedYachtSlug((current) => current || eligibleYachts[0]?.slug || null);
    } catch (loadError) {
      console.error('Failed to load yachts for calendar:', loadError);
      setError(copy.defaultError);
    } finally {
      setLoadingYachts(false);
    }
  }, [copy.defaultError]);

  const loadEvents = useCallback(
    async (silent = false) => {
      if (!selectedYachtSlug) {
        setEvents([]);
        return;
      }

      if (!silent) setLoadingEvents(true);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        if (!accessToken) {
          setError(copy.sessionExpired);
          setEvents([]);
          return;
        }

        const response = await fetch(
          `${apiBase}/internal-calendar-bookings?slug=${encodeURIComponent(selectedYachtSlug)}&start=${rangeStart}&end=${rangeEnd}&timezone=${encodeURIComponent(BOOKING_TIMEZONE)}`,
          {
            method: 'GET',
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const payload = (await response.json().catch(() => ({}))) as CalendarApiResponse;

        if (!response.ok) {
          if (isEndpointUnavailable(response.status, payload.error)) {
            setError(copy.endpointNotReady);
            setEvents([]);
            return;
          }

          if (response.status === 401) {
            setError(copy.sessionExpired);
            setEvents([]);
            return;
          }

          throw new Error(payload.error || copy.defaultError);
        }

        setError(null);
        setEvents(normalizeEvents(payload.events));
      } catch (loadError) {
        console.error('Failed to load calendar bookings:', loadError);
        setError(loadError instanceof Error ? loadError.message : copy.defaultError);
        setEvents([]);
      } finally {
        if (!silent) setLoadingEvents(false);
      }
    },
    [copy.defaultError, copy.endpointNotReady, copy.sessionExpired, rangeEnd, rangeStart, selectedYachtSlug]
  );

  const loadDrawerAvailability = useCallback(
    async ({
      monthDate,
      yachtSlug,
      silent = false,
    }: {
      monthDate: Date;
      yachtSlug: string;
      silent?: boolean;
    }) => {
      if (!yachtSlug) {
        setDrawerAvailabilityDays({});
        return;
      }

      if (!silent) setDrawerAvailabilityLoading(true);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        if (!accessToken) {
          setDrawerAvailabilityError(copy.sessionExpired);
          setDrawerAvailabilityDays({});
          return;
        }

        const monthKey = monthKeyFromDate(monthDate);
        const response = await fetch(
          `${apiBase}/internal-booking-availability?slug=${encodeURIComponent(yachtSlug)}&month=${monthKey}`,
          {
            method: 'GET',
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const payload = (await response.json().catch(() => ({}))) as AvailabilityApiResponse;

        if (!response.ok) {
          if (isEndpointUnavailable(response.status, payload.error)) {
            setDrawerAvailabilityError(copy.endpointNotReady);
            setDrawerAvailabilityDays({});
            return;
          }

          if (response.status === 401) {
            setDrawerAvailabilityError(copy.sessionExpired);
            setDrawerAvailabilityDays({});
            return;
          }

          throw new Error(payload.error || copy.defaultError);
        }

        setDrawerAvailabilityError(null);
        setDrawerAvailabilityDays(payload.days || {});
      } catch (availabilityLoadError) {
        console.error('Failed to load reschedule availability:', availabilityLoadError);
        setDrawerAvailabilityError(
          availabilityLoadError instanceof Error ? availabilityLoadError.message : copy.defaultError
        );
        setDrawerAvailabilityDays({});
      } finally {
        if (!silent) setDrawerAvailabilityLoading(false);
      }
    },
    [copy.defaultError, copy.endpointNotReady, copy.sessionExpired]
  );

  useEffect(() => {
    void loadYachts();
  }, [loadYachts]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMarker(getNowMarker(BOOKING_TIMEZONE));
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadEvents(true);
    }, 60_000);

    return () => clearInterval(interval);
  }, [loadEvents]);

  useEffect(() => {
    if (hasTrackedPageView.current) return;
    hasTrackedPageView.current = true;

    void trackEvent('calendar_page_viewed', {
      view_mode: viewMode,
      yacht_slug: selectedYachtSlug || '',
      range_start: rangeStart,
      range_end: rangeEnd,
    });
  }, [rangeEnd, rangeStart, selectedYachtSlug, trackEvent, viewMode]);

  useEffect(() => {
    if (lastTrackedViewMode.current === null) {
      lastTrackedViewMode.current = viewMode;
      return;
    }

    if (lastTrackedViewMode.current === viewMode) return;
    lastTrackedViewMode.current = viewMode;

    void trackEvent('calendar_view_changed', {
      view_mode: viewMode,
      yacht_slug: selectedYachtSlug || '',
      range_start: rangeStart,
      range_end: rangeEnd,
    });
  }, [rangeEnd, rangeStart, selectedYachtSlug, trackEvent, viewMode]);

  useEffect(() => {
    const key = `${viewMode}:${selectedYachtSlug || ''}:${rangeStart}:${rangeEnd}`;
    if (lastTrackedRangeKey.current === null) {
      lastTrackedRangeKey.current = key;
      return;
    }

    if (lastTrackedRangeKey.current === key) return;
    lastTrackedRangeKey.current = key;

    void trackEvent('calendar_range_changed', {
      view_mode: viewMode,
      yacht_slug: selectedYachtSlug || '',
      range_start: rangeStart,
      range_end: rangeEnd,
    });
  }, [rangeEnd, rangeStart, selectedYachtSlug, trackEvent, viewMode]);

  const handleViewModeChange = (nextMode: CalendarViewMode) => {
    if (nextMode === viewMode) return;
    setViewMode(nextMode);
  };

  const handlePrevious = () => {
    setAnchorDate((current) => {
      if (viewMode === 'month') return addMonths(current, -1);
      if (viewMode === 'week') return addWeeks(current, -1);
      return addDays(current, -1);
    });
  };

  const handleNext = () => {
    setAnchorDate((current) => {
      if (viewMode === 'month') return addMonths(current, 1);
      if (viewMode === 'week') return addWeeks(current, 1);
      return addDays(current, 1);
    });
  };

  const handleToday = () => {
    setAnchorDate(new Date());
  };

  const handleEventClick = (event: AdminCalendarEvent) => {
    setSelectedEvent(event);
    setDrawerOpen(true);
    setDrawerAvailabilityError(null);

    const eventDate = parseDateKeyToDate(toTimeZoneParts(event.startIso, BOOKING_TIMEZONE).dateKey);
    setDrawerMonthDate(eventDate);
    void loadDrawerAvailability({ monthDate: eventDate, yachtSlug: event.yachtSlug });

    void trackEvent('calendar_event_opened', {
      booking_uid: event.bookingUid || '',
      view_mode: viewMode,
      yacht_slug: event.yachtSlug || selectedYachtSlug || '',
      range_start: rangeStart,
      range_end: rangeEnd,
    });
  };

  const handleDrawerPreviousMonth = () => {
    setDrawerMonthDate((current) => {
      const next = addMonths(current, -1);
      if (startOfMonth(next).getTime() < minMonthDate.getTime()) return current;
      if (selectedEvent?.yachtSlug) {
        void loadDrawerAvailability({ monthDate: next, yachtSlug: selectedEvent.yachtSlug });
      }
      return next;
    });
  };

  const handleDrawerNextMonth = () => {
    setDrawerMonthDate((current) => {
      const next = addMonths(current, 1);
      if (selectedEvent?.yachtSlug) {
        void loadDrawerAvailability({ monthDate: next, yachtSlug: selectedEvent.yachtSlug });
      }
      return next;
    });
  };

  const handleSubmitReschedule = useCallback(
    async ({
      bookingUid,
      date,
      requestedHours,
      startHour,
      event,
    }: {
      bookingUid: string;
      date: string;
      requestedHours: number;
      startHour: number;
      event: AdminCalendarEvent;
    }): Promise<CalendarActionResult> => {
      void trackEvent('calendar_event_change_started', {
        booking_uid: bookingUid,
        yacht_slug: event.yachtSlug,
        range_start: rangeStart,
        range_end: rangeEnd,
        requested_hours: requestedHours,
        start_hour: startHour,
      });

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        if (!accessToken) {
          return { ok: false, status: 401, error: copy.sessionExpired };
        }

        const response = await fetch(`${apiBase}/internal-calendar-booking-reschedule`, {
          method: 'POST',
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            slug: event.yachtSlug,
            bookingUid,
            date,
            requestedHours,
            startHour,
          }),
        });

        const payload = (await response.json().catch(() => ({}))) as CalendarActionApiResponse;

        if (!response.ok) {
          if (isEndpointUnavailable(response.status, payload.error)) {
            return { ok: false, status: response.status, error: copy.actionsEndpointNotReady };
          }
          if (response.status === 401) {
            return { ok: false, status: 401, error: copy.sessionExpired };
          }
          if (response.status === 403) {
            return { ok: false, status: 403, error: copy.permissionDenied };
          }
          if (response.status === 409) {
            await loadDrawerAvailability({
              monthDate: drawerMonthDate,
              yachtSlug: event.yachtSlug,
              silent: true,
            });
            return { ok: false, status: 409, error: payload.error || copy.staleSlotError };
          }
          return { ok: false, status: response.status, error: payload.error || copy.defaultError };
        }

        await loadEvents(true);
        setDrawerOpen(false);
        setSelectedEvent(null);
        toast({
          title: copy.actionSuccessRescheduledTitle,
          description: copy.actionSuccessRescheduledDescription,
        });

        void trackEvent('calendar_event_changed', {
          booking_uid: bookingUid,
          yacht_slug: event.yachtSlug,
          range_start: rangeStart,
          range_end: rangeEnd,
          requested_hours: requestedHours,
          start_hour: startHour,
          change_mode: payload.changeMode || '',
          new_booking_uid: payload.bookingUid || '',
        });

        return { ok: true, status: 200 };
      } catch (rescheduleError) {
        return {
          ok: false,
          status: 500,
          error: rescheduleError instanceof Error ? rescheduleError.message : copy.defaultError,
        };
      }
    },
    [
      copy.actionSuccessRescheduledDescription,
      copy.actionSuccessRescheduledTitle,
      copy.actionsEndpointNotReady,
      copy.defaultError,
      copy.permissionDenied,
      copy.sessionExpired,
      copy.staleSlotError,
      drawerMonthDate,
      loadDrawerAvailability,
      loadEvents,
      rangeEnd,
      rangeStart,
      toast,
      trackEvent,
    ]
  );

  const handleSubmitCancel = useCallback(
    async ({
      bookingUid,
      reason,
      event,
    }: {
      bookingUid: string;
      reason: string;
      event: AdminCalendarEvent;
    }): Promise<CalendarActionResult> => {
      void trackEvent('calendar_event_remove_started', {
        booking_uid: bookingUid,
        yacht_slug: event.yachtSlug,
        range_start: rangeStart,
        range_end: rangeEnd,
      });

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        if (!accessToken) {
          return { ok: false, status: 401, error: copy.sessionExpired };
        }

        const response = await fetch(`${apiBase}/internal-calendar-booking-cancel`, {
          method: 'POST',
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            slug: event.yachtSlug,
            bookingUid,
            reason,
          }),
        });

        const payload = (await response.json().catch(() => ({}))) as CalendarActionApiResponse;

        if (!response.ok) {
          if (isEndpointUnavailable(response.status, payload.error)) {
            return { ok: false, status: response.status, error: copy.actionsEndpointNotReady };
          }
          if (response.status === 401) {
            return { ok: false, status: 401, error: copy.sessionExpired };
          }
          if (response.status === 403) {
            return { ok: false, status: 403, error: copy.permissionDenied };
          }
          return { ok: false, status: response.status, error: payload.error || copy.defaultError };
        }

        await loadEvents(true);
        setDrawerOpen(false);
        setSelectedEvent(null);
        toast({
          title: copy.actionSuccessRemovedTitle,
          description: copy.actionSuccessRemovedDescription,
        });

        void trackEvent('calendar_event_removed', {
          booking_uid: bookingUid,
          yacht_slug: event.yachtSlug,
          range_start: rangeStart,
          range_end: rangeEnd,
        });

        return { ok: true, status: 200 };
      } catch (cancelError) {
        return {
          ok: false,
          status: 500,
          error: cancelError instanceof Error ? cancelError.message : copy.defaultError,
        };
      }
    },
    [
      copy.actionSuccessRemovedDescription,
      copy.actionSuccessRemovedTitle,
      copy.actionsEndpointNotReady,
      copy.defaultError,
      copy.permissionDenied,
      copy.sessionExpired,
      loadEvents,
      rangeEnd,
      rangeStart,
      toast,
      trackEvent,
    ]
  );

  const gmtLabel = useMemo(() => {
    const offset = getTimeZoneOffsetLabel(BOOKING_TIMEZONE).replace('GMT', '').trim();
    return `${copy.gmtLabel} ${offset}`.trim();
  }, [copy.gmtLabel]);

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold text-foreground">{copy.title}</h1>
          <Card>
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-96 w-full" />
              <p className="text-sm text-muted-foreground">{copy.loadingAuth}</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/book" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground md:text-3xl">{copy.title}</h1>
          <p className="text-sm text-muted-foreground md:text-base">{copy.subtitle}</p>
        </div>

        <Card className="border-border/70">
          <CardHeader className="space-y-4">
            <div>
              <CardTitle>{copy.title}</CardTitle>
              <CardDescription>{copy.subtitle}</CardDescription>
            </div>

            <CalendarToolbar
              rangeLabel={rangeLabel}
              viewMode={viewMode}
              loading={loadingEvents}
              copy={{
                today: copy.today,
                previous: copy.previous,
                next: copy.next,
                month: copy.month,
                week: copy.week,
                day: copy.day,
                refresh: copy.refresh,
              }}
              onToday={handleToday}
              onPrevious={handlePrevious}
              onNext={handleNext}
              onRefresh={() => void loadEvents()}
              onViewModeChange={handleViewModeChange}
            />

            <YachtTabs
              yachts={yachts}
              selectedYachtSlug={selectedYachtSlug}
              loading={loadingYachts}
              emptyLabel={copy.emptyYachts}
              onSelect={(slug) => setSelectedYachtSlug(slug)}
            />
          </CardHeader>

          <CardContent className="space-y-4">
            {loadingYachts ? (
              <p className="text-sm text-muted-foreground">{copy.loadingYachts}</p>
            ) : null}

            {error ? (
              <Alert variant="destructive">
                <AlertTitle>{copy.errorTitle}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {viewMode === 'month' ? (
              <MonthGrid
                anchorDate={anchorDate}
                events={events}
                timezone={BOOKING_TIMEZONE}
                language={language}
                loading={loadingEvents}
                copy={{
                  loading: copy.loadingEvents,
                  empty: copy.emptyEvents,
                }}
                onEventClick={handleEventClick}
              />
            ) : (
              <TimeGrid
                dates={visibleDates}
                events={events}
                timezone={BOOKING_TIMEZONE}
                language={language}
                loading={loadingEvents}
                nowMarker={nowMarker}
                copy={{
                  loading: copy.loadingEvents,
                  empty: copy.emptyEvents,
                  gmtLabel,
                }}
                onEventClick={handleEventClick}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <EventDrawer
        event={selectedEvent}
        open={drawerOpen}
        timezone={BOOKING_TIMEZONE}
        availability={{
          monthDate: drawerMonthDate,
          monthLabel: drawerMonthLabel,
          days: drawerAvailabilityDays,
          minDateKey: todayDateKey,
          canGoPreviousMonth: canGoPreviousDrawerMonth,
          loading: drawerAvailabilityLoading,
          error: drawerAvailabilityError,
        }}
        copy={copy.drawer}
        onPreviousMonth={handleDrawerPreviousMonth}
        onNextMonth={handleDrawerNextMonth}
        onSubmitReschedule={handleSubmitReschedule}
        onSubmitCancel={handleSubmitCancel}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) {
            setSelectedEvent(null);
            setDrawerAvailabilityError(null);
            setDrawerAvailabilityDays({});
          }
        }}
      />
    </DashboardLayout>
  );
}
