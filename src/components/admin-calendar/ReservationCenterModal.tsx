import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ClipboardCopy,
  Download,
  Plus,
  RefreshCcw,
  ShieldAlert,
  Trash2,
  UserRound,
  Waves,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import StepDay from '@/components/calendar/StepDay';
import StepDuration from '@/components/calendar/StepDuration';
import StepStartTimes from '@/components/calendar/StepStartTimes';
import { DayAvailability, getDurationKey } from '@/lib/bookingPolicy';
import {
  AdminCalendarEvent,
  CalendarActionResult,
  ReservationCenterView,
  ReservationRecord,
  RescheduleDraft,
  ReservationStay,
} from './types';

type Copy = {
  titleFallback: string;
  subtitle: string;
  bookingUid: string;
  bookingId: string;
  yacht: string;
  status: string;
  when: string;
  duration: string;
  completion: string;
  noAudit: string;
  noNotes: string;
  lockedReadOnly: string;
  editDetails: string;
  saveDetails: string;
  savingDetails: string;
  cancelEdit: string;
  close: string;
  openCal: string;
  copyFullDetails: string;
  exportCsv: string;
  copiedSuccess: string;
  exportedSuccess: string;
  detailsSaved: string;
  detailsSaveError: string;
  exportError: string;
  guestSectionTitle: string;
  partySectionTitle: string;
  staysSectionTitle: string;
  careSectionTitle: string;
  opsSectionTitle: string;
  summarySectionTitle: string;
  primaryGuestName: string;
  preferredName: string;
  email: string;
  phone: string;
  whatsapp: string;
  nationality: string;
  preferredLanguage: string;
  guestNotes: string;
  guestCount: string;
  adultCount: string;
  kidsCount: string;
  kidsNotes: string;
  stayingMultiplePlaces: string;
  allergies: string;
  preferences: string;
  dietaryNotes: string;
  mobilityNotes: string;
  occasionNotes: string;
  conciergeNotes: string;
  internalNotes: string;
  internalEventName: string;
  internalEventNamePlaceholder: string;
  commaHint: string;
  addStay: string;
  removeStay: string;
  stayName: string;
  stayLocation: string;
  stayCheckIn: string;
  stayCheckOut: string;
  stayUnit: string;
  stayNotes: string;
  actionDeckTitle: string;
  actionDeckDescription: string;
  changeReservation: string;
  removeReservation: string;
  actionUnavailable: string;
  actionErrorFallback: string;
  rescheduleTitle: string;
  removeTitle: string;
  removeDescription: string;
  removeReasonLabel: string;
  removeReasonPlaceholder: string;
  removeConfirm: string;
  cancelAction: string;
  updateInProgress: string;
  removeInProgress: string;
  removeReasonRequired: string;
  durationHoursLabel: string;
  durationDefault: string;
  duration3: string;
  duration4: string;
  duration5: string;
  timeSectionTitle: string;
  selectDateHint: string;
  noTimesForDate: string;
  selectedTripLabel: string;
  shiftFitLabel: string;
  shiftMorning: string;
  shiftAfternoon: string;
  shiftFlexible: string;
  previousMonth: string;
  nextMonth: string;
  noDaysAvailable: string;
  dayStepLabel: string;
  durationStepLabel: string;
  timeStepLabel: string;
  loadingAvailability: string;
  availabilityErrorTitle: string;
  weekdayLabels: readonly string[];
};

type AvailabilityState = {
  monthDate: Date;
  monthLabel: string;
  days: Record<string, DayAvailability>;
  minDateKey: string;
  canGoPreviousMonth: boolean;
  loading: boolean;
  error: string | null;
};

type ExportResult = {
  ok: boolean;
  error?: string;
  payload?: Record<string, unknown>;
  fileName?: string;
};

type Props = {
  event: AdminCalendarEvent | null;
  open: boolean;
  timezone: string;
  canEdit: boolean;
  reservation: ReservationRecord | null;
  detailsLoading: boolean;
  detailsError: string | null;
  availability: AvailabilityState;
  copy: Copy;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSaveDetails: (payload: { event: AdminCalendarEvent; record: ReservationRecord }) => Promise<CalendarActionResult>;
  onExportDetails: (payload: {
    event: AdminCalendarEvent;
    record: ReservationRecord;
    format: 'copy' | 'csv';
  }) => Promise<ExportResult>;
  onRefreshReservationDetails: (payload: { bookingUid: string; slug: string }) => Promise<void>;
  onSubmitReschedule: (payload: {
    bookingUid: string;
    date: string;
    requestedHours: number;
    startHour: number;
    event: AdminCalendarEvent;
  }) => Promise<CalendarActionResult>;
  onSubmitCancel: (payload: {
    bookingUid: string;
    reason: string;
    event: AdminCalendarEvent;
  }) => Promise<CalendarActionResult>;
  customEventName: string;
  onCustomEventNameChange: (event: AdminCalendarEvent, value: string) => void;
  onOpenChange: (open: boolean) => void;
};

const pad2 = (value: number) => String(value).padStart(2, '0');

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

const formatHour = (hour: number, minute = 0) => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}:${pad2(minute)} ${period}`;
};

const formatDuration = (startIso: string, endIso: string) => {
  const minutes = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours > 0 && remainder > 0) return `${hours}h ${remainder}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
};

const getDurationHours = (startIso: string, endIso: string) => {
  const minutes = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
  if (minutes <= 0 || minutes % 60 !== 0) return null;
  const hours = minutes / 60;
  return hours >= 3 && hours <= 8 ? hours : null;
};

const withValidation = (
  draft: Omit<RescheduleDraft, 'isDateValid' | 'isDurationValid' | 'isStartValid'>
): RescheduleDraft => ({
  ...draft,
  isDateValid: !!draft.date,
  isDurationValid: draft.requestedHours !== null,
  isStartValid: draft.startHour !== null,
});

const parseTags = (value: string[]) => value.join(', ');

const splitTags = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const sanitizeRecord = (record: ReservationRecord): ReservationRecord => ({
  reservation: {
    ...record.reservation,
    bookingUidHistory: [...record.reservation.bookingUidHistory],
    allergies: [...record.reservation.allergies],
    preferences: [...record.reservation.preferences],
  },
  guest: { ...record.guest },
  stays: record.stays.map((stay, index) => ({
    ...stay,
    sortOrder: index,
  })),
  auditSummary: record.auditSummary ? { ...record.auditSummary } : null,
  completionScore: record.completionScore,
});

const buildDefaultRecord = (event: AdminCalendarEvent, timezone: string): ReservationRecord => {
  const start = toTimeZoneParts(event.startIso, timezone);
  const end = toTimeZoneParts(event.endIso, timezone);

  return {
    reservation: {
      id: null,
      bookingUidCurrent: event.bookingUid || event.id,
      bookingUidHistory: [],
      yachtSlug: event.yachtSlug,
      yachtName: event.yachtName,
      startAt: event.startIso,
      endAt: event.endIso,
      status: event.status || 'booked',
      guestProfileId: null,
      guestCount: null,
      adultCount: null,
      kidsCount: null,
      kidsNotes: '',
      stayingMultiplePlaces: false,
      allergies: [],
      preferences: [],
      dietaryNotes: '',
      mobilityNotes: '',
      occasionNotes: '',
      conciergeNotes: '',
      internalNotes: event.notes || '',
      source: 'internal_calendar_v2',
      createdAt: null,
      updatedAt: null,
    },
    guest: {
      id: null,
      fullName: event.attendeeName || '',
      preferredName: '',
      email: event.attendeeEmail || '',
      phone: event.attendeePhone || '',
      whatsapp: '',
      nationality: '',
      preferredLanguage: '',
      notes: '',
    },
    stays: [],
    auditSummary: null,
    completionScore: null,
  };
};

const computeCompletionScore = (record: ReservationRecord) => {
  const contactReady =
    record.guest.fullName.trim().length > 0 &&
    record.guest.email.trim().length > 0 &&
    (record.guest.phone.trim().length > 0 || record.guest.whatsapp.trim().length > 0);
  const partyReady =
    record.reservation.guestCount !== null &&
    record.reservation.adultCount !== null &&
    record.reservation.kidsCount !== null;
  const accommodationReady =
    !record.reservation.stayingMultiplePlaces ||
    record.stays.some((stay) => stay.propertyName.trim().length > 0 || stay.locationLabel.trim().length > 0);
  const guestCareReady = record.reservation.allergies.length > 0 && record.reservation.preferences.length > 0;
  const opsReady =
    record.reservation.occasionNotes.trim().length > 0 &&
    record.reservation.conciergeNotes.trim().length > 0 &&
    record.reservation.internalNotes.trim().length > 0;

  const checks = [contactReady, partyReady, accommodationReady, guestCareReady, opsReady];
  const passed = checks.filter(Boolean).length;
  return passed * 20;
};

const buildExportPayload = (record: ReservationRecord) => ({
  reservation: record.reservation,
  guest: record.guest,
  stays: record.stays,
  completionScore: computeCompletionScore(record),
  auditSummary: record.auditSummary,
});

const exportText = (payload: Record<string, unknown>) => JSON.stringify(payload, null, 2);

const downloadCsv = (payload: Record<string, unknown>, fileName: string) => {
  const rows: Array<[string, string]> = [];

  const flatten = (value: unknown, prefix = 'details') => {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        rows.push([prefix, '']);
        return;
      }
      value.forEach((item, index) => flatten(item, `${prefix}.${index + 1}`));
      return;
    }

    if (value && typeof value === 'object') {
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        flatten(nested, `${prefix}.${key}`);
      }
      return;
    }

    rows.push([prefix, value == null ? '' : String(value)]);
  };

  flatten(payload, 'reservation');

  const csv = [
    'field,value',
    ...rows.map(([field, value]) => `"${field.replace(/"/g, '""')}","${value.replace(/"/g, '""')}"`),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
};

export default function ReservationCenterModal({
  event,
  open,
  timezone,
  canEdit,
  reservation,
  detailsLoading,
  detailsError,
  availability,
  copy,
  onPreviousMonth,
  onNextMonth,
  onSaveDetails,
  onExportDetails,
  onRefreshReservationDetails,
  onSubmitReschedule,
  onSubmitCancel,
  customEventName,
  onCustomEventNameChange,
  onOpenChange,
}: Props) {
  const [mode, setMode] = useState<ReservationCenterView>('view');
  const [pendingAction, setPendingAction] = useState<'save' | 'reschedule' | 'cancel' | 'export' | null>(null);
  const [draftRecord, setDraftRecord] = useState<ReservationRecord | null>(null);
  const [rescheduleDraft, setRescheduleDraft] = useState<RescheduleDraft>({
    date: null,
    requestedHours: null,
    startHour: null,
    isDateValid: false,
    isDurationValid: false,
    isStartValid: false,
  });
  const [removeReason, setRemoveReason] = useState('');
  const [draftCustomEventName, setDraftCustomEventName] = useState(customEventName);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [inlineSuccess, setInlineSuccess] = useState<string | null>(null);

  useEffect(() => {
    setDraftCustomEventName(customEventName);
  }, [customEventName]);

  useEffect(() => {
    if (!open || !event) return;

    const source = reservation ? sanitizeRecord(reservation) : buildDefaultRecord(event, timezone);
    setDraftRecord(source);
    setMode('view');
    setPendingAction(null);
    setInlineError(null);
    setInlineSuccess(null);
    setRemoveReason('');

    const start = toTimeZoneParts(source.reservation.startAt || event.startIso, timezone);
    const requestedHours = getDurationHours(
      source.reservation.startAt || event.startIso,
      source.reservation.endAt || event.endIso
    );

    setRescheduleDraft(
      withValidation({
        date: start.dateKey,
        requestedHours,
        startHour: requestedHours ? start.hour : null,
      })
    );
  }, [event, open, reservation, timezone]);

  const selectedDay = useMemo(() => {
    if (!rescheduleDraft.date) return null;
    return availability.days[rescheduleDraft.date] || null;
  }, [availability.days, rescheduleDraft.date]);

  const startHourOptions = useMemo(() => {
    if (!selectedDay || !rescheduleDraft.requestedHours) return [];
    const key = getDurationKey(rescheduleDraft.requestedHours);
    if (!key) return [];
    return [...selectedDay.validStartsByDuration[key]].sort((a, b) => a - b);
  }, [rescheduleDraft.requestedHours, selectedDay]);

  const disabledDurationHours = useMemo(() => {
    if (!selectedDay) return [];
    const disabled: number[] = [];
    for (let hours = 3; hours <= 8; hours += 1) {
      const durationKey = String(hours) as keyof typeof selectedDay.validStartsByDuration;
      if ((selectedDay.validStartsByDuration[durationKey] || []).length === 0) {
        disabled.push(hours);
      }
    }
    return disabled;
  }, [selectedDay]);

  useEffect(() => {
    if (!open) return;
    if (!rescheduleDraft.date || !rescheduleDraft.requestedHours) return;

    if (startHourOptions.length === 0) {
      if (rescheduleDraft.startHour !== null) {
        setRescheduleDraft((prev) => withValidation({ ...prev, startHour: null }));
      }
      return;
    }

    if (rescheduleDraft.startHour === null || !startHourOptions.includes(rescheduleDraft.startHour)) {
      setRescheduleDraft((prev) => withValidation({ ...prev, startHour: startHourOptions[0] }));
    }
  }, [open, rescheduleDraft.date, rescheduleDraft.requestedHours, rescheduleDraft.startHour, startHourOptions]);

  if (!event) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl" />
      </Dialog>
    );
  }

  const record = draftRecord || buildDefaultRecord(event, timezone);
  const readOnly = !canEdit || mode !== 'edit';
  const isSubmitting = mode === 'submitting';
  const completionScore = record.completionScore ?? computeCompletionScore(record);
  const start = toTimeZoneParts(record.reservation.startAt || event.startIso, timezone);
  const end = toTimeZoneParts(record.reservation.endAt || event.endIso, timezone);
  const canSubmitReschedule =
    !!event.bookingUid &&
    !!rescheduleDraft.date &&
    rescheduleDraft.requestedHours !== null &&
    rescheduleDraft.startHour !== null &&
    startHourOptions.includes(rescheduleDraft.startHour);
  const canSubmitRemove = !!event.bookingUid && removeReason.trim().length > 0;

  const updateReservation = <K extends keyof ReservationRecord['reservation']>(
    key: K,
    value: ReservationRecord['reservation'][K]
  ) => {
    setDraftRecord((prev) =>
      prev
        ? {
            ...prev,
            reservation: {
              ...prev.reservation,
              [key]: value,
            },
          }
        : prev
    );
  };

  const updateGuest = <K extends keyof ReservationRecord['guest']>(key: K, value: ReservationRecord['guest'][K]) => {
    setDraftRecord((prev) =>
      prev
        ? {
            ...prev,
            guest: {
              ...prev.guest,
              [key]: value,
            },
          }
        : prev
    );
  };

  const updateStay = (index: number, key: keyof ReservationStay, value: ReservationStay[keyof ReservationStay]) => {
    setDraftRecord((prev) => {
      if (!prev) return prev;
      const nextStays = [...prev.stays];
      if (!nextStays[index]) return prev;
      nextStays[index] = {
        ...nextStays[index],
        [key]: value,
      };
      return { ...prev, stays: nextStays };
    });
  };

  const addStay = () => {
    setDraftRecord((prev) =>
      prev
        ? {
            ...prev,
            stays: [
              ...prev.stays,
              {
                id: null,
                propertyName: '',
                locationLabel: '',
                checkInDate: '',
                checkOutDate: '',
                unitOrRoom: '',
                notes: '',
                sortOrder: prev.stays.length,
              },
            ],
          }
        : prev
    );
  };

  const removeStay = (index: number) => {
    setDraftRecord((prev) =>
      prev
        ? {
            ...prev,
            stays: prev.stays.filter((_, stayIndex) => stayIndex !== index),
          }
        : prev
    );
  };

  const moveStay = (index: number, direction: -1 | 1) => {
    setDraftRecord((prev) => {
      if (!prev) return prev;
      const next = [...prev.stays];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const currentValue = next[index];
      next[index] = next[target];
      next[target] = currentValue;
      return { ...prev, stays: next };
    });
  };

  const handleResetToView = () => {
    const source = reservation ? sanitizeRecord(reservation) : buildDefaultRecord(event, timezone);
    setDraftRecord(source);
    setMode('view');
    setInlineError(null);
    setInlineSuccess(null);
  };

  const handleSaveDetails = async () => {
    if (!canEdit || !draftRecord) return;

    setInlineError(null);
    setInlineSuccess(null);
    setPendingAction('save');
    setMode('submitting');

    onCustomEventNameChange(event, draftCustomEventName);

    const result = await onSaveDetails({ event, record: sanitizeRecord(draftRecord) });
    if (!result.ok) {
      setInlineError(result.error || copy.detailsSaveError);
      setPendingAction(null);
      setMode('edit');
      return;
    }

    await onRefreshReservationDetails({
      bookingUid: result.bookingUid || event.bookingUid || event.id,
      slug: event.yachtSlug,
    });
    setPendingAction(null);
    setMode('view');
    setInlineSuccess(copy.detailsSaved);
  };

  const handleExport = async (format: 'copy' | 'csv') => {
    if (!draftRecord) return;
    setInlineError(null);
    setInlineSuccess(null);
    setPendingAction('export');

    const result = await onExportDetails({
      event,
      record: sanitizeRecord(draftRecord),
      format,
    });

    if (!result.ok) {
      setPendingAction(null);
      setInlineError(result.error || copy.exportError);
      return;
    }

    const payload = result.payload || buildExportPayload(draftRecord);
    if (format === 'copy') {
      await navigator.clipboard.writeText(exportText(payload));
      setInlineSuccess(copy.copiedSuccess);
    } else {
      downloadCsv(payload, result.fileName || `reservation-${event.bookingUid || event.id}.csv`);
      setInlineSuccess(copy.exportedSuccess);
    }
    setPendingAction(null);
  };

  const handleRescheduleSubmit = async () => {
    if (
      !event.bookingUid ||
      !canSubmitReschedule ||
      !rescheduleDraft.date ||
      !rescheduleDraft.requestedHours ||
      rescheduleDraft.startHour === null
    ) {
      return;
    }

    setInlineError(null);
    setInlineSuccess(null);
    setPendingAction('reschedule');
    setMode('submitting');

    const result = await onSubmitReschedule({
      bookingUid: event.bookingUid,
      date: rescheduleDraft.date,
      requestedHours: rescheduleDraft.requestedHours,
      startHour: rescheduleDraft.startHour,
      event,
    });

    if (!result.ok) {
      setInlineError(result.error || copy.actionErrorFallback);
      setPendingAction(null);
      setMode('reschedule');
      return;
    }

    await onRefreshReservationDetails({
      bookingUid: result.bookingUid || event.bookingUid,
      slug: event.yachtSlug,
    });
    setPendingAction(null);
    setMode('view');
    setInlineSuccess(copy.detailsSaved);
  };

  const handleRemoveSubmit = async () => {
    if (!event.bookingUid) return;
    if (!removeReason.trim()) {
      setInlineError(copy.removeReasonRequired);
      return;
    }

    setInlineError(null);
    setInlineSuccess(null);
    setPendingAction('cancel');
    setMode('submitting');

    const result = await onSubmitCancel({
      bookingUid: event.bookingUid,
      reason: removeReason.trim(),
      event,
    });

    if (!result.ok) {
      setInlineError(result.error || copy.actionErrorFallback);
      setPendingAction(null);
      setMode('remove_confirm');
      return;
    }

    await onRefreshReservationDetails({
      bookingUid: event.bookingUid,
      slug: event.yachtSlug,
    });
    setPendingAction(null);
    setMode('view');
    setInlineSuccess(copy.detailsSaved);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[96vh] w-[calc(100vw-1rem)] max-w-6xl overflow-hidden p-0 sm:max-h-[92vh] sm:w-full">
        <DialogHeader className="border-b border-border/70 bg-card px-4 py-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-base leading-snug sm:text-xl">{draftCustomEventName.trim() || event.title || copy.titleFallback}</DialogTitle>
              <DialogDescription className="text-sm">{copy.subtitle}</DialogDescription>
            </div>
            <Badge variant="secondary" className="uppercase">
              {record.reservation.status || event.status}
            </Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(96vh-84px)] sm:max-h-[calc(92vh-88px)]">
          <div className="space-y-5 px-4 pb-24 pt-4 sm:p-5 sm:pb-12">
            <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-sky-50 via-card to-emerald-50/40 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {copy.summarySectionTitle}
              </p>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-lg border border-border/60 bg-background/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.yacht}</p>
                  <p className="text-sm font-semibold text-foreground">{record.reservation.yachtName || event.yachtName}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.when}</p>
                  <p className="text-sm font-semibold text-foreground">
                    {start.dateKey} · {formatHour(start.hour, start.minute)} - {formatHour(end.hour, end.minute)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.duration}</p>
                  <p className="text-sm font-semibold text-foreground">{formatDuration(record.reservation.startAt || event.startIso, record.reservation.endAt || event.endIso)}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.bookingUid}</p>
                  <p className="truncate text-sm font-semibold text-foreground">
                    {record.reservation.bookingUidCurrent || event.bookingUid || '-'}
                  </p>
                </div>
              </div>
            </div>

            {inlineError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{copy.actionDeckTitle}</AlertTitle>
                <AlertDescription>{inlineError}</AlertDescription>
              </Alert>
            ) : null}

            {inlineSuccess ? (
              <Alert>
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription>{inlineSuccess}</AlertDescription>
              </Alert>
            ) : null}

            {detailsError ? (
              <Alert variant="destructive">
                <AlertTitle>{copy.actionDeckTitle}</AlertTitle>
                <AlertDescription>{detailsError}</AlertDescription>
              </Alert>
            ) : null}

            {detailsLoading ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
                <RefreshCcw className="mr-2 inline h-4 w-4 animate-spin" />
                {copy.loadingAvailability}
              </div>
            ) : null}

            {mode === 'reschedule' || (isSubmitting && pendingAction === 'reschedule') ? (
              <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{copy.rescheduleTitle}</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setMode('view')} disabled={isSubmitting}>
                    {copy.cancelAction}
                  </Button>
                </div>

                {availability.loading ? (
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
                    <RefreshCcw className="mr-2 inline h-4 w-4 animate-spin" />
                    {copy.loadingAvailability}
                  </div>
                ) : null}

                {availability.error ? (
                  <Alert variant="destructive">
                    <AlertTitle>{copy.availabilityErrorTitle}</AlertTitle>
                    <AlertDescription>{availability.error}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.dayStepLabel}</p>
                  <StepDay
                    monthDate={availability.monthDate}
                    days={availability.days}
                    selectedDate={rescheduleDraft.date}
                    minDateKey={availability.minDateKey}
                    canGoPreviousMonth={availability.canGoPreviousMonth}
                    copy={{
                      weekdayLabels: copy.weekdayLabels,
                      previousMonth: copy.previousMonth,
                      nextMonth: copy.nextMonth,
                      monthLabel: availability.monthLabel,
                      noDaysAvailable: copy.noDaysAvailable,
                    }}
                    onPreviousMonth={onPreviousMonth}
                    onNextMonth={onNextMonth}
                    onSelectDate={(date) =>
                      setRescheduleDraft(
                        withValidation({
                          date,
                          requestedHours: null,
                          startHour: null,
                        })
                      )
                    }
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.durationStepLabel}</p>
                  <StepDuration
                    requestedHours={rescheduleDraft.requestedHours}
                    disabledHours={disabledDurationHours}
                    onSelectHours={(hours) =>
                      setRescheduleDraft((prev) =>
                        withValidation({
                          ...prev,
                          requestedHours: hours,
                          startHour: null,
                        })
                      )
                    }
                    hoursLabel={copy.durationHoursLabel}
                    helperCopy={{
                      defaultText: copy.durationDefault,
                      threeHours: copy.duration3,
                      fourHours: copy.duration4,
                      fivePlusHours: copy.duration5,
                    }}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.timeStepLabel}</p>
                  <StepStartTimes
                    requestedHours={rescheduleDraft.requestedHours || 3}
                    selectedDate={rescheduleDraft.date}
                    selectedStartHour={rescheduleDraft.startHour}
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
                      setRescheduleDraft((prev) =>
                        withValidation({
                          ...prev,
                          startHour: hour,
                        })
                      )
                    }
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setMode('view')} disabled={isSubmitting}>
                    {copy.cancelAction}
                  </Button>
                  <Button type="button" onClick={handleRescheduleSubmit} disabled={!canSubmitReschedule || isSubmitting}>
                    {isSubmitting ? copy.updateInProgress : copy.changeReservation}
                  </Button>
                </div>
              </div>
            ) : null}

            {mode === 'remove_confirm' || (isSubmitting && pendingAction === 'cancel') ? (
              <div className="space-y-4 rounded-xl border border-rose-200 bg-rose-50/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{copy.removeTitle}</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setMode('view')} disabled={isSubmitting}>
                    {copy.cancelAction}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">{copy.removeDescription}</p>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.removeReasonLabel}</p>
                  <Textarea
                    value={removeReason}
                    onChange={(eventValue) => setRemoveReason(eventValue.target.value)}
                    placeholder={copy.removeReasonPlaceholder}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setMode('view')} disabled={isSubmitting}>
                    {copy.cancelAction}
                  </Button>
                  <Button type="button" variant="destructive" onClick={handleRemoveSubmit} disabled={!canSubmitRemove || isSubmitting}>
                    {isSubmitting ? copy.removeInProgress : copy.removeConfirm}
                  </Button>
                </div>
              </div>
            ) : null}

            {mode === 'view' || mode === 'edit' || (mode === 'submitting' && pendingAction === 'save') ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-border/70 bg-card p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{copy.actionDeckTitle}</p>
                    <Badge variant="outline">
                      {copy.completion}: {completionScore}%
                    </Badge>
                  </div>
                  <p className="mb-3 text-sm text-muted-foreground">{copy.actionDeckDescription}</p>
                  <div className="mb-3 space-y-2">
                    <Label>{copy.internalEventName}</Label>
                    <Input
                      value={draftCustomEventName}
                      onChange={(e) => {
                        setDraftCustomEventName(e.target.value);
                        if (mode !== 'edit') onCustomEventNameChange(event, e.target.value);
                      }}
                      disabled={readOnly}
                      placeholder={copy.internalEventNamePlaceholder}
                    />
                  </div>
                  {!canEdit ? (
                    <p className="rounded-md border border-border/60 bg-muted/25 p-2 text-xs text-muted-foreground">
                      {copy.lockedReadOnly}
                    </p>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {canEdit ? (
                      mode === 'edit' ? (
                        <>
                          <Button type="button" onClick={handleSaveDetails} disabled={isSubmitting}>
                            {isSubmitting && pendingAction === 'save' ? copy.savingDetails : copy.saveDetails}
                          </Button>
                          <Button type="button" variant="outline" onClick={handleResetToView} disabled={isSubmitting}>
                            {copy.cancelEdit}
                          </Button>
                        </>
                      ) : (
                        <Button type="button" variant="secondary" onClick={() => setMode('edit')}>
                          {copy.editDetails}
                        </Button>
                      )
                    ) : null}
                    <Button type="button" variant="outline" onClick={() => void handleExport('copy')} disabled={pendingAction === 'export'}>
                      <ClipboardCopy className="mr-2 h-4 w-4" />
                      {copy.copyFullDetails}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void handleExport('csv')} disabled={pendingAction === 'export'}>
                      <Download className="mr-2 h-4 w-4" />
                      {copy.exportCsv}
                    </Button>
                    {event.calBookingUrl ? (
                      <Button type="button" variant="ghost" asChild>
                        <a href={event.calBookingUrl} target="_blank" rel="noreferrer">
                          {copy.openCal}
                        </a>
                      </Button>
                    ) : null}
                    {canEdit && event.bookingUid ? (
                      <>
                        <Button type="button" variant="secondary" onClick={() => setMode('reschedule')}>
                          <RefreshCcw className="mr-2 h-4 w-4" />
                          {copy.changeReservation}
                        </Button>
                        <Button type="button" variant="destructive" onClick={() => setMode('remove_confirm')}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          {copy.removeReservation}
                        </Button>
                      </>
                    ) : null}
                  </div>
                  {!event.bookingUid ? (
                    <p className="mt-3 rounded-md border border-border/60 bg-muted/25 p-2 text-xs text-muted-foreground">
                      {copy.actionUnavailable}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <UserRound className="h-4 w-4 text-muted-foreground" />
                      {copy.guestSectionTitle}
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{copy.primaryGuestName}</Label>
                        <Input value={record.guest.fullName} disabled={readOnly} onChange={(e) => updateGuest('fullName', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>{copy.preferredName}</Label>
                        <Input value={record.guest.preferredName} disabled={readOnly} onChange={(e) => updateGuest('preferredName', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>{copy.email}</Label>
                        <Input value={record.guest.email} disabled={readOnly} onChange={(e) => updateGuest('email', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>{copy.phone}</Label>
                        <Input value={record.guest.phone} disabled={readOnly} onChange={(e) => updateGuest('phone', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>{copy.whatsapp}</Label>
                        <Input value={record.guest.whatsapp} disabled={readOnly} onChange={(e) => updateGuest('whatsapp', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>{copy.nationality}</Label>
                        <Input value={record.guest.nationality} disabled={readOnly} onChange={(e) => updateGuest('nationality', e.target.value)} />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label>{copy.preferredLanguage}</Label>
                        <Input value={record.guest.preferredLanguage} disabled={readOnly} onChange={(e) => updateGuest('preferredLanguage', e.target.value)} />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label>{copy.guestNotes}</Label>
                        <Textarea value={record.guest.notes} disabled={readOnly} onChange={(e) => updateGuest('notes', e.target.value)} />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
                    <h3 className="text-sm font-semibold text-foreground">{copy.partySectionTitle}</h3>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label>{copy.guestCount}</Label>
                        <Input
                          type="number"
                          value={record.reservation.guestCount ?? ''}
                          disabled={readOnly}
                          onChange={(e) =>
                            updateReservation('guestCount', e.target.value === '' ? null : Number(e.target.value))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{copy.adultCount}</Label>
                        <Input
                          type="number"
                          value={record.reservation.adultCount ?? ''}
                          disabled={readOnly}
                          onChange={(e) =>
                            updateReservation('adultCount', e.target.value === '' ? null : Number(e.target.value))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{copy.kidsCount}</Label>
                        <Input
                          type="number"
                          value={record.reservation.kidsCount ?? ''}
                          disabled={readOnly}
                          onChange={(e) =>
                            updateReservation('kidsCount', e.target.value === '' ? null : Number(e.target.value))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{copy.kidsNotes}</Label>
                      <Textarea
                        value={record.reservation.kidsNotes}
                        disabled={readOnly}
                        onChange={(e) => updateReservation('kidsNotes', e.target.value)}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{copy.stayingMultiplePlaces}</p>
                      </div>
                      <Switch
                        checked={record.reservation.stayingMultiplePlaces}
                        disabled={readOnly}
                        onCheckedChange={(checked) => updateReservation('stayingMultiplePlaces', checked)}
                      />
                    </div>
                  </section>
                </div>

                <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{copy.staysSectionTitle}</h3>
                    {canEdit && mode === 'edit' ? (
                      <Button type="button" variant="outline" size="sm" onClick={addStay}>
                        <Plus className="mr-2 h-4 w-4" />
                        {copy.addStay}
                      </Button>
                    ) : null}
                  </div>

                  {record.stays.length === 0 ? (
                    <p className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
                      {copy.noNotes}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {record.stays.map((stay, index) => (
                        <div key={`${stay.id || 'new'}-${index}`} className="rounded-lg border border-border/60 bg-background/60 p-3">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {copy.staysSectionTitle} #{index + 1}
                            </p>
                            {canEdit && mode === 'edit' ? (
                              <div className="flex gap-2">
                                <Button type="button" variant="ghost" size="sm" onClick={() => moveStay(index, -1)} disabled={index === 0}>
                                  ↑
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => moveStay(index, 1)}
                                  disabled={index === record.stays.length - 1}
                                >
                                  ↓
                                </Button>
                                <Button type="button" variant="ghost" size="sm" onClick={() => removeStay(index)}>
                                  {copy.removeStay}
                                </Button>
                              </div>
                            ) : null}
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label>{copy.stayName}</Label>
                              <Input value={stay.propertyName} disabled={readOnly} onChange={(e) => updateStay(index, 'propertyName', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label>{copy.stayLocation}</Label>
                              <Input value={stay.locationLabel} disabled={readOnly} onChange={(e) => updateStay(index, 'locationLabel', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label>{copy.stayCheckIn}</Label>
                              <Input type="date" value={stay.checkInDate} disabled={readOnly} onChange={(e) => updateStay(index, 'checkInDate', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label>{copy.stayCheckOut}</Label>
                              <Input type="date" value={stay.checkOutDate} disabled={readOnly} onChange={(e) => updateStay(index, 'checkOutDate', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label>{copy.stayUnit}</Label>
                              <Input value={stay.unitOrRoom} disabled={readOnly} onChange={(e) => updateStay(index, 'unitOrRoom', e.target.value)} />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                              <Label>{copy.stayNotes}</Label>
                              <Textarea value={stay.notes} disabled={readOnly} onChange={(e) => updateStay(index, 'notes', e.target.value)} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <div className="grid gap-5 lg:grid-cols-2">
                  <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
                    <h3 className="text-sm font-semibold text-foreground">{copy.careSectionTitle}</h3>
                    <div className="space-y-2">
                      <Label>{copy.allergies}</Label>
                      <Input
                        value={parseTags(record.reservation.allergies)}
                        disabled={readOnly}
                        onChange={(e) => updateReservation('allergies', splitTags(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">{copy.commaHint}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>{copy.preferences}</Label>
                      <Input
                        value={parseTags(record.reservation.preferences)}
                        disabled={readOnly}
                        onChange={(e) => updateReservation('preferences', splitTags(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">{copy.commaHint}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>{copy.dietaryNotes}</Label>
                      <Textarea
                        value={record.reservation.dietaryNotes}
                        disabled={readOnly}
                        onChange={(e) => updateReservation('dietaryNotes', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{copy.mobilityNotes}</Label>
                      <Textarea
                        value={record.reservation.mobilityNotes}
                        disabled={readOnly}
                        onChange={(e) => updateReservation('mobilityNotes', e.target.value)}
                      />
                    </div>
                  </section>

                  <section className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Waves className="h-4 w-4 text-muted-foreground" />
                      {copy.opsSectionTitle}
                    </h3>
                    <div className="space-y-2">
                      <Label>{copy.occasionNotes}</Label>
                      <Textarea
                        value={record.reservation.occasionNotes}
                        disabled={readOnly}
                        onChange={(e) => updateReservation('occasionNotes', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{copy.conciergeNotes}</Label>
                      <Textarea
                        value={record.reservation.conciergeNotes}
                        disabled={readOnly}
                        onChange={(e) => updateReservation('conciergeNotes', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{copy.internalNotes}</Label>
                      <Textarea
                        value={record.reservation.internalNotes}
                        disabled={readOnly}
                        onChange={(e) => updateReservation('internalNotes', e.target.value)}
                      />
                    </div>
                    <Separator />
                    <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                      {record.auditSummary ? (
                        <>
                          <p>
                            {copy.status}: {record.reservation.status || event.status}
                          </p>
                          <p>
                            {copy.actionDeckTitle}: {record.auditSummary.lastAction || '-'}
                          </p>
                          <p>
                            {copy.when}: {record.auditSummary.lastActionAt || '-'}
                          </p>
                        </>
                      ) : (
                        <p>{copy.noAudit}</p>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            ) : null}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-end gap-2 border-t border-border/70 bg-card px-4 py-3 sm:p-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {copy.close}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
