import { cn } from '@/lib/utils';

type Props = {
  step: number;
  totalSteps: number;
  title: string;
  subtitle: string;
  stepLabel: string;
  ofLabel: string;
};

export default function StepHeader({
  step,
  totalSteps,
  title,
  subtitle,
  stepLabel,
  ofLabel,
}: Props) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        {stepLabel} {step} {ofLabel} {totalSteps}
      </p>

      <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${totalSteps}, minmax(0, 1fr))` }}>
        {Array.from({ length: totalSteps }, (_, index) => {
          const isActive = index + 1 <= step;
          return (
            <div
              key={index}
              className={cn(
                'h-2 rounded-full transition-colors',
                isActive ? 'bg-primary' : 'bg-muted'
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
