import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, RefreshCcw, Trash2, UserRound, Waves } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import StepDay from '@/components/calendar/StepDay';
import StepDuration from '@/components/calendar/StepDuration';
import StepStartTimes from '@/components/calendar/StepStartTimes';
import { DayAvailability, getDurationKey } from '@/lib/bookingPolicy';
import {
  AdminCalendarEvent,
  CalendarActionResult,
  CalendarActionView,
  RescheduleDraft,
} from './types';

type Copy = {
  titleFallback: string;
  bookingUid: string;
  bookingId: string;
  yacht: string;
  status: string;
  attendee: string;
  attendeeEmail: string;
  attendeePhone: string;
  notes: string;
  noNotes: string;
  openCal: string;
  when: string;
  duration: string;
  actionDeckTitle: string;
  actionDeckDescription: string;
  changeReservation: string;
  removeReservation: string;
  close: string;
  rescheduleTitle: string;
  removeTitle: string;
  removeDescription: string;
  removeReasonLabel: string;
  removeReasonPlaceholder: string;
  removeConfirm: string;
  cancelAction: string;
  saveChanges: string;
  saving: string;
  removeInProgress: string;
  updateInProgress: string;
  actionUnavailable: string;
  actionErrorFallback: string;
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
  removeReasonRequired: string;
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

type Props = {
  event: AdminCalendarEvent | null;
  open: boolean;
  timezone: string;
  availability: AvailabilityState;
  copy: Copy;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
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

const formatHour = (hour: number, minute: number) => {
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
  if (minutes <= 0) return null;
  if (minutes % 60 !== 0) return null;
  const hours = minutes / 60;
  return hours >= 3 && hours <= 8 ? hours : null;
};

const buildDraft = (event: AdminCalendarEvent | null, timezone: string): RescheduleDraft => {
  if (!event) {
    return {
      date: null,
      requestedHours: null,
      startHour: null,
      isDateValid: false,
      isDurationValid: false,
      isStartValid: false,
    };
  }

  const start = toTimeZoneParts(event.startIso, timezone);
  const requestedHours = getDurationHours(event.startIso, event.endIso);

  return {
    date: start.dateKey,
    requestedHours,
    startHour: requestedHours ? start.hour : null,
    isDateValid: true,
    isDurationValid: requestedHours !== null,
    isStartValid: requestedHours !== null,
  };
};

const withValidation = (draft: Omit<RescheduleDraft, 'isDateValid' | 'isDurationValid' | 'isStartValid'>): RescheduleDraft => ({
  ...draft,
  isDateValid: !!draft.date,
  isDurationValid: draft.requestedHours !== null,
  isStartValid: draft.startHour !== null,
});

export default function EventDrawer({
  event,
  open,
  timezone,
  availability,
  copy,
  onPreviousMonth,
  onNextMonth,
  onSubmitReschedule,
  onSubmitCancel,
  onOpenChange,
}: Props) {
  const [mode, setMode] = useState<CalendarActionView>('view');
  const [pendingAction, setPendingAction] = useState<'reschedule' | 'cancel' | null>(null);
  const [draft, setDraft] = useState<RescheduleDraft>(() => buildDraft(event, timezone));
  const [removeReason, setRemoveReason] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode('view');
    setPendingAction(null);
    setInlineError(null);
    setRemoveReason('');
    setDraft(buildDraft(event, timezone));
  }, [event, open, timezone]);

  const selectedDay = useMemo(
    () => (draft.date ? availability.days[draft.date] || null : null),
    [availability.days, draft.date]
  );

  const startHourOptions = useMemo(() => {
    if (!selectedDay || !draft.requestedHours) return [];
    const key = getDurationKey(draft.requestedHours);
    if (!key) return [];
    return [...selectedDay.validStartsByDuration[key]].sort((a, b) => a - b);
  }, [draft.requestedHours, selectedDay]);

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

  useEffect(() => {
    if (!open) return;
    if (!draft.date || !draft.requestedHours) return;

    if (startHourOptions.length === 0) {
      if (draft.startHour !== null) {
        setDraft((prev) => withValidation({ ...prev, startHour: null }));
      }
      return;
    }

    if (draft.startHour === null || !startHourOptions.includes(draft.startHour)) {
      setDraft((prev) => withValidation({ ...prev, startHour: startHourOptions[0] }));
    }
  }, [draft.date, draft.requestedHours, draft.startHour, open, startHourOptions]);

  const isRescheduleMode = mode === 'reschedule' || (mode === 'submitting' && pendingAction === 'reschedule');
  const isRemoveMode = mode === 'remove_confirm' || (mode === 'submitting' && pendingAction === 'cancel');
  const isSubmitting = mode === 'submitting';

  const canSubmitReschedule =
    !!event?.bookingUid &&
    draft.date !== null &&
    draft.requestedHours !== null &&
    draft.startHour !== null &&
    startHourOptions.includes(draft.startHour);

  const canSubmitRemove = !!event?.bookingUid && removeReason.trim().length > 0;

  if (!event) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[420px] sm:max-w-[560px]" />
      </Sheet>
    );
  }

  const start = toTimeZoneParts(event.startIso, timezone);
  const end = toTimeZoneParts(event.endIso, timezone);

  const handleStartReschedule = () => {
    setInlineError(null);
    setMode('reschedule');
  };

  const handleStartRemove = () => {
    setInlineError(null);
    setMode('remove_confirm');
  };

  const handleCancelMode = () => {
    setPendingAction(null);
    setInlineError(null);
    setMode('view');
  };

  const handleRescheduleSubmit = async () => {
    if (!event.bookingUid || !canSubmitReschedule || !draft.date || !draft.requestedHours || draft.startHour === null) {
      return;
    }

    setInlineError(null);
    setPendingAction('reschedule');
    setMode('submitting');

    const result = await onSubmitReschedule({
      bookingUid: event.bookingUid,
      date: draft.date,
      requestedHours: draft.requestedHours,
      startHour: draft.startHour,
      event,
    });

    if (!result.ok) {
      setInlineError(result.error || copy.actionErrorFallback);
      setPendingAction(null);
      setMode('reschedule');
      return;
    }

    setPendingAction(null);
    setMode('view');
  };

  const handleRemoveSubmit = async () => {
    if (!event.bookingUid) return;
    if (!removeReason.trim()) {
      setInlineError(copy.removeReasonRequired);
      return;
    }

    setInlineError(null);
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

    setPendingAction(null);
    setMode('view');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[440px] space-y-4 overflow-y-auto sm:max-w-[620px]">
        <SheetHeader>
          <SheetTitle>{event.title || copy.titleFallback}</SheetTitle>
          <SheetDescription>{event.yachtName}</SheetDescription>
        </SheetHeader>

        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 via-card to-sky-50/30 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.when}</p>
              <p className="text-sm font-semibold text-foreground">
                {start.dateKey} · {formatHour(start.hour, start.minute)} - {formatHour(end.hour, end.minute)}
              </p>
            </div>
            <Badge variant="secondary" className="uppercase">
              {event.status || 'booked'}
            </Badge>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-background/80 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{copy.duration}</p>
              <p className="font-semibold text-foreground">{formatDuration(event.startIso, event.endIso)}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/80 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{copy.bookingUid}</p>
              <p className="truncate font-semibold text-foreground">{event.bookingUid || '-'}</p>
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

        {isRescheduleMode ? (
          <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{copy.rescheduleTitle}</p>
              <Button type="button" variant="ghost" size="sm" onClick={handleCancelMode} disabled={isSubmitting}>
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
                selectedDate={draft.date}
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
                  setDraft(
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
                requestedHours={draft.requestedHours}
                disabledHours={disabledDurationHours}
                onSelectHours={(hours) =>
                  setDraft((prev) =>
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
                requestedHours={draft.requestedHours || 3}
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
                  setDraft((prev) =>
                    withValidation({
                      ...prev,
                      startHour: hour,
                    })
                  )
                }
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleCancelMode} disabled={isSubmitting}>
                {copy.cancelAction}
              </Button>
              <Button type="button" onClick={handleRescheduleSubmit} disabled={!canSubmitReschedule || isSubmitting}>
                {isSubmitting ? copy.updateInProgress : copy.saveChanges}
              </Button>
            </div>
          </div>
        ) : null}

        {isRemoveMode ? (
          <div className="space-y-4 rounded-xl border border-rose-200 bg-rose-50/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{copy.removeTitle}</p>
              <Button type="button" variant="ghost" size="sm" onClick={handleCancelMode} disabled={isSubmitting}>
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
              <Button type="button" variant="outline" onClick={handleCancelMode} disabled={isSubmitting}>
                {copy.cancelAction}
              </Button>
              <Button type="button" variant="destructive" onClick={handleRemoveSubmit} disabled={!canSubmitRemove || isSubmitting}>
                {isSubmitting ? copy.removeInProgress : copy.removeConfirm}
              </Button>
            </div>
          </div>
        ) : null}

        {mode === 'view' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-border/70 bg-card p-4 text-sm md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.yacht}</p>
                <p className="font-medium text-foreground">{event.yachtName} ({event.yachtSlug})</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.bookingId}</p>
                <p className="truncate font-medium text-foreground">{event.id || '-'}</p>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-card p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <UserRound className="h-4 w-4 text-muted-foreground" />
                {copy.attendee}
              </div>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">{copy.attendee}:</span> {event.attendeeName || '-'}</p>
                <p><span className="font-medium">{copy.attendeeEmail}:</span> {event.attendeeEmail || '-'}</p>
                <p><span className="font-medium">{copy.attendeePhone}:</span> {event.attendeePhone || '-'}</p>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-card p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Waves className="h-4 w-4 text-muted-foreground" />
                {copy.notes}
              </div>
              <p className="rounded-md border border-border/70 bg-muted/20 p-3 text-sm text-foreground">
                {event.notes || copy.noNotes}
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-card p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                {copy.actionDeckTitle}
              </div>
              <p className="mb-3 text-sm text-muted-foreground">{copy.actionDeckDescription}</p>

              {!event.bookingUid ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{copy.actionDeckTitle}</AlertTitle>
                  <AlertDescription>{copy.actionUnavailable}</AlertDescription>
                </Alert>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button type="button" variant="secondary" onClick={handleStartReschedule}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    {copy.changeReservation}
                  </Button>
                  <Button type="button" variant="destructive" onClick={handleStartRemove}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {copy.removeReservation}
                  </Button>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {event.calBookingUrl ? (
                  <Button type="button" variant="outline" asChild>
                    <a href={event.calBookingUrl} target="_blank" rel="noreferrer">
                      {copy.openCal}
                    </a>
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  {copy.close}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
