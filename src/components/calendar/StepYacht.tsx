import { Ship } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type CalendarYachtOption = {
  id: string;
  name: string;
  slug: string;
  vessel_type: string;
  capacity: number;
};

type Props = {
  yachts: CalendarYachtOption[];
  selectedYachtSlug: string | null;
  loading: boolean;
  error: string | null;
  emptyLabel: string;
  capacityLabel: string;
  retryLabel: string;
  onRetry: () => void;
  onSelect: (slug: string) => void;
};

export default function StepYacht({
  yachts,
  selectedYachtSlug,
  loading,
  error,
  emptyLabel,
  capacityLabel,
  retryLabel,
  onRetry,
  onSelect,
}: Props) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl border border-border/60 bg-muted/50" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" className="mt-3" onClick={onRetry}>
          {retryLabel}
        </Button>
      </div>
    );
  }

  if (yachts.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/30 p-5 text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {yachts.map((yacht) => {
        const selected = yacht.slug === selectedYachtSlug;

        return (
          <button
            key={yacht.id}
            type="button"
            onClick={() => onSelect(yacht.slug)}
            className={cn(
              'rounded-xl border p-4 text-left transition-colors',
              selected
                ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                : 'border-border/60 bg-card hover:border-primary/40 hover:bg-muted/30'
            )}
          >
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Ship className="h-4 w-4" />
            </div>
            <p className="font-semibold text-foreground">{yacht.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{yacht.vessel_type}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {capacityLabel}: {yacht.capacity}
            </p>
          </button>
        );
      })}
    </div>
  );
}
