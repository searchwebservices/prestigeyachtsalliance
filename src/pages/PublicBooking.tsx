import { useCallback, useEffect, useMemo, useState } from 'react';
import { addMonths, format } from 'date-fns';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import HalfDayCalendar from '@/components/booking/HalfDayCalendar';
import BookingForm from '@/components/booking/BookingForm';
import Legend from '@/components/booking/Legend';
import { BOOKING_MIN_HOURS, DayAvailability } from '@/lib/bookingPolicy';
import { CalendarDays } from 'lucide-react';

type AvailabilityResponse = {
  requestId: string;
  yacht: {
    id: string;
    name: string;
    slug: string;
    vessel_type: string;
    capacity: number;
  };
  month: string;
  timezone: string;
  constraints: {
    minHours: number;
    maxHours: number;
    halfDay: {
      am: string;
      pm: string;
    };
  };
  days: Record<string, DayAvailability>;
};

type CreateBookingResponse = {
  requestId: string;
  bookingUid: string | null;
  status: string;
};

const apiBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

const monthKeyFromDate = (date: Date) => format(date, 'yyyy-MM');

export default function PublicBooking() {
  const { yachtSlug } = useParams<{ yachtSlug: string }>();
  const { toast } = useToast();

  const [monthDate, setMonthDate] = useState(() => new Date());
  const [requestedHours, setRequestedHours] = useState(BOOKING_MIN_HOURS);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedHalf, setSelectedHalf] = useState<'am' | 'pm' | null>(null);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastBooking, setLastBooking] = useState<CreateBookingResponse | null>(null);

  const monthKey = useMemo(() => monthKeyFromDate(monthDate), [monthDate]);

  const loadAvailability = useCallback(async () => {
    if (!yachtSlug) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${apiBase}/public-booking-availability?slug=${encodeURIComponent(yachtSlug)}&month=${monthKey}`,
        {
          method: 'GET',
          headers: {
            apikey: anonKey,
            'Content-Type': 'application/json',
          },
        }
      );
      const payload = (await response.json()) as AvailabilityResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch availability');
      }

      setAvailability(payload);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to fetch availability';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [monthKey, yachtSlug]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  // Half is always required — no clearing on hour change.

  const handleSelection = ({ date, half }: { date: string; half: 'am' | 'pm' | null }) => {
    setSelectedDate(date);
    setSelectedHalf(half);
  };

  const submitBooking = async (payload: {
    requestedHours: number;
    attendee: { name: string; email: string; phoneNumber?: string };
    notes: string;
    cfToken: string | null;
  }) => {
    if (!yachtSlug || !selectedDate) return;

    setSubmitting(true);
    setLastBooking(null);

    try {
      const response = await fetch(`${apiBase}/public-booking-create`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slug: yachtSlug,
          date: selectedDate,
          requestedHours: payload.requestedHours,
          half: selectedHalf,
          attendee: payload.attendee,
          notes: payload.notes,
          cfToken: payload.cfToken,
        }),
      });

      const responsePayload = (await response.json()) as CreateBookingResponse & { error?: string };
      if (!response.ok) {
        throw new Error(responsePayload.error || 'Booking request failed');
      }

      setLastBooking(responsePayload);
      toast({
        title: 'Booking submitted',
        description: responsePayload.bookingUid
          ? `Booking UID: ${responsePayload.bookingUid}`
          : 'Your booking request was submitted.',
      });

      await loadAvailability();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Booking request failed';
      toast({
        variant: 'destructive',
        title: 'Unable to submit booking',
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const prevMonth = () => {
    setMonthDate((current) => addMonths(current, -1));
    setSelectedDate(null);
    setSelectedHalf(null);
  };

  const nextMonth = () => {
    setMonthDate((current) => addMonths(current, 1));
    setSelectedDate(null);
    setSelectedHalf(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="mx-auto max-w-6xl space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-[620px] w-full" />
        </div>
      </div>
    );
  }

  if (error || !availability) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="mx-auto max-w-xl">
          <Alert variant="destructive">
            <AlertTitle>Booking page unavailable</AlertTitle>
            <AlertDescription>{error || 'Unable to load booking data.'}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4 md:space-y-6">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-2xl">{availability.yacht.name}</CardTitle>
            <CardDescription>
              {availability.yacht.vessel_type} • Up to {availability.yacht.capacity} guests • Timezone:{' '}
              {availability.timezone}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              <span>{format(new Date(`${monthKey}-01T00:00:00`), 'MMMM yyyy')}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={prevMonth}>
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={nextMonth}>
                Next
              </Button>
            </div>
          </CardContent>
        </Card>

        <Legend />

        {lastBooking ? (
          <Alert>
            <AlertTitle>Latest Submission</AlertTitle>
            <AlertDescription>
              Status: {lastBooking.status}
              {lastBooking.bookingUid ? ` • UID: ${lastBooking.bookingUid}` : ''}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <HalfDayCalendar
            monthKey={monthKey}
            days={availability.days}
            requestedHours={requestedHours}
            selectedDate={selectedDate}
            selectedHalf={selectedHalf}
            onSelect={handleSelection}
          />
          <BookingForm
            requestedHours={requestedHours}
            selectedDate={selectedDate}
            selectedHalf={selectedHalf}
            isSubmitting={submitting}
            turnstileSiteKey={turnstileSiteKey}
            onRequestedHoursChange={setRequestedHours}
            onHalfChange={setSelectedHalf}
            onSubmit={submitBooking}
          />
        </div>
      </div>
    </div>
  );
}
