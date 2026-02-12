import { addDays, endOfMonth, format, getDay, startOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BOOKING_AFTERNOON_START_HOUR,
  BOOKING_MORNING_END_HOUR,
  createEmptyValidStartsByDuration,
  DayAvailability,
  getDurationKey,
} from '@/lib/bookingPolicy';

type Props = {
  monthKey: string;
  days: Record<string, DayAvailability>;
  requestedHours: number;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const stateClass = (state: DayAvailability['am']) => {
  if (state === 'available') return 'bg-background border border-border/70 text-foreground';
  if (state === 'booked') return 'bg-rose-500/85 text-white';
  return 'bg-muted-foreground/30 text-muted-foreground';
};

const EMPTY_DAY: DayAvailability = {
  am: 'closed',
  pm: 'closed',
  fullOpen: false,
  openHours: [],
  validStartsByDuration: createEmptyValidStartsByDuration(),
};

export default function HalfDayCalendar({
  monthKey,
  days,
  requestedHours,
  selectedDate,
  onSelectDate,
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
            const day = days[dateKey] || EMPTY_DAY;
            const isSelectedDate = selectedDate === dateKey;

            const durationKey = getDurationKey(requestedHours);
            const validStarts = durationKey ? day.validStartsByDuration[durationKey] : [];
            const hasAnyStart = validStarts.length > 0;

            const amAvailable = validStarts.some((startHour) => startHour + requestedHours <= BOOKING_MORNING_END_HOUR);
            const pmAvailable = validStarts.some((startHour) => startHour >= BOOKING_AFTERNOON_START_HOUR);

            const amState: DayAvailability['am'] = amAvailable ? 'available' : day.am === 'booked' ? 'booked' : 'closed';
            const pmState: DayAvailability['pm'] = pmAvailable ? 'available' : day.pm === 'booked' ? 'booked' : 'closed';

            return (
              <div
                key={dateKey}
                className={`rounded-md border border-border/40 p-1 transition ${
                  isCurrentMonth ? 'bg-card' : 'bg-muted/20 opacity-45'
                }`}
              >
                <button
                  type="button"
                  disabled={!isCurrentMonth || !hasAnyStart}
                  onClick={() => onSelectDate(dateKey)}
                  className={`mb-1 h-7 w-full rounded text-center text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    hasAnyStart ? 'bg-background border border-border/70 text-foreground' : 'bg-muted/40 text-muted-foreground'
                  } ${isSelectedDate ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}`}
                >
                  {format(cellDate, 'd')}
                </button>

                <div className="grid grid-cols-2 gap-1">
                  <span
                    className={`flex h-6 items-center justify-center rounded text-[10px] font-medium ${stateClass(amState)}`}
                  >
                    AM
                  </span>
                  <span
                    className={`flex h-6 items-center justify-center rounded text-[10px] font-medium ${stateClass(pmState)}`}
                  >
                    PM
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
