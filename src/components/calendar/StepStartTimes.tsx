import { formatHour, getShiftFit, getTimeRangeLabel } from '@/lib/bookingPolicy';
import { cn } from '@/lib/utils';

type Copy = {
  timeSectionTitle: string;
  selectDateHint: string;
  noTimesForDate: string;
  selectedTripLabel: string;
  shiftFitLabel: string;
  shiftMorning: string;
  shiftAfternoon: string;
  shiftFlexible: string;
};

type Props = {
  requestedHours: number;
  selectedDate: string | null;
  selectedStartHour: number | null;
  startHourOptions: number[];
  copy: Copy;
  onSelectStartHour: (hour: number) => void;
};

const getShiftLabel = (copy: Copy, startHour: number, endHour: number) => {
  const shiftFit = getShiftFit(startHour, endHour);
  if (shiftFit === 'morning') return copy.shiftMorning;
  if (shiftFit === 'afternoon') return copy.shiftAfternoon;
  return copy.shiftFlexible;
};

export default function StepStartTimes({
  requestedHours,
  selectedDate,
  selectedStartHour,
  startHourOptions,
  copy,
  onSelectStartHour,
}: Props) {
  const summaryText = (() => {
    if (!selectedDate || selectedStartHour === null) return null;
    const endHour = selectedStartHour + requestedHours;
    const timeRange = getTimeRangeLabel(requestedHours, selectedStartHour);
    const shiftLabel = getShiftLabel(copy, selectedStartHour, endHour);
    return `${selectedDate} • ${timeRange} • ${copy.shiftFitLabel}: ${shiftLabel}`;
  })();

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-foreground">{copy.timeSectionTitle}</p>

      {!selectedDate ? (
        <p className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
          {copy.selectDateHint}
        </p>
      ) : startHourOptions.length === 0 ? (
        <p className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
          {copy.noTimesForDate}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {startHourOptions.map((hour) => {
            const selected = selectedStartHour === hour;
            return (
              <button
                key={hour}
                type="button"
                onClick={() => onSelectStartHour(hour)}
                className={cn(
                  'rounded-lg border p-3 text-sm font-medium transition-colors',
                  selected
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                    : 'border-border/60 bg-card text-foreground hover:border-primary/40 hover:bg-muted/20'
                )}
              >
                {formatHour(hour)}
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
        {summaryText ? `${copy.selectedTripLabel}: ${summaryText}` : `${copy.selectedTripLabel}: -`}
      </div>
    </div>
  );
}
