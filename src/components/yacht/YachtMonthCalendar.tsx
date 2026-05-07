import { useCallback, useEffect, useMemo, useState } from 'react';
import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { BOOKING_TIMEZONE } from '@/lib/bookingPolicy';
import MonthGrid from '@/components/admin-calendar/MonthGrid';
import { AdminCalendarEvent } from '@/components/admin-calendar/types';

const apiBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type Props = {
  yachtSlug: string;
  bookable: boolean;
};

const asString = (v: unknown): string | null => (typeof v === 'string' ? v : null);

const normalizeEvents = (raw: unknown): AdminCalendarEvent[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const startIso = asString(row.startIso) || asString(row.start) || asString(row.startTime);
      const endIso = asString(row.endIso) || asString(row.end) || asString(row.endTime);
      if (!startIso || !endIso) return null;
      return {
        id:
          asString(row.id) ||
          asString(row.bookingUid) ||
          asString(row.booking_uid) ||
          crypto.randomUUID(),
        bookingUid: asString(row.bookingUid) || asString(row.booking_uid) || asString(row.uid),
        title:
          asString(row.title) ||
          asString(row.eventTypeTitle) ||
          asString(row.yachtName) ||
          'Booking',
        startIso,
        endIso,
        status: asString(row.status) || 'booked',
        yachtSlug: asString(row.yachtSlug) || asString(row.yacht_slug) || '',
        yachtName: asString(row.yachtName) || asString(row.yacht_name) || '',
        attendeeName: asString(row.attendeeName) || asString(row.attendee_name),
        attendeeEmail: asString(row.attendeeEmail) || asString(row.attendee_email),
        attendeePhone: asString(row.attendeePhone) || asString(row.attendee_phone),
        notes: asString(row.notes),
      } as AdminCalendarEvent;
    })
    .filter((x): x is AdminCalendarEvent => x !== null);
};

export default function YachtMonthCalendar({ yachtSlug, bookable }: Props) {
  const { language } = useLanguage();
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [events, setEvents] = useState<AdminCalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rangeStart = useMemo(() => format(startOfMonth(anchor), 'yyyy-MM-dd'), [anchor]);
  const rangeEnd = useMemo(() => format(endOfMonth(anchor), 'yyyy-MM-dd'), [anchor]);

  const load = useCallback(async () => {
    if (!bookable) return;
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError(language === 'es' ? 'Sesión expirada.' : 'Your session expired.');
        return;
      }
      const res = await fetch(
        `${apiBase}/internal-calendar-bookings?slug=${encodeURIComponent(yachtSlug)}&start=${rangeStart}&end=${rangeEnd}&timezone=${encodeURIComponent(BOOKING_TIMEZONE)}`,
        {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error || (language === 'es' ? 'No se pudo cargar.' : 'Unable to load.'));
        setEvents([]);
        return;
      }
      setEvents(normalizeEvents(payload?.events));
    } catch (e) {
      console.error('YachtMonthCalendar load failed', e);
      setError(language === 'es' ? 'No se pudo cargar.' : 'Unable to load.');
    } finally {
      setLoading(false);
    }
  }, [bookable, yachtSlug, rangeStart, rangeEnd, language]);

  useEffect(() => {
    load();
  }, [load]);

  if (!bookable) {
    return (
      <p className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
        {language === 'es'
          ? 'Esta embarcación no tiene reservas internas habilitadas.'
          : 'This yacht does not have internal bookings enabled.'}
      </p>
    );
  }

  const monthLabel = format(anchor, 'MMMM yyyy');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
            {language === 'es' ? 'Hoy' : 'Today'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setAnchor((d) => addMonths(d, -1))}
            aria-label={language === 'es' ? 'Anterior' : 'Previous'}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setAnchor((d) => addMonths(d, 1))}
            aria-label={language === 'es' ? 'Siguiente' : 'Next'}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <p className="ml-1 text-sm font-semibold text-foreground capitalize">{monthLabel}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          {language === 'es' ? 'Actualizar' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <MonthGrid
        anchorDate={anchor}
        events={events}
        timezone={BOOKING_TIMEZONE}
        language={language === 'es' ? 'es' : 'en'}
        loading={loading}
        copy={{
          loading: language === 'es' ? 'Cargando reservas...' : 'Loading bookings...',
          empty: language === 'es' ? 'Sin reservas en este mes.' : 'No bookings this month.',
        }}
        onEventClick={() => {}}
      />
    </div>
  );
}
