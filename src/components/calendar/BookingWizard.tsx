import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import StepHeader from '@/components/calendar/StepHeader';

type Props = {
  step: number;
  totalSteps: number;
  title: string;
  subtitle: string;
  stepLabel: string;
  ofLabel: string;
  backLabel: string;
  continueLabel: string;
  submitLabel: string;
  submittingLabel: string;
  canGoBack: boolean;
  canContinue: boolean;
  canSubmit: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onContinue: () => void;
  onSubmit: () => void;
  children: ReactNode;
};

export default function BookingWizard({
  step,
  totalSteps,
  title,
  subtitle,
  stepLabel,
  ofLabel,
  backLabel,
  continueLabel,
  submitLabel,
  submittingLabel,
  canGoBack,
  canContinue,
  canSubmit,
  isSubmitting,
  onBack,
  onContinue,
  onSubmit,
  children,
}: Props) {
  const isFinalStep = step === totalSteps;

  return (
    <div className="space-y-6">
      <StepHeader
        step={step}
        totalSteps={totalSteps}
        title={title}
        subtitle={subtitle}
        stepLabel={stepLabel}
        ofLabel={ofLabel}
      />

      <div>{children}</div>

      <div className="flex items-center justify-between border-t border-border/60 pt-4">
        <Button type="button" variant="outline" onClick={onBack} disabled={!canGoBack || isSubmitting}>
          {backLabel}
        </Button>

        {isFinalStep ? (
          <Button type="button" onClick={onSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? submittingLabel : submitLabel}
          </Button>
        ) : (
          <Button type="button" onClick={onContinue} disabled={!canContinue || isSubmitting}>
            {continueLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
