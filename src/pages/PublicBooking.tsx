import { useCallback, useEffect, useMemo, useState } from 'react';
import { addMonths, format } from 'date-fns';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import HalfDayCalendar from '@/components/booking/HalfDayCalendar';
import BookingForm from '@/components/booking/BookingForm';
import Legend from '@/components/booking/Legend';
import { BOOKING_MIN_HOURS, DayAvailability } from '@/lib/bookingPolicy';
import { CalendarDays, CheckCircle2, ClipboardCopy, MessageCircle, Phone } from 'lucide-react';

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
  transactionId?: string;
  status: string;
};

type BookingConfirmationDetails = {
  submittedAt: string;
  transactionId: string;
  bookingUid: string | null;
  status: string;
  yachtName: string;
  yachtSlug: string;
  date: string;
  requestedHours: number;
  half: 'am' | 'pm' | null;
  timeRange: string;
  timezone: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string | null;
  notes: string;
};

const apiBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const RICARDO_PHONE_E164 = '526243147806';
const RICARDO_PHONE_DISPLAY = '+52 624 314 7806';

const monthKeyFromDate = (date: Date) => format(date, 'yyyy-MM');

const formatHour = (hour24: number) => {
  const normalized = ((hour24 % 24) + 24) % 24;
  const suffix = normalized >= 12 ? 'PM' : 'AM';
  const hour12 = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${hour12}:00 ${suffix}`;
};

const getTimeRangeLabel = (requestedHours: number, half: 'am' | 'pm' | null) => {
  if (!half) return 'Not selected';
  const startHour = half === 'am' ? 8 : 13;
  const endHour = startHour + requestedHours;
  return `${formatHour(startHour)} - ${formatHour(endHour)}`;
};

const buildTripReportText = (details: BookingConfirmationDetails) =>
  [
    'Prestige Yachts Cabo - Booking Confirmation',
    `Transaction ID: ${details.transactionId}`,
    `Booking UID: ${details.bookingUid || 'N/A'}`,
    `Status: ${details.status}`,
    `Boat: ${details.yachtName} (${details.yachtSlug})`,
    `Date: ${details.date}`,
    `Time: ${details.timeRange} (${details.timezone})`,
    `Requested Hours: ${details.requestedHours}`,
    `Segment: ${details.half ? details.half.toUpperCase() : 'N/A'}`,
    `Client Name: ${details.attendeeName}`,
    `Client Email: ${details.attendeeEmail}`,
    `Client Phone: ${details.attendeePhone || 'N/A'}`,
    `Notes: ${details.notes || 'N/A'}`,
    `Submitted At: ${details.submittedAt}`,
    `Ricardo Contact: ${RICARDO_PHONE_DISPLAY}`,
  ].join('\n');

export default function PublicBooking() {
  const { yachtSlug } = useParams<{ yachtSlug: string }>();
  const { toast } = useToast();
  const { trackEvent } = useActivityTracker();

  const [monthDate, setMonthDate] = useState(() => new Date());
  const [requestedHours, setRequestedHours] = useState(BOOKING_MIN_HOURS);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedHalf, setSelectedHalf] = useState<'am' | 'pm' | null>(null);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastBooking, setLastBooking] = useState<BookingConfirmationDetails | null>(null);

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

      const transactionId = responsePayload.transactionId || responsePayload.bookingUid || responsePayload.requestId;
      const confirmationDetails: BookingConfirmationDetails = {
        submittedAt: new Date().toISOString(),
        transactionId,
        bookingUid: responsePayload.bookingUid,
        status: responsePayload.status,
        yachtName: availability?.yacht.name || yachtSlug,
        yachtSlug,
        date: selectedDate,
        requestedHours: payload.requestedHours,
        half: selectedHalf,
        timeRange: getTimeRangeLabel(payload.requestedHours, selectedHalf),
        timezone: availability?.timezone || 'America/Mazatlan',
        attendeeName: payload.attendee.name,
        attendeeEmail: payload.attendee.email,
        attendeePhone: payload.attendee.phoneNumber || null,
        notes: payload.notes,
      };

      setLastBooking(confirmationDetails);
      void trackEvent('trip_booked', {
        booking_transaction_id: confirmationDetails.transactionId,
        booking_uid: confirmationDetails.bookingUid || '',
        booking_status: confirmationDetails.status,
        yacht_name: confirmationDetails.yachtName,
        yacht_slug: confirmationDetails.yachtSlug,
        trip_date: confirmationDetails.date,
        trip_time_range: confirmationDetails.timeRange,
        trip_timezone: confirmationDetails.timezone,
        requested_hours: confirmationDetails.requestedHours,
        segment: confirmationDetails.half || '',
        customer_name: confirmationDetails.attendeeName,
        customer_email: confirmationDetails.attendeeEmail,
        customer_phone: confirmationDetails.attendeePhone || '',
        notes: confirmationDetails.notes || '',
      });

      toast({
        title: 'Booking submitted',
        description: `Transaction ID: ${transactionId}`,
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

  const handleCopyReport = async () => {
    if (!lastBooking) return;
    await navigator.clipboard.writeText(buildTripReportText(lastBooking));
    toast({
      title: 'Report copied',
      description: 'Booking summary copied for Ricardo.',
    });
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
          <Card className="border-emerald-500/40 bg-emerald-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Booking Confirmed - Action Required
              </CardTitle>
              <CardDescription>
                Confirm payment and booking details directly with Ricardo via WhatsApp or call.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTitle>Contact Ricardo now</AlertTitle>
                <AlertDescription>
                  WhatsApp or call <span className="font-medium">{RICARDO_PHONE_DISPLAY}</span> to finalize payment and
                  operational details.
                </AlertDescription>
              </Alert>

              <div className="grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-md border border-border/60 bg-background/60 p-3">
                  <p>
                    <span className="font-medium">Transaction ID:</span> {lastBooking.transactionId}
                  </p>
                  <p>
                    <span className="font-medium">Booking UID:</span> {lastBooking.bookingUid || 'N/A'}
                  </p>
                  <p>
                    <span className="font-medium">Status:</span> {lastBooking.status}
                  </p>
                  <p>
                    <span className="font-medium">Submitted:</span>{' '}
                    {format(new Date(lastBooking.submittedAt), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
                <div className="rounded-md border border-border/60 bg-background/60 p-3">
                  <p>
                    <span className="font-medium">Boat:</span> {lastBooking.yachtName}
                  </p>
                  <p>
                    <span className="font-medium">Date:</span> {lastBooking.date}
                  </p>
                  <p>
                    <span className="font-medium">Time:</span> {lastBooking.timeRange}
                  </p>
                  <p>
                    <span className="font-medium">Client:</span> {lastBooking.attendeeName} ({lastBooking.attendeeEmail}
                    )
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <a
                    href={`https://wa.me/${RICARDO_PHONE_E164}?text=${encodeURIComponent(
                      `Hi Ricardo, booking confirmed.\nTransaction ID: ${lastBooking.transactionId}\nBoat: ${lastBooking.yachtName}\nDate: ${lastBooking.date}\nTime: ${lastBooking.timeRange}\nClient: ${lastBooking.attendeeName} (${lastBooking.attendeeEmail})`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    WhatsApp Ricardo
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={`tel:+${RICARDO_PHONE_E164}`}>
                    <Phone className="mr-2 h-4 w-4" />
                    Call Ricardo
                  </a>
                </Button>
                <Button variant="secondary" size="sm" onClick={handleCopyReport}>
                  <ClipboardCopy className="mr-2 h-4 w-4" />
                  Copy Report
                </Button>
              </div>
            </CardContent>
          </Card>
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
