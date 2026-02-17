import { useMemo } from "react";
import { AdminCalendarEvent } from "./types";
import EventBlock from "./EventBlock";
import { useIsMobile } from "@/hooks/use-mobile";

type Copy = {
  loading: string;
  empty: string;
  gmtLabel: string;
  horizontalScrollHint: string;
  agendaLabel: string;
};

type TimeMarker = {
  dateKey: string;
  minutes: number;
};

type Props = {
  dates: Date[];
  events: AdminCalendarEvent[];
  timezone: string;
  language: "en" | "es";
  loading: boolean;
  hourStart?: number;
  hourEnd?: number;
  nowMarker: TimeMarker | null;
  copy: Copy;
  onEventClick: (event: AdminCalendarEvent) => void;
};

const HOUR_HEIGHT = 56;

const pad2 = (value: number) => String(value).padStart(2, "0");

const toTimeZoneParts = (isoString: string, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date(isoString));
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type === "literal") continue;
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
  const period = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}:${pad2(minute)} ${period}`;
};

const formatHourLabel = (hour: number) => {
  const period = hour >= 12 ? "pm" : "am";
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalized}:00${period}`;
};

export default function TimeGrid({
  dates,
  events,
  timezone,
  language,
  loading,
  hourStart = 5,
  hourEnd = 19,
  nowMarker,
  copy,
  onEventClick,
}: Props) {
  const isMobile = useIsMobile();
  const totalHours = hourEnd - hourStart;
  const bodyHeight = totalHours * HOUR_HEIGHT;
  const pxPerMinute = HOUR_HEIGHT / 60;

  const dateKeys = useMemo(
    () =>
      dates.map((date) =>
        new Intl.DateTimeFormat("en-CA", {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
          .format(date)
          .split("/")
          .join("-"),
      ),
    [dates, timezone],
  );

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, AdminCalendarEvent[]>();

    for (const event of events) {
      const start = toTimeZoneParts(event.startIso, timezone);
      const list = grouped.get(start.dateKey) || [];
      list.push(event);
      grouped.set(start.dateKey, list);
    }

    for (const key of grouped.keys()) {
      const sorted = grouped
        .get(key)!
        .slice()
        .sort(
          (a, b) =>
            new Date(a.startIso).getTime() - new Date(b.startIso).getTime(),
        );
      grouped.set(key, sorted);
    }

    return grouped;
  }, [events, timezone]);

  const locale = language === "es" ? "es-MX" : "en-US";

  const agendaItems = useMemo(
    () =>
      events
        .map((event) => {
          const start = new Date(event.startIso);
          const end = new Date(event.endIso);

          return {
            event,
            startsAt: start.getTime(),
            dateKey: toTimeZoneParts(event.startIso, timezone).dateKey,
            dateLabel: new Intl.DateTimeFormat(locale, {
              weekday: "short",
              day: "numeric",
              month: "short",
            }).format(start),
            timeLabel: `${new Intl.DateTimeFormat(locale, {
              hour: "numeric",
              minute: "2-digit",
              timeZone: timezone,
            }).format(start)} - ${new Intl.DateTimeFormat(locale, {
              hour: "numeric",
              minute: "2-digit",
              timeZone: timezone,
            }).format(end)}`,
          };
        })
        .sort((a, b) => a.startsAt - b.startsAt),
    [events, locale, timezone],
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-5 text-sm text-muted-foreground">
        {copy.loading}
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-3">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {copy.agendaLabel}
        </p>

        {agendaItems.length === 0 ? (
          <div className="text-sm text-muted-foreground">{copy.empty}</div>
        ) : null}

        <div className="space-y-2">
          {agendaItems.map(({ event, dateKey, dateLabel, timeLabel }) => (
            <button
              key={event.id}
              type="button"
              onClick={() => onEventClick(event)}
              className="w-full rounded-lg border border-border/70 bg-background p-3 text-left shadow-sm transition hover:border-primary/40"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {dateLabel}
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {event.title}
              </p>
              <p className="text-xs text-muted-foreground">{timeLabel}</p>
              <p className="text-xs text-muted-foreground">
                {event.attendeeName || event.attendeeEmail || dateKey}
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card">
      <div className="px-4 pt-3 text-xs text-muted-foreground">
        {copy.horizontalScrollHint}
      </div>
      <div>
        <div className="min-w-[980px]">
            <div
              className="grid border-b border-border/70 bg-muted/30"
              style={{
                gridTemplateColumns: `72px repeat(${dates.length}, minmax(130px, 1fr))`,
              }}
            >
              <div className="border-r border-border/70 px-2 py-2 text-xs font-medium text-muted-foreground">
                {copy.gmtLabel}
              </div>
              {dates.map((date, index) => {
                const dayLabel = new Intl.DateTimeFormat(locale, {
                  weekday: "short",
                  day: "numeric",
                  month: dates.length === 1 ? "short" : undefined,
                })
                  .format(date)
                  .toUpperCase();

                return (
                  <div
                    key={dateKeys[index]}
                    className="snap-start border-r border-border/70 px-2 py-2 text-xs font-semibold text-muted-foreground last:border-r-0"
                  >
                    {dayLabel}
                  </div>
                );
              })}
            </div>

            <div
              className="grid"
              style={{
                gridTemplateColumns: `72px repeat(${dates.length}, minmax(130px, 1fr))`,
                height: bodyHeight,
              }}
            >
              <div className="relative border-r border-border/70 bg-muted/20">
                {Array.from({ length: totalHours + 1 }).map((_, index) => {
                  const hour = hourStart + index;
                  const top = index * HOUR_HEIGHT;
                  return (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 -translate-y-1/2 px-2 text-xs text-muted-foreground"
                      style={{ top }}
                    >
                      {formatHourLabel(hour)}
                    </div>
                  );
                })}
              </div>

              {dateKeys.map((dateKey) => {
                const dayEvents = eventsByDate.get(dateKey) || [];

                return (
                  <div
                    key={dateKey}
                    className="relative snap-start border-r border-border/70 last:border-r-0"
                  >
                    {Array.from({ length: totalHours + 1 }).map((_, index) => (
                      <div
                        key={index}
                        className="absolute left-0 right-0 border-t border-border/60"
                        style={{ top: index * HOUR_HEIGHT }}
                      />
                    ))}

                    {dayEvents.map((event) => {
                      const start = toTimeZoneParts(event.startIso, timezone);
                      const end = toTimeZoneParts(event.endIso, timezone);

                      const startMinutes = start.hour * 60 + start.minute;
                      const rawEndMinutes =
                        end.dateKey === start.dateKey
                          ? end.hour * 60 + end.minute
                          : hourEnd * 60;

                      const clampedStart = Math.max(
                        startMinutes,
                        hourStart * 60,
                      );
                      const clampedEnd = Math.min(rawEndMinutes, hourEnd * 60);

                      if (clampedEnd <= clampedStart) return null;

                      const top = (clampedStart - hourStart * 60) * pxPerMinute;
                      const height = Math.max(
                        22,
                        (clampedEnd - clampedStart) * pxPerMinute,
                      );
                      const label = `${formatHour(start.hour, start.minute)} - ${formatHour(end.hour, end.minute)}`;

                      return (
                        <EventBlock
                          key={event.id}
                          event={event}
                          label={label}
                          onClick={onEventClick}
                          style={{
                            top,
                            height,
                          }}
                        />
                      );
                    })}

                    {nowMarker &&
                    nowMarker.dateKey === dateKey &&
                    nowMarker.minutes >= hourStart * 60 &&
                    nowMarker.minutes <= hourEnd * 60 ? (
                      <div
                        className="absolute left-0 right-0 z-30 border-t border-rose-500"
                        style={{
                          top:
                            (nowMarker.minutes - hourStart * 60) * pxPerMinute,
                        }}
                      />
                    ) : null}
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {!loading && events.length === 0 ? (
        <div className="border-t border-border/70 p-4 text-sm text-muted-foreground">
          {copy.empty}
        </div>
      ) : null}
    </div>
  );
}
