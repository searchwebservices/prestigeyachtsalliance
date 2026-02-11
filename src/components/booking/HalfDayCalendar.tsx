import { addDays, endOfMonth, format, getDay, startOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DayAvailability } from '@/lib/bookingPolicy';

type HalfSelection = 'am' | 'pm' | null;

type Props = {
  monthKey: string;
  days: Record<string, DayAvailability>;
  requestedHours: number;
  selectedDate: string | null;
  selectedHalf: HalfSelection;
  onSelect: (selection: { date: string; half: HalfSelection }) => void;
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const stateClass = (state: DayAvailability['am']) => {
  if (state === 'available') return 'bg-background border border-border/70 text-foreground';
  if (state === 'booked') return 'bg-rose-500/85 text-white';
  return 'bg-muted-foreground/30 text-muted-foreground';
};

const isFullDaySelectable = (day: DayAvailability) =>
  day.am === 'available' && day.pm === 'available' && day.fullOpen;

export default function HalfDayCalendar({
  monthKey,
  days,
  requestedHours,
  selectedDate,
  selectedHalf,
  onSelect,
}: Props) {
  const monthStart = startOfMonth(new Date(`${monthKey}-01T00:00:00`));
  const monthEnd = endOfMonth(monthStart);
  const gridStart = addDays(monthStart, -getDay(monthStart));

  const cells = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base md:text-lg">Select Date</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-3 md:p-4 pt-0">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
          {WEEKDAY_LABELS.map((weekday) => (
            <div key={weekday} className="py-1">
              {weekday}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cellDate) => {
            const dateKey = format(cellDate, 'yyyy-MM-dd');
            const isCurrentMonth = cellDate >= monthStart && cellDate <= monthEnd;
            const day = days[dateKey] || { am: 'closed', pm: 'closed', fullOpen: false };
            const isSelectedDate = selectedDate === dateKey;
            const fullDayMode = requestedHours >= 5;
            const fullDaySelectable = isFullDaySelectable(day);
            const fullDaySelected = isSelectedDate && fullDayMode;

            return (
              <div
                key={dateKey}
                className={`rounded-md border border-border/40 p-1 transition ${
                  isCurrentMonth ? 'bg-card' : 'bg-muted/20 opacity-45'
                } ${fullDaySelected ? 'ring-2 ring-primary' : ''}`}
              >
                <div className="mb-1 text-center text-xs font-medium text-foreground">
                  {format(cellDate, 'd')}
                </div>

                <div className="grid grid-cols-1 gap-1">
                  <button
                    type="button"
                    disabled={!isCurrentMonth || fullDayMode || day.am !== 'available'}
                    onClick={() => onSelect({ date: dateKey, half: 'am' })}
                    className={`h-7 rounded text-[10px] font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${stateClass(
                      day.am
                    )} ${
                      !fullDayMode && isSelectedDate && selectedHalf === 'am'
                        ? 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                        : ''
                    }`}
                  >
                    AM
                  </button>

                  <button
                    type="button"
                    disabled={!isCurrentMonth || fullDayMode || day.pm !== 'available'}
                    onClick={() => onSelect({ date: dateKey, half: 'pm' })}
                    className={`h-7 rounded text-[10px] font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${stateClass(
                      day.pm
                    )} ${
                      !fullDayMode && isSelectedDate && selectedHalf === 'pm'
                        ? 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                        : ''
                    }`}
                  >
                    PM
                  </button>
                </div>

                {fullDayMode && (
                  <button
                    type="button"
                    disabled={!isCurrentMonth || !fullDaySelectable}
                    onClick={() => onSelect({ date: dateKey, half: null })}
                    className={`mt-1 h-6 w-full rounded text-[10px] font-semibold transition ${
                      fullDaySelectable
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'bg-muted-foreground/30 text-muted-foreground'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    Full
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
