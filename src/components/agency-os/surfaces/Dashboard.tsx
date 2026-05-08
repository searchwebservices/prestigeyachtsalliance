// Marina Dashboard surface — port of `surface-dashboard.jsx` lines 180-296.

import { marinaTheme, Priority, SectionHd, Spark, Stat, YachtMark } from '../theme';
import type { Density, Scenario } from '@/lib/agency-os/data';
import {
  EXPERIENCES,
  TODAY,
  alertsFor,
  fmt,
  leadsFor,
  revenue,
  todayBookings,
  utilization,
  yById,
  yachts,
} from '@/lib/agency-os/data';
import type { SurfaceId } from '../AgencyShell';

interface DashboardProps {
  scenario: Scenario;
  density: Density;
  onNav: (next: SurfaceId) => void;
}

export default function Dashboard({ scenario, onNav }: DashboardProps) {
  const t = marinaTheme;
  const today = todayBookings(scenario);
  const leads = leadsFor(scenario);
  const alerts = alertsFor(scenario);
  const rev = revenue(scenario);
  const newLeads = leads.filter((l) => l.status === 'nuevo');
  const urgentLeads = leads.filter((l) => l.priority === 'urgente' || l.priority === 'alta');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 32, height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, minHeight: 0 }}>
        {/* Editorial masthead */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontFamily: t.monoFont, fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: t.muted }}>Volumen XII · {fmt.longDate(TODAY)}</span>
          </div>
          <h1 style={{ fontFamily: t.displayFont, fontWeight: 500, fontSize: 56, lineHeight: 1.0, margin: '6px 0 0', letterSpacing: '-0.02em', color: t.text }}>
            Buenos días, Dani.
          </h1>
          <p style={{ fontFamily: t.displayFont, fontStyle: 'italic', fontSize: 22, color: t.muted, margin: '6px 0 0', fontWeight: 400 }}>
            {today.length} salidas hoy · {newLeads.length} solicitudes esperan respuesta · sea-of-cortez II zarpa al atardecer.
          </p>
        </div>

        {/* Today's schedule */}
        <div>
          <SectionHd theme={t} title="Cronograma de hoy" count={today.length} />
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14 }}>
            <thead>
              <tr style={{ fontFamily: t.monoFont, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.muted }}>
                <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 500 }}>Hora</th>
                <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 500 }}>Yate</th>
                <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 500 }}>Reserva</th>
                <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 500 }}>Inv.</th>
                <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 500 }}>Bruto</th>
              </tr>
            </thead>
            <tbody>
              {today.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 22, textAlign: 'center', color: t.muted, fontStyle: 'italic', fontFamily: t.displayFont, fontSize: 18 }}>
                    Hoy no hay salidas. Día tranquilo, perfecto para mantenimiento.
                  </td>
                </tr>
              )}
              {today.map((b) => {
                const y = yById[b.yachtId];
                return (
                  <tr key={b.id} style={{ borderTop: `0.5px solid ${t.hairline}` }}>
                    <td style={{ padding: '12px 4px', fontFamily: t.monoFont, fontSize: 12, color: t.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {fmt.hhmm(b.start)}<span style={{ color: t.dim }}> – {fmt.hhmm(b.end)}</span>
                    </td>
                    <td style={{ padding: '12px 4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <YachtMark yacht={y} theme={t} h={20} />
                        <span style={{ fontFamily: t.displayFont, fontSize: 18, color: t.text }}>{y.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 4px', fontSize: 13, color: t.text }}>{b.title}</td>
                    <td style={{ padding: '12px 4px', textAlign: 'right', fontFamily: t.monoFont, fontSize: 12, color: t.muted }}>{b.party}</td>
                    <td style={{ padding: '12px 4px', textAlign: 'right', fontFamily: t.monoFont, fontSize: 12, color: t.text }}>
                      {b.value !== undefined ? fmt.usdK(b.value) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Utilization */}
        <div>
          <SectionHd
            theme={t}
            title="Flota · utilización 30 días"
            right={<span style={{ fontFamily: t.monoFont, fontSize: 11, color: t.muted }}>media {rev.utilizationPct}%</span>}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 32px', marginTop: 14 }}>
            {yachts.map((y) => {
              const u = utilization(y.id, scenario);
              const avg = Math.round((u.reduce((a, b) => a + b, 0) / 30) * 100);
              return (
                <div key={y.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 10, alignItems: 'center' }}>
                  <YachtMark yacht={y} theme={t} h={18} />
                  <span style={{ fontFamily: t.displayFont, fontSize: 16, color: t.text }}>{y.name}</span>
                  <Spark theme={t} values={u} w={80} h={20} fill={`oklch(0.50 0.12 ${y.hue})`} />
                  <span style={{ fontFamily: t.monoFont, fontSize: 11, color: t.muted, width: 32, textAlign: 'right' }}>{avg}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ borderTop: `2px solid ${t.accent}`, paddingTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 16, columnGap: 16 }}>
          <Stat
            theme={t}
            label="Reservas hoy"
            value={today.length.toString().padStart(2, '0')}
            sub={today.length ? fmt.usdK(today.reduce((s, b) => s + (b.value || 0), 0)) + ' bruto' : 'sin actividad'}
            big
          />
          <Stat
            theme={t}
            label="Bandeja"
            value={newLeads.length.toString().padStart(2, '0')}
            sub={newLeads.length ? 'esperando respuesta' : 'al día'}
            big
          />
          <Stat
            theme={t}
            label="Ingresos · MTD"
            value={'$' + (rev.mtdUSD / 1000).toFixed(0) + 'k'}
            sub={(rev.pace >= 0 ? '+' : '') + rev.pace.toFixed(1) + '% vs mes ant.'}
            accentValue={rev.pace > 0}
            big
          />
          <Stat
            theme={t}
            label="Utilización"
            value={rev.utilizationPct + '%'}
            sub="flota completa"
            big
          />
        </div>

        <div>
          <SectionHd theme={t} title="Atención" count={alerts.length} />
          <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alerts.map((a, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontSize: 13,
                  color: t.text,
                  lineHeight: 1.5,
                  paddingLeft: 12,
                  borderLeft: `2px solid ${a.kind === 'danger' ? t.danger : a.kind === 'warn' ? t.warn : t.accent}`,
                }}
              >
                {a.text}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <SectionHd
            theme={t}
            title="Bandeja prioritaria"
            count={urgentLeads.length}
            right={
              <button
                onClick={() => onNav('inbox')}
                style={{ background: 'transparent', border: 'none', color: t.accent, fontSize: 12, cursor: 'pointer', fontFamily: t.sansFont, textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                Ver bandeja
              </button>
            }
          />
          <div style={{ marginTop: 10 }}>
            {urgentLeads.slice(0, 4).map((l) => (
              <div key={l.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'baseline', padding: '12px 0', borderTop: `0.5px solid ${t.hairline}` }}>
                <Priority priority={l.priority} theme={t} />
                <div>
                  <div style={{ fontFamily: t.displayFont, fontSize: 17, color: t.text, lineHeight: 1.15 }}>{l.guestName}</div>
                  <div style={{ fontSize: 11.5, color: t.muted, marginTop: 2 }}>
                    {EXPERIENCES[l.experience]?.label} · {l.party} pers. · {fmt.ddmm(l.requestedDate)} · llegó hace {fmt.ago(l.ageMin)}
                  </div>
                </div>
                <span style={{ fontFamily: t.monoFont, fontSize: 12, color: t.text }}>{l.value ? fmt.usdK(l.value) : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
