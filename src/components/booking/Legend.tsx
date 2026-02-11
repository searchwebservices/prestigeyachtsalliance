import { Card, CardContent } from '@/components/ui/card';

const LegendChip = ({ label, className }: { label: string; className: string }) => (
  <div className="flex items-center gap-2">
    <span className={`h-3 w-3 rounded-sm ${className}`} />
    <span className="text-sm text-muted-foreground">{label}</span>
  </div>
);

export default function Legend() {
  return (
    <Card className="border-border/60">
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        <LegendChip label="Available" className="bg-background border border-border" />
        <LegendChip label="Booked" className="bg-rose-500" />
        <LegendChip label="Closed" className="bg-muted-foreground/35" />
      </CardContent>
    </Card>
  );
}
