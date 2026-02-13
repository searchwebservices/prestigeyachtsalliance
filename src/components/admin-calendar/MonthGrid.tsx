import { useMemo, useState } from 'react';
import { addDays, startOfMonth, endOfMonth, getDay, format, isSameMonth } from 'date-fns';
import { AdminCalendarEvent } from './types';
import { Badge } from '@/components/ui/badge';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

type Copy = {
  loading: string;
  empty: string;
};

type Props = {
  anchorDate: Date;
  events: AdminCalendarEvent[];
  timezone: string;
  language: 'en' | 'es';
  loading: boolean;
  copy: Copy;
  onEventClick: (event: AdminCalendarEvent) => void;
};

const WEEKDAY_LABELS = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  es: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
};

const toDateKey = (isoString: string, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date(isoString)).split('/').join('-');
};

const toTimeParts = (isoString: string, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return formatter.format(new Date(isoString));
};

const statusDot = (status: string) => {
  const s = status.toLowerCase();
  if (s === 'confirmed' || s === 'accepted') return 'bg-emerald-500';
  if (s === 'unconfirmed' || s === 'pending') return 'bg-amber-500';
  if (s === 'cancelled' || s === 'canceled') return 'bg-rose-500';
  return 'bg-primary';
};

export default function MonthGrid({
  anchorDate,
  events,
  timezone,
  language,
  loading,
  copy,
  onEventClick,
}: Props) {
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const monthStart = startOfMonth(anchorDate);
  const monthEnd = endOfMonth(anchorDate);
  const gridStart = addDays(monthStart, -getDay(monthStart));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const weekdays = WEEKDAY_LABELS[language];

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, AdminCalendarEvent[]>();
    for (const event of events) {
      const key = toDateKey(event.startIso, timezone);
      const list = grouped.get(key) || [];
      list.push(event);
      grouped.set(key, list);
    }
    for (const key of grouped.keys()) {
      grouped.get(key)!.sort(
        (a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime()
      );
    }
    return grouped;
  }, [events, timezone]);

  const todayKey = toDateKey(new Date().toISOString(), timezone);
  const selectedDateEvents = selectedDateKey ? eventsByDate.get(selectedDateKey) || [] : [];
  const selectedDate = selectedDateKey ? new Date(`${selectedDateKey}T00:00:00`) : null;
  const dateLabelFormatter = new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  if (loading) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-5 text-sm text-muted-foreground">
        {copy.loading}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card">
      <div className="grid grid-cols-7 border-b border-border/70 bg-muted/30">
        {weekdays.map((label) => (
          <div
            key={label}
            className="border-r border-border/70 px-2 py-2 text-center text-xs font-semibold text-muted-foreground last:border-r-0"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="hidden grid-cols-7 md:grid">
        {cells.map((cellDate) => {
          const dateKey = format(cellDate, 'yyyy-MM-dd');
          const inMonth = isSameMonth(cellDate, anchorDate);
          const isToday = dateKey === todayKey;
          const dayEvents = eventsByDate.get(dateKey) || [];

          return (
            <div
              key={dateKey}
              className={cn(
                'min-h-[100px] border-b border-r border-border/60 p-1.5 last:border-r-0',
                !inMonth && 'bg-muted/20'
              )}
            >
              <div className="mb-1 flex items-center justify-center">
                <span
                  className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                    isToday && 'bg-primary text-primary-foreground',
                    !isToday && inMonth && 'text-foreground',
                    !isToday && !inMonth && 'text-muted-foreground/50'
                  )}
                >
                  {format(cellDate, 'd')}
                </span>
              </div>

              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onEventClick(event)}
                    className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] leading-tight transition-colors hover:bg-muted/40"
                  >
                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusDot(event.status))} />
                    <span className="truncate text-foreground">
                      {toTimeParts(event.startIso, timezone)} {event.title}
                    </span>
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <p className="px-1 text-[10px] text-muted-foreground">
                    +{dayEvents.length - 3} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-7 md:hidden">
        {cells.map((cellDate) => {
          const dateKey = format(cellDate, 'yyyy-MM-dd');
          const inMonth = isSameMonth(cellDate, anchorDate);
          const isToday = dateKey === todayKey;
          const dayEvents = eventsByDate.get(dateKey) || [];

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => setSelectedDateKey(dateKey)}
              className={cn(
                'min-h-[88px] border-b border-r border-border/60 p-2 text-left last:border-r-0',
                !inMonth && 'bg-muted/20'
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={cn(
                    'inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold',
                    isToday && 'bg-primary text-primary-foreground',
                    !isToday && inMonth && 'text-foreground',
                    !isToday && !inMonth && 'text-muted-foreground/50'
                  )}
                >
                  {format(cellDate, 'd')}
                </span>
                {dayEvents.length > 0 && (
                  <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px] font-medium">
                    {dayEvents.length} {language === 'es' ? 'reservas' : 'bookings'}
                  </Badge>
                )}
              </div>
              {dayEvents.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {toTimeParts(dayEvents[0].startIso, timezone)}
                  {dayEvents.length > 1 ? ` • +${dayEvents.length - 1}` : ''}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground/70">&nbsp;</p>
              )}
            </button>
          );
        })}
      </div>

      <Drawer open={Boolean(selectedDateKey)} onOpenChange={(open) => !open && setSelectedDateKey(null)}>
        <DrawerContent className="md:hidden">
          <DrawerHeader className="text-left">
            <DrawerTitle>
              {selectedDate ? dateLabelFormatter.format(selectedDate) : language === 'es' ? 'Eventos' : 'Events'}
            </DrawerTitle>
            <DrawerDescription>
              {selectedDateEvents.length > 0
                ? `${selectedDateEvents.length} ${language === 'es' ? 'reservas programadas' : 'bookings scheduled'}`
                : copy.empty}
            </DrawerDescription>
          </DrawerHeader>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto px-4 pb-6">
            {selectedDateEvents.map((event) => (
              <DrawerClose asChild key={event.id}>
                <button
                  type="button"
                  onClick={() => onEventClick(event)}
                  className="flex w-full items-start gap-2 rounded-lg border border-border/70 px-3 py-3 text-left"
                >
                  <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', statusDot(event.status))} />
                  <span className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {toTimeParts(event.startIso, timezone)} · {event.yachtName}
                    </p>
                  </span>
                </button>
              </DrawerClose>
            ))}
            {selectedDateEvents.length === 0 && (
              <p className="rounded-lg border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
                {copy.empty}
              </p>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {events.length === 0 && (
        <div className="border-t border-border/70 p-4 text-sm text-muted-foreground">
          {copy.empty}
        </div>
      )}
    </div>
  );
}
