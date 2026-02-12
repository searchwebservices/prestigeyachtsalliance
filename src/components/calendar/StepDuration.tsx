import { BOOKING_MAX_HOURS, BOOKING_MIN_HOURS } from '@/lib/bookingPolicy';
import { cn } from '@/lib/utils';

type Props = {
  requestedHours: number | null;
  disabledHours?: number[];
  onSelectHours: (hours: number) => void;
  hoursLabel: string;
  helperCopy: {
    defaultText: string;
    threeHours: string;
    fourHours: string;
    fivePlusHours: string;
  };
};

const getHelperText = (
  requestedHours: number | null,
  helperCopy: Props['helperCopy']
) => {
  if (requestedHours === 3) return helperCopy.threeHours;
  if (requestedHours === 4) return helperCopy.fourHours;
  if (requestedHours && requestedHours >= 5) return helperCopy.fivePlusHours;
  return helperCopy.defaultText;
};

export default function StepDuration({
  requestedHours,
  disabledHours = [],
  onSelectHours,
  hoursLabel,
  helperCopy,
}: Props) {
  const disabledSet = new Set(disabledHours);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from(
          { length: BOOKING_MAX_HOURS - BOOKING_MIN_HOURS + 1 },
          (_, index) => BOOKING_MIN_HOURS + index
        ).map((hours) => {
          const selected = requestedHours === hours;
          const disabled = disabledSet.has(hours);
          return (
            <button
              key={hours}
              type="button"
              disabled={disabled}
              onClick={() => onSelectHours(hours)}
              className={cn(
                'rounded-xl border p-4 text-center transition-colors',
                selected
                  ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                  : disabled
                    ? 'cursor-not-allowed border-border/25 bg-muted/70 text-muted-foreground/55'
                    : 'border-border/60 bg-card hover:border-primary/40 hover:bg-muted/30'
              )}
            >
              <p className={cn('text-2xl font-semibold', disabled ? 'text-muted-foreground/60' : 'text-foreground')}>
                {hours}
              </p>
              <p className={cn('text-sm', disabled ? 'text-muted-foreground/55' : 'text-muted-foreground')}>
                {hoursLabel}
              </p>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">{getHelperText(requestedHours, helperCopy)}</p>
      </div>
    </div>
  );
}
