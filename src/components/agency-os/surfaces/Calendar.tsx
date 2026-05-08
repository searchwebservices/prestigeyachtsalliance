// Marina Calendar surface — port of `surface-calendar.jsx` lines 18-276 (marina
// branch + the shared BlockDialog, Toolbar, daysOfWeek, bgColor, borderColor).

import { ReactNode, useState } from 'react';
import {
  AgencyTheme,
  Btn,
  Kbd,
  marinaTheme,
} from '../theme';
import {
  Booking,
  Scenario,
  TODAY,
  bookingsFor,
  fmt,
  yById,
  yachts,
} from '@/lib/agency-os/data';

type CalendarView = 'day' | 'week' | 'month';

interface CalendarProps {
  scenario: Scenario;
}

export default function Calendar({ scenario }: CalendarProps) {
  const t = marinaTheme;
  const [view, setView] = useState<CalendarView>('month');
  const [showBlock, setShowBlock] = useState(false);
  const bookings = bookingsFor(scenario);

  const firstOfMonth = new Date(2026, 4, 1);
  const lastDay = new Date(2026, 5, 0);
  const startWd = (firstOfMonth.getDay() + 6) % 7; // Monday=0
  const totalCells = Math.ceil((startWd + lastDay.getDate()) / 7) * 7;
  const cells: Date[] = [];
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(2026, 4, i - startWd + 1);
    cells.push(d);
  }
  const dayBookings = (d: Date) => bookings.filter((b) => b.start.toDateString() === d.toDateString());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16, position: 'relative' }}>
      <Toolbar t={t} view={view} setView={setView} setShowBlock={setShowBlock} bookings={bookings} />
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gridTemplateRows: 'auto repeat(' + (totalCells / 7) + ', 1fr)',
        borderLeft: `0.5px solid ${t.hairline}`,
        borderTop: `0.5px solid ${t.hairline}`,
      }}>
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d, i) => (
          <div
            key={i}
            style={{
              padding: '8px 12px',
              fontFamily: t.monoFont,
              fontSize: 10,
              color: t.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.10em',
              borderRight: `0.5px solid ${t.hairline}`,
              borderBottom: `0.5px solid ${t.hairline}`,
            }}
          >
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === 4;
          const isToday = d.toDateString() === TODAY.toDateString();
          const items = dayBookings(d);
          return (
            <div
              key={i}
              style={{
                padding: 8,
                borderRight: `0.5px solid ${t.hairline}`,
                borderBottom: `0.5px solid ${t.hairline}`,
                opacity: inMonth ? 1 : 0.35,
                position: 'relative',
                minHeight: 96,
                background: isToday ? t.accentSoft : 'transparent',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: t.displayFont, fontSize: 22, fontWeight: 500, color: isToday ? t.accent : t.text, lineHeight: 1 }}>{d.getDate()}</span>
                {items.length > 0 && (
                  <span style={{ fontFamily: t.monoFont, fontSize: 10, color: t.muted }}>{items.length}</span>
                )}
              </div>
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {items.slice(0, 4).map((b) => {
                  const y = yById[b.yachtId];
                  return (
                    <div
                      key={b.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 10.5,
                        color: t.text,
                        padding: '1px 4px',
                        borderLeft: `2px solid oklch(0.55 0.13 ${y.hue})`,
                        background: b.type === 'block' ? bgColor(b) : 'transparent',
                        borderRadius: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      <span style={{ fontFamily: t.monoFont, fontSize: 9.5, color: t.muted }}>{fmt.hhmm(b.start)}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title.split(' · ')[0]}</span>
                    </div>
                  );
                })}
                {items.length > 4 && (
                  <span style={{ fontSize: 10, color: t.muted, fontStyle: 'italic' }}>+{items.length - 4} más</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {showBlock && <BlockDialog t={t} onClose={() => setShowBlock(false)} />}
    </div>
  );
}

function Toolbar({
  t,
  view,
  setView,
  setShowBlock,
  bookings,
}: {
  t: AgencyTheme;
  view: CalendarView;
  setView: (v: CalendarView) => void;
  setShowBlock: (b: boolean) => void;
  bookings: Booking[];
}) {
  const monthLabel = `Mayo 2026 · semana ${Math.ceil(TODAY.getDate() / 7)}`;
  const totalRev = bookings
    .filter((b) => b.type === 'reservation')
    .reduce((s, b) => s + (b.value || 0), 0);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0, fontFamily: t.displayFont, fontSize: 30, fontWeight: 500, color: t.text, letterSpacing: '-0.01em' }}>{monthLabel}</h2>
        <div style={{ display: 'flex', gap: 4 }}>
          <button style={{ width: 26, height: 26, background: 'transparent', border: `0.5px solid ${t.border}`, borderRadius: t.radius, color: t.muted, cursor: 'pointer' }}>‹</button>
          <button style={{ padding: '4px 10px', background: 'transparent', border: `0.5px solid ${t.border}`, borderRadius: t.radius, color: t.text, fontSize: 11, cursor: 'pointer', fontFamily: t.monoFont }}>HOY</button>
          <button style={{ width: 26, height: 26, background: 'transparent', border: `0.5px solid ${t.border}`, borderRadius: t.radius, color: t.muted, cursor: 'pointer' }}>›</button>
        </div>
        <div style={{ display: 'flex', gap: 0, border: `0.5px solid ${t.border}`, borderRadius: t.radius, overflow: 'hidden' }}>
          {([['day', 'Día'], ['week', 'Semana'], ['month', 'Mes']] as const).map(([id, lbl]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              style={{
                padding: '4px 12px',
                fontSize: 11,
                fontFamily: t.sansFont,
                background: view === id ? t.accentSoft : 'transparent',
                color: view === id ? t.accent : t.muted,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: t.monoFont, fontSize: 11, color: t.muted }}>
          {bookings.filter((b) => b.type === 'reservation').length} reservas · {fmt.usdK(totalRev)}
        </span>
        <Btn theme={t} sm onClick={() => setShowBlock(true)}>
          Bloquear fechas <Kbd theme={t}>B</Kbd>
        </Btn>
        <Btn theme={t} sm primary>Nueva reserva</Btn>
      </div>
    </div>
  );
}

function BlockDialog({ t, onClose }: { t: AgencyTheme; onClose: () => void }) {
  const [yachtId, setYachtId] = useState(yachts[0].id);
  const [kind, setKind] = useState<'mantenimiento' | 'propietario' | 'privado'>('mantenimiento');
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,20,20,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, backdropFilter: 'blur(6px)' }}>
      <div style={{ width: 440, background: t.surface, border: `0.5px solid ${t.border}`, borderRadius: t.radiusLg, padding: 22, color: t.text, boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontFamily: t.displayFont, fontSize: 24, fontWeight: 500 }}>Bloquear fechas</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: t.muted, fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field t={t} label="Yate">
            <select
              value={yachtId}
              onChange={(e) => setYachtId(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', background: t.bgDeep, color: t.text, border: `0.5px solid ${t.border}`, borderRadius: t.radius, fontSize: 12 }}
            >
              {yachts.map((y) => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </select>
          </Field>
          <Field t={t} label="Tipo de bloqueo">
            <div style={{ display: 'flex', gap: 6 }}>
              {([['mantenimiento', 'Mantenimiento'], ['propietario', 'Uso del propietario'], ['privado', 'Reserva interna']] as const).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    fontSize: 11,
                    background: kind === k ? t.accentSoft : 'transparent',
                    color: kind === k ? t.accent : t.text,
                    border: `0.5px solid ${kind === k ? t.accent : t.border}`,
                    borderRadius: t.radius,
                    cursor: 'pointer',
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field t={t} label="Desde">
              <input type="date" defaultValue="2026-05-08" style={{ width: '100%', padding: '6px 8px', background: t.bgDeep, color: t.text, border: `0.5px solid ${t.border}`, borderRadius: t.radius, fontSize: 12, fontFamily: t.monoFont }} />
            </Field>
            <Field t={t} label="Hasta">
              <input type="date" defaultValue="2026-05-12" style={{ width: '100%', padding: '6px 8px', background: t.bgDeep, color: t.text, border: `0.5px solid ${t.border}`, borderRadius: t.radius, fontSize: 12, fontFamily: t.monoFont }} />
            </Field>
          </div>
          <Field t={t} label="Nota">
            <textarea
              rows={2}
              placeholder="ej. Astilleros Cabo · cambio de motor"
              style={{ width: '100%', padding: '6px 8px', background: t.bgDeep, color: t.text, border: `0.5px solid ${t.border}`, borderRadius: t.radius, fontSize: 12, fontFamily: t.sansFont, resize: 'none' }}
            />
          </Field>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <Btn theme={t} onClick={onClose}>Cancelar</Btn>
          <Btn theme={t} primary onClick={onClose}>
            Bloquear <Kbd theme={t}>↵</Kbd>
          </Btn>
        </div>
      </div>
    </div>
  );
}

function Field({ t, label, children }: { t: AgencyTheme; label: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: t.monoFont, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

const bgColor = (b: Booking) => {
  const y = yById[b.yachtId];
  if (b.type === 'block') {
    return `repeating-linear-gradient(135deg, oklch(0.86 0.03 30) 0 6px, oklch(0.92 0.03 30) 6px 12px)`;
  }
  if (b.type === 'hold') return `oklch(0.96 0.10 ${y.hue} / 0.55)`;
  return `oklch(0.94 0.04 ${y.hue})`;
};
