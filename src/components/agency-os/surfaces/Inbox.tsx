// Marina Inbox surface — port of `surface-inbox.jsx` lines 35-292.
//
// Includes the shared ConvertDialog and Field used inside the dialog.

import { ReactNode, useState } from 'react';
import {
  AgencyTheme,
  Btn,
  Kbd,
  Priority,
  Stat,
  marinaTheme,
} from '../theme';
import {
  EXPERIENCES,
  Lead,
  Scenario,
  fmt,
  leadsFor,
  yById,
  yachts,
} from '@/lib/agency-os/data';

interface InboxProps {
  scenario: Scenario;
}

type FilterId = 'todos' | 'urgente' | 'experiencia' | 'reserva' | 'abierta';

export default function Inbox({ scenario }: InboxProps) {
  const t = marinaTheme;
  const leads = leadsFor(scenario);
  const [filter, setFilter] = useState<FilterId>('todos');
  const [selectedId, setSelectedId] = useState<string | undefined>(leads[0]?.id);
  const [search, setSearch] = useState('');
  const [showConvert, setShowConvert] = useState(false);

  const FILTERS: { id: FilterId; label: string; count: number }[] = [
    { id: 'todos', label: 'todos', count: leads.length },
    { id: 'urgente', label: 'urgentes', count: leads.filter((l) => l.priority === 'urgente').length },
    { id: 'experiencia', label: 'experiencia', count: leads.filter((l) => l.source === 'experiencia').length },
    { id: 'reserva', label: 'reserva directa', count: leads.filter((l) => l.source === 'reserva').length },
    { id: 'abierta', label: 'abierta', count: leads.filter((l) => l.source === 'abierta').length },
  ];

  let filtered = leads;
  if (filter === 'urgente') filtered = leads.filter((l) => l.priority === 'urgente');
  else if (filter === 'experiencia' || filter === 'reserva' || filter === 'abierta') {
    filtered = leads.filter((l) => l.source === filter);
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (l) => l.guestName.toLowerCase().includes(q) || l.note.toLowerCase().includes(q)
    );
  }
  const selected = filtered.find((l) => l.id === selectedId) || filtered[0];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 28, height: '100%', position: 'relative' }}>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ borderBottom: `0.5px solid ${t.hairline}`, paddingBottom: 16, marginBottom: 8 }}>
          <h2 style={{ fontFamily: t.displayFont, fontWeight: 500, fontSize: 36, margin: 0, letterSpacing: '-0.01em', color: t.text }}>Bandeja</h2>
          <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 12.5, color: t.muted, fontFamily: t.sansFont, alignItems: 'center', flexWrap: 'wrap' }}>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  color: filter === f.id ? t.text : t.muted,
                  fontWeight: filter === f.id ? 600 : 400,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  letterSpacing: 0,
                  textDecoration: filter === f.id ? `underline ${t.accent} 2px` : 'none',
                  textUnderlineOffset: 5,
                }}
              >
                {f.label}{' '}
                <span style={{ fontFamily: t.monoFont, fontSize: 10, color: t.dim, marginLeft: 2 }}>{f.count}</span>
              </button>
            ))}
            <span style={{ flex: 1 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="buscar..."
              style={{
                padding: '5px 9px',
                background: 'transparent',
                color: t.text,
                border: `0.5px solid ${t.border}`,
                borderRadius: t.radius,
                fontSize: 12,
                fontFamily: t.sansFont,
                outline: 'none',
                width: 180,
              }}
            />
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filtered.map((l) => {
            const isSel = l.id === selected?.id;
            return (
              <button
                key={l.id}
                onClick={() => setSelectedId(l.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: isSel ? t.surfaceAlt : 'transparent',
                  border: 'none',
                  borderTop: `0.5px solid ${t.hairline}`,
                  padding: '18px 14px',
                  cursor: 'pointer',
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap: 16,
                  alignItems: 'baseline',
                }}
              >
                <Priority priority={l.priority} theme={t} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ fontFamily: t.displayFont, fontSize: 22, fontWeight: 500, color: t.text, letterSpacing: '-0.005em' }}>{l.guestName}</span>
                    <span style={{ fontFamily: t.monoFont, fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l.source}</span>
                  </div>
                  <div style={{ fontSize: 13, color: t.muted, marginTop: 4 }}>
                    {EXPERIENCES[l.experience]?.label} · {l.party} personas · {fmt.longDate(l.requestedDate)}
                  </div>
                  <p
                    style={{
                      margin: '6px 0 0',
                      fontSize: 13,
                      color: t.text,
                      lineHeight: 1.45,
                      fontStyle: 'italic',
                      opacity: 0.85,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    "{l.note}"
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: t.monoFont, fontSize: 14, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{l.value ? fmt.usdK(l.value) : '—'}</div>
                  <div style={{ fontSize: 10.5, color: t.dim, marginTop: 4, fontFamily: t.monoFont, textTransform: 'uppercase', letterSpacing: '0.06em' }}>hace {fmt.ago(l.ageMin)}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div style={{ display: 'flex', flexDirection: 'column', borderLeft: `0.5px solid ${t.hairline}`, paddingLeft: 28, minHeight: 0, overflow: 'auto' }}>
          <div style={{ fontFamily: t.monoFont, fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.10em' }}>
            {selected.id} · {selected.country} · {fmt.ago(selected.ageMin)}
          </div>
          <h2 style={{ fontFamily: t.displayFont, fontSize: 44, fontWeight: 500, margin: '8px 0 0', letterSpacing: '-0.02em', color: t.text }}>{selected.guestName}</h2>
          <p style={{ fontFamily: t.displayFont, fontStyle: 'italic', fontSize: 18, color: t.muted, margin: '8px 0 0' }}>
            {EXPERIENCES[selected.experience]?.label} · {selected.party} pers. · {selected.hours}h · {fmt.longDate(selected.requestedDate)}
          </p>
          <p style={{ fontSize: 14, color: t.text, lineHeight: 1.6, margin: '20px 0 0', borderLeft: `2px solid ${t.accent}`, paddingLeft: 14 }}>
            {selected.note}
          </p>

          <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 14, columnGap: 18 }}>
            <Stat theme={t} label="Valor estimado" value={selected.value ? fmt.usd(selected.value) : 'Sin presupuesto'} mono />
            <Stat
              theme={t}
              label="Yate sugerido"
              value={selected.preferredYachtId ? yById[selected.preferredYachtId].name : 'Por asignar'}
            />
            <Stat
              theme={t}
              label="Fecha alterna"
              value={selected.backupDate ? fmt.longDate(selected.backupDate) : '—'}
            />
            <Stat theme={t} label="Canal" value={selected.channel} />
          </div>

          <div style={{ marginTop: 22, display: 'flex', gap: 8, paddingTop: 18, borderTop: `0.5px solid ${t.hairline}` }}>
            <Btn theme={t} sm>Responder</Btn>
            <Btn theme={t} sm>Llamar</Btn>
            <Btn theme={t} sm>Archivar</Btn>
            <span style={{ flex: 1 }} />
            <Btn theme={t} primary onClick={() => setShowConvert(true)}>Confirmar reserva</Btn>
          </div>
        </div>
      )}

      {showConvert && selected && <ConvertDialog t={t} lead={selected} onClose={() => setShowConvert(false)} />}
    </div>
  );
}

function ConvertDialog({ t, lead, onClose }: { t: AgencyTheme; lead: Lead; onClose: () => void }) {
  const [yachtId, setYachtId] = useState<string>(
    lead.preferredYachtId || yachts.find((y) => y.bookable)!.id
  );
  const [hours, setHours] = useState(lead.hours);
  const yacht = yById[yachtId];
  const total = yacht.hourlyRate * hours;
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,20,20,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, backdropFilter: 'blur(6px)' }}>
      <div style={{ width: 480, background: t.surface, border: `0.5px solid ${t.border}`, borderRadius: t.radiusLg, padding: 22, color: t.text, boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontFamily: t.displayFont, fontSize: 24, fontWeight: 500 }}>Confirmar reserva · {lead.guestName}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: t.muted, fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12 }}>
          <Field t={t} label="Experiencia">
            <span style={{ color: t.text }}>{EXPERIENCES[lead.experience]?.label}</span>
          </Field>
          <Field t={t} label="Fecha solicitada">
            <span style={{ color: t.text, fontFamily: t.monoFont }}>
              {fmt.longDate(lead.requestedDate)} · {fmt.hhmm(lead.requestedDate)}
            </span>
          </Field>
          <Field t={t} label="Asignar yate">
            <select
              value={yachtId}
              onChange={(e) => setYachtId(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', background: t.bgDeep, color: t.text, border: `0.5px solid ${t.border}`, borderRadius: t.radius, fontFamily: t.sansFont, fontSize: 12 }}
            >
              {yachts.filter((y) => y.bookable).map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} · {y.type} · ${y.hourlyRate}/h
                </option>
              ))}
            </select>
            {lead.preferredYachtId === yachtId && (
              <div style={{ fontSize: 10.5, color: t.success, marginTop: 4, fontFamily: t.monoFont }}>
                ✓ coincide con preferencia del cliente
              </div>
            )}
          </Field>
          <Field t={t} label="Duración">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="number"
                min="3"
                max="8"
                value={hours}
                onChange={(e) => setHours(Math.max(3, Math.min(8, +e.target.value)))}
                style={{ width: 60, padding: '6px 8px', background: t.bgDeep, color: t.text, border: `0.5px solid ${t.border}`, borderRadius: t.radius, fontFamily: t.monoFont, fontSize: 12 }}
              />
              <span style={{ color: t.muted, fontSize: 11 }}>horas · ventana 06:00–18:00 · buffer 2h</span>
            </div>
          </Field>
          <div style={{ borderTop: `0.5px solid ${t.hairline}`, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 11, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bruto estimado</span>
            <span style={{ fontFamily: t.monoFont, fontSize: 22, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{fmt.usd(total)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <Btn theme={t} onClick={onClose}>Cancelar</Btn>
          <Btn theme={t} primary onClick={onClose}>
            Confirmar y enviar contrato <Kbd theme={t}>↵</Kbd>
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

