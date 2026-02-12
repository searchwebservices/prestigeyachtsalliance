import { addDays, endOfMonth, format, getDay, startOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DayAvailability } from '@/lib/bookingPolicy';
import { cn } from '@/lib/utils';

type Copy = {
  weekdayLabels: readonly string[];
  previousMonth: string;
  nextMonth: string;
  monthLabel: string;
  noDaysAvailable: string;
};

type Props = {
  monthDate: Date;
  days: Record<string, DayAvailability>;
  selectedDate: string | null;
  minDateKey: string;
  canGoPreviousMonth: boolean;
  copy: Copy;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (date: string) => void;
};

const hasAnyValidStart = (day: DayAvailability) =>
  Object.values(day.validStartsByDuration).some((starts) => starts.length > 0);

export default function StepDay({
  monthDate,
  days,
  selectedDate,
  minDateKey,
  canGoPreviousMonth,
  copy,
  onPreviousMonth,
  onNextMonth,
  onSelectDate,
}: Props) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const gridStart = addDays(monthStart, -getDay(monthStart));
  const cells = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));

  const hasSelectableDayInMonth = cells.some((cellDate) => {
    const isCurrentMonth = cellDate >= monthStart && cellDate <= monthEnd;
    if (!isCurrentMonth) return false;
    const dateKey = format(cellDate, 'yyyy-MM-dd');
    const day = days[dateKey];
    return dateKey >= minDateKey && !!day && hasAnyValidStart(day);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPreviousMonth}
          disabled={!canGoPreviousMonth}
        >
          <ChevronLeft className="h-4 w-4" />
          {copy.previousMonth}
        </Button>
        <p className="text-sm font-semibold text-foreground">{copy.monthLabel}</p>
        <Button type="button" variant="outline" size="sm" onClick={onNextMonth}>
          {copy.nextMonth}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-muted-foreground">
        {copy.weekdayLabels.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {cells.map((cellDate) => {
          const dateKey = format(cellDate, 'yyyy-MM-dd');
          const isCurrentMonth = cellDate >= monthStart && cellDate <= monthEnd;
          const isPastDate = dateKey < minDateKey;
          const day = days[dateKey];
          const selectable = isCurrentMonth && !isPastDate && !!day && hasAnyValidStart(day);
          const selected = selectedDate === dateKey;

          return (
            <button
              key={dateKey}
              type="button"
              disabled={!selectable}
              onClick={() => onSelectDate(dateKey)}
              className={cn(
                'h-12 rounded-lg border text-sm font-medium transition-colors',
                selectable
                  ? 'border-border/60 bg-card text-foreground hover:border-primary/50 hover:bg-muted/20'
                  : 'cursor-not-allowed border-border/25 bg-muted/70 text-muted-foreground/55',
                !isCurrentMonth && 'opacity-65',
                isPastDate && 'bg-muted/80 text-muted-foreground/45',
                selected && selectable && 'border-primary bg-primary/10 ring-2 ring-primary/30'
              )}
            >
              {format(cellDate, 'd')}
            </button>
          );
        })}
      </div>

      {!hasSelectableDayInMonth && (
        <p className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
          {copy.noDaysAvailable}
        </p>
      )}
    </div>
  );
}
