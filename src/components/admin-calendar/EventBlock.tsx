import { CSSProperties } from 'react';
import { Badge } from '@/components/ui/badge';
import { AdminCalendarEvent } from './types';
import { cn } from '@/lib/utils';

type Props = {
  event: AdminCalendarEvent;
  label: string;
  style: CSSProperties;
  onClick: (event: AdminCalendarEvent) => void;
};

const statusTone = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized === 'confirmed' || normalized === 'accepted') return 'border-l-emerald-500';
  if (normalized === 'unconfirmed' || normalized === 'pending') return 'border-l-amber-500';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'border-l-rose-500';
  return 'border-l-primary';
};

export default function EventBlock({ event, label, style, onClick }: Props) {
  return (
    <button
      type="button"
      style={style}
      className={cn(
        'absolute left-1 right-1 z-20 overflow-hidden rounded-md border border-border/70 bg-card p-2 text-left shadow-sm',
        'transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        'border-l-[3px]',
        statusTone(event.status)
      )}
      onClick={() => onClick(event)}
    >
      <p className="truncate text-xs font-semibold text-foreground">{event.title}</p>
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <div className="mt-1">
        <Badge variant="secondary" className="px-1.5 py-0 text-[10px] uppercase tracking-wide">
          {event.status || 'booked'}
        </Badge>
      </div>
    </button>
  );
}
