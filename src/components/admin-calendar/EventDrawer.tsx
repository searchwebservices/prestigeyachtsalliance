import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { AdminCalendarEvent } from './types';

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
};

type Props = {
  event: AdminCalendarEvent | null;
  open: boolean;
  timezone: string;
  copy: Copy;
  onOpenChange: (open: boolean) => void;
};

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

const pad2 = (value: number) => String(value).padStart(2, '0');

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

export default function EventDrawer({ event, open, timezone, copy, onOpenChange }: Props) {
  if (!event) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[380px] sm:max-w-[420px]" />
      </Sheet>
    );
  }

  const start = toTimeZoneParts(event.startIso, timezone);
  const end = toTimeZoneParts(event.endIso, timezone);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] space-y-4 overflow-y-auto sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle>{event.title || copy.titleFallback}</SheetTitle>
          <SheetDescription>{event.yachtName}</SheetDescription>
        </SheetHeader>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{copy.status}</span>
            <Badge variant="secondary" className="uppercase">{event.status || 'booked'}</Badge>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{copy.when}</span>
            <span className="text-right font-medium text-foreground">
              {start.dateKey} · {formatHour(start.hour, start.minute)} - {formatHour(end.hour, end.minute)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{copy.duration}</span>
            <span className="font-medium text-foreground">{formatDuration(event.startIso, event.endIso)}</span>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{copy.bookingUid}</span>
            <span className="truncate font-medium text-foreground">{event.bookingUid || '-'}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{copy.bookingId}</span>
            <span className="truncate font-medium text-foreground">{event.id || '-'}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{copy.yacht}</span>
            <span className="truncate font-medium text-foreground">{event.yachtName} ({event.yachtSlug})</span>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{copy.attendee}</span>
            <span className="text-right font-medium text-foreground">{event.attendeeName || '-'}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{copy.attendeeEmail}</span>
            <span className="text-right font-medium text-foreground">{event.attendeeEmail || '-'}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{copy.attendeePhone}</span>
            <span className="text-right font-medium text-foreground">{event.attendeePhone || '-'}</span>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-muted-foreground">{copy.notes}</p>
            <p className="rounded-md border border-border/70 bg-muted/30 p-3 text-sm text-foreground">
              {event.notes || copy.noNotes}
            </p>
          </div>

          {event.calBookingUrl ? (
            <div className="pt-2">
              <a
                className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                href={event.calBookingUrl}
                target="_blank"
                rel="noreferrer"
              >
                {copy.openCal}
              </a>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
