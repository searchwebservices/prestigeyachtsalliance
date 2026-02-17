import { Anchor, Users, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type CalendarYachtOption = {
  id: string;
  name: string;
  slug: string;
  vessel_type: string;
  capacity: number;
  imageUrl?: string;
  isFlagship?: boolean;
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
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[100px] animate-pulse rounded-xl border border-border/60 bg-muted/50" />
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
    <div className="grid gap-3 sm:grid-cols-2">
      {yachts.map((yacht) => {
        const selected = yacht.slug === selectedYachtSlug;

        return (
          <Card
            key={yacht.id}
            className={cn(
              'overflow-hidden cursor-pointer transition-all duration-300 group',
              selected
                ? 'ring-2 ring-primary shadow-lg'
                : 'hover:shadow-md border-border/50'
            )}
            onClick={() => onSelect(yacht.slug)}
          >
            <div className="flex flex-row h-full">
              {/* Left 1/3 - Image */}
              <div className="relative overflow-hidden bg-muted shrink-0 w-1/3 min-h-[100px]">
                {yacht.imageUrl ? (
                  <img
                    src={yacht.imageUrl}
                    alt={yacht.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Anchor className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                )}
                {yacht.isFlagship && (
                  <Badge className="absolute top-1.5 left-1.5 bg-gold text-primary-foreground border-0 gap-0.5 text-[10px] px-1 py-0">
                    <Star className="fill-current w-2.5 h-2.5" />
                  </Badge>
                )}
              </div>

              {/* Right 2/3 - Info */}
              <div className="flex-1 flex flex-col justify-center px-3 py-2">
                <h3 className="font-semibold text-foreground leading-tight truncate text-base">
                  {yacht.name}
                </h3>
                <p className="text-muted-foreground mt-0.5 truncate text-sm">
                  {yacht.vessel_type}
                </p>
                <div className="flex items-center gap-1.5 text-foreground/80 mt-1 text-sm">
                  <Users className="w-3.5 h-3.5" />
                  <span>{yacht.capacity} guests</span>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
