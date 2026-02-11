import { FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BOOKING_MAX_HOURS, BOOKING_MIN_HOURS, PM_MAX_HOURS } from '@/lib/bookingPolicy';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        }
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

type HalfSelection = 'am' | 'pm' | null;

type SubmitPayload = {
  requestedHours: number;
  attendee: {
    name: string;
    email: string;
    phoneNumber?: string;
  };
  notes: string;
  cfToken: string | null;
};

type Props = {
  requestedHours: number;
  selectedDate: string | null;
  selectedHalf: HalfSelection;
  isSubmitting: boolean;
  turnstileSiteKey?: string;
  onRequestedHoursChange: (hours: number) => void;
  onHalfChange: (half: HalfSelection) => void;
  onSubmit: (payload: SubmitPayload) => Promise<void> | void;
};

const TURNSTILE_SCRIPT_ID = 'cf-turnstile-script';

const formatHour = (hour24: number) => {
  const normalized = ((hour24 % 24) + 24) % 24;
  const suffix = normalized >= 12 ? 'PM' : 'AM';
  const hour12 = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${hour12}:00 ${suffix}`;
};

const getRangeLabel = (requestedHours: number, half: HalfSelection) => {
  if (!half) return 'Select AM or PM';
  const startHour = half === 'am' ? 8 : 13;
  const endHour = startHour + requestedHours;
  return `${formatHour(startHour)} - ${formatHour(endHour)}`;
};

function TurnstileWidget({
  siteKey,
  onTokenChange,
}: {
  siteKey: string;
  onTokenChange: (token: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const renderWidget = () => {
      if (!mounted || !window.turnstile || !containerRef.current || widgetIdRef.current) return;

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onTokenChange(token),
        'expired-callback': () => onTokenChange(null),
        'error-callback': () => onTokenChange(null),
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      let script = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = TURNSTILE_SCRIPT_ID;
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onload = renderWidget;
        document.body.appendChild(script);
      } else {
        script.addEventListener('load', renderWidget);
      }
    }

    return () => {
      mounted = false;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
      onTokenChange(null);
    };
  }, [siteKey, onTokenChange]);

  return <div ref={containerRef} />;
}

export default function BookingForm({
  requestedHours,
  selectedDate,
  selectedHalf,
  isSubmitting,
  turnstileSiteKey,
  onRequestedHoursChange,
  onHalfChange,
  onSubmit,
}: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [cfToken, setCfToken] = useState<string | null>(null);

  const hasValidSelection = !!selectedDate && !!selectedHalf;
  const pmExceeded = selectedHalf === 'pm' && requestedHours > PM_MAX_HOURS;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!hasValidSelection || pmExceeded) return;
    if (!name.trim() || !email.trim()) return;
    if (turnstileSiteKey && !cfToken) return;

    await onSubmit({
      requestedHours,
      attendee: {
        name: name.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
      },
      notes: notes.trim(),
      cfToken,
    });
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base md:text-lg">Booking Details</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hours">Requested Hours</Label>
            <select
              id="hours"
              value={requestedHours}
              onChange={(event) => onRequestedHoursChange(Number(event.target.value))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {Array.from(
                { length: BOOKING_MAX_HOURS - BOOKING_MIN_HOURS + 1 },
                (_, index) => BOOKING_MIN_HOURS + index
              ).map((hours) => (
                <option key={hours} value={hours}>
                  {hours} {hours === 1 ? 'hour' : 'hours'}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Select AM (starts 08:00, up to 8h) or PM (starts 13:00, up to 6h). 5+ hour bookings
              block the full day regardless of selected start half.
            </p>
            <p className="text-xs text-muted-foreground">
              Time range: <span className="font-medium">{getRangeLabel(requestedHours, selectedHalf)}</span>
            </p>
            {pmExceeded && (
              <p className="text-xs text-destructive font-medium">
                PM supports up to {PM_MAX_HOURS}h. Please reduce hours or select AM.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="segment">Segment</Label>
            <select
              id="segment"
              value={selectedHalf || ''}
              onChange={(event) =>
                onHalfChange(event.target.value === 'am' || event.target.value === 'pm' ? event.target.value : null)
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select segment</option>
              <option value="am">AM (starts 08:00)</option>
              <option value="pm" disabled={requestedHours > PM_MAX_HOURS}>
                PM (starts 13:00)
              </option>
            </select>
          </div>

          <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
            <p>
              <span className="font-medium">Selected date:</span> {selectedDate || 'Not selected'}
            </p>
            <p>
              <span className="font-medium">Segment:</span>{' '}
              {selectedHalf ? selectedHalf.toUpperCase() : 'Not selected'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input
              id="phone"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="+52..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Any details for the booking team"
            />
          </div>

          {turnstileSiteKey ? (
            <div className="space-y-2">
              <Label>Verification</Label>
              <TurnstileWidget siteKey={turnstileSiteKey} onTokenChange={setCfToken} />
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={!hasValidSelection || pmExceeded || isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Booking Request'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
