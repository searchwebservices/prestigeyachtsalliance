import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  BOOKING_MAX_HOURS,
  BOOKING_MIN_HOURS,
  formatHour,
  getShiftFit,
  getTimeRangeLabel,
} from '@/lib/bookingPolicy';

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

type SubmitPayload = {
  requestedHours: number;
  startHour: number;
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
  selectedStartHour: number | null;
  startHourOptions: number[];
  isSubmitting: boolean;
  turnstileSiteKey?: string;
  onRequestedHoursChange: (hours: number) => void;
  onStartHourChange: (startHour: number | null) => void;
  onSubmit: (payload: SubmitPayload) => Promise<void> | void;
};

const TURNSTILE_SCRIPT_ID = 'cf-turnstile-script';

const getShiftFitLabel = (shiftFit: 'morning' | 'afternoon' | 'flexible') => {
  if (shiftFit === 'morning') return 'Morning';
  if (shiftFit === 'afternoon') return 'Afternoon';
  return 'Flexible';
};

const getGuardrailCopy = (requestedHours: number) => {
  if (requestedHours === 3) {
    return '3-hour trips must be fully in morning (6:00 AM-1:00 PM) or afternoon (3:00 PM-6:00 PM).';
  }
  if (requestedHours === 4) {
    return '4-hour trips must be fully inside the morning window and end by 1:00 PM.';
  }
  return '5+ hour trips can start any hour from 6:00 AM to 6:00 PM, provided the trip ends by 6:00 PM.';
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
  selectedStartHour,
  startHourOptions,
  isSubmitting,
  turnstileSiteKey,
  onRequestedHoursChange,
  onStartHourChange,
  onSubmit,
}: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [cfToken, setCfToken] = useState<string | null>(null);

  const hasValidSelection = !!selectedDate && selectedStartHour !== null;
  const selectedEndHour = selectedStartHour !== null ? selectedStartHour + requestedHours : null;
  const shiftFit = selectedStartHour !== null && selectedEndHour !== null
    ? getShiftFit(selectedStartHour, selectedEndHour)
    : null;

  const timeRangeLabel = useMemo(
    () => getTimeRangeLabel(requestedHours, selectedStartHour),
    [requestedHours, selectedStartHour]
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!hasValidSelection || selectedStartHour === null) return;
    if (!name.trim() || !email.trim()) return;
    if (turnstileSiteKey && !cfToken) return;

    await onSubmit({
      requestedHours,
      startHour: selectedStartHour,
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
            <p className="text-xs text-muted-foreground">{getGuardrailCopy(requestedHours)}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="start-time">Time Selection</Label>
            <select
              id="start-time"
              value={selectedStartHour ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                onStartHourChange(value === '' ? null : Number(value));
              }}
              disabled={!selectedDate || startHourOptions.length === 0}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed"
            >
              <option value="">Select start time</option>
              {startHourOptions.map((hour) => (
                <option key={hour} value={hour}>
                  {formatHour(hour)}
                </option>
              ))}
            </select>
            {!selectedDate && <p className="text-xs text-muted-foreground">Select a date to view available start times.</p>}
            {selectedDate && startHourOptions.length === 0 && (
              <p className="text-xs font-medium text-destructive">
                No valid start times for {requestedHours} hours on this date.
              </p>
            )}
          </div>

          <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm space-y-1">
            <p>
              <span className="font-medium">Selected date:</span> {selectedDate || 'Not selected'}
            </p>
            <p>
              <span className="font-medium">Time range:</span> {timeRangeLabel}
            </p>
            <p>
              <span className="font-medium">Shift fit:</span> {shiftFit ? getShiftFitLabel(shiftFit) : 'Not selected'}
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

          <Button type="submit" className="w-full" disabled={!hasValidSelection || isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Booking Request'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
