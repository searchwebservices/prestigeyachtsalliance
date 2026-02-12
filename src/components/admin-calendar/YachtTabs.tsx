import { AdminCalendarYacht } from './types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  yachts: AdminCalendarYacht[];
  selectedYachtSlug: string | null;
  loading: boolean;
  emptyLabel: string;
  onSelect: (slug: string) => void;
};

export default function YachtTabs({ yachts, selectedYachtSlug, loading, emptyLabel, onSelect }: Props) {
  if (loading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-9 w-36 animate-pulse rounded-md bg-muted/50" />
        ))}
      </div>
    );
  }

  if (yachts.length === 0) {
    return (
      <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {yachts.map((yacht) => {
        const selected = yacht.slug === selectedYachtSlug;
        return (
          <Button
            key={yacht.id}
            type="button"
            variant="ghost"
            className={cn(
              'h-9 shrink-0 rounded-md border px-3 text-sm',
              selected
                ? 'border-primary bg-primary/10 text-primary hover:bg-primary/15'
                : 'border-border/70 bg-card text-muted-foreground hover:bg-muted/40'
            )}
            onClick={() => onSelect(yacht.slug)}
          >
            {yacht.name}
          </Button>
        );
      })}
    </div>
  );
}
