import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type Copy = {
  summaryLabel: string;
  nameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  phoneLabel: string;
  phonePlaceholder: string;
  notesLabel: string;
  notesPlaceholder: string;
};

type Props = {
  summary: string;
  copy: Copy;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string;
  notes: string;
  onAttendeeNameChange: (value: string) => void;
  onAttendeeEmailChange: (value: string) => void;
  onAttendeePhoneChange: (value: string) => void;
  onNotesChange: (value: string) => void;
};

export default function StepClient({
  summary,
  copy,
  attendeeName,
  attendeeEmail,
  attendeePhone,
  notes,
  onAttendeeNameChange,
  onAttendeeEmailChange,
  onAttendeePhoneChange,
  onNotesChange,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{copy.summaryLabel}: </span>
        {summary}
      </div>

      <div className="space-y-2">
        <Label htmlFor="calendar-name">{copy.nameLabel}</Label>
        <Input
          id="calendar-name"
          value={attendeeName}
          onChange={(event) => onAttendeeNameChange(event.target.value)}
          placeholder={copy.namePlaceholder}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="calendar-email">{copy.emailLabel}</Label>
        <Input
          id="calendar-email"
          type="email"
          value={attendeeEmail}
          onChange={(event) => onAttendeeEmailChange(event.target.value)}
          placeholder={copy.emailPlaceholder}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="calendar-phone">{copy.phoneLabel}</Label>
        <Input
          id="calendar-phone"
          value={attendeePhone}
          onChange={(event) => onAttendeePhoneChange(event.target.value)}
          placeholder={copy.phonePlaceholder}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="calendar-notes">{copy.notesLabel}</Label>
        <Textarea
          id="calendar-notes"
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder={copy.notesPlaceholder}
          rows={4}
        />
      </div>
    </div>
  );
}
