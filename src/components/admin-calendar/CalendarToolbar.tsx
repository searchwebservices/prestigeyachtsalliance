import { CalendarViewMode } from './types';
import { Button } from '@/components/ui/button';
import { RefreshCcw, ChevronLeft, ChevronRight } from 'lucide-react';

type CalendarToolbarCopy = {
  today: string;
  previous: string;
  next: string;
  week: string;
  day: string;
  refresh: string;
};

type Props = {
  rangeLabel: string;
  viewMode: CalendarViewMode;
  loading: boolean;
  copy: CalendarToolbarCopy;
  onToday: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onRefresh: () => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
};

export default function CalendarToolbar({
  rangeLabel,
  viewMode,
  loading,
  copy,
  onToday,
  onPrevious,
  onNext,
  onRefresh,
  onViewModeChange,
}: Props) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onToday}>
          {copy.today}
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={onPrevious} aria-label={copy.previous}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={onNext} aria-label={copy.next}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <p className="ml-1 text-sm font-semibold text-foreground">{rangeLabel}</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-md border border-border/80 bg-muted/30 p-1">
          <Button
            type="button"
            size="sm"
            variant={viewMode === 'week' ? 'secondary' : 'ghost'}
            className="h-8"
            onClick={() => onViewModeChange('week')}
          >
            {copy.week}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === 'day' ? 'secondary' : 'ghost'}
            className="h-8"
            onClick={() => onViewModeChange('day')}
          >
            {copy.day}
          </Button>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          {copy.refresh}
        </Button>
      </div>
    </div>
  );
}
