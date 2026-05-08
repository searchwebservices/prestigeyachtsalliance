// Marina Portfolio surface — port of `surface-portfolio.jsx` lines 174-216
// (MarinaPortfolio) plus the shared AddYachtDialog, FilterBar, MarinaStatItem,
// Toggle, inp, Field helpers from lines 21-108.

import { CSSProperties, ReactNode, useState } from 'react';
import {
  AgencyTheme,
  Btn,
  Kbd,
  YachtPhoto,
  marinaTheme,
} from '../theme';
import type { Scenario } from '@/lib/agency-os/data';
import { utilization, yachts } from '@/lib/agency-os/data';

type ClassFilter = 'todos' | 'own' | 'partner';

interface PortfolioProps {
  scenario: Scenario;
}

export default function Portfolio({ scenario }: PortfolioProps) {
  const t = marinaTheme;
  const [classFilter, setClassFilter] = useState<ClassFilter>('todos');
  const [showAdd, setShowAdd] = useState(false);

  let filtered = yachts;
  if (classFilter === 'own') filtered = yachts.filter((y) => y.klass === 'own');
  if (classFilter === 'partner') filtered = yachts.filter((y) => y.klass === 'partner');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 18, position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: t.displayFont, fontSize: 36, fontWeight: 500, color: t.text, letterSpacing: '-0.01em' }}>La Flota</h2>
          <p style={{ margin: '4px 0 0', fontFamily: t.displayFont, fontStyle: 'italic', fontSize: 16, color: t.muted, fontWeight: 400 }}>
            Cinco yates Prestige · tres aliados con licencia
          </p>
        </div>
        <FilterBar t={t} classFilter={classFilter} setClassFilter={setClassFilter} setShowAdd={setShowAdd} count={filtered.length} />
      </div>
      <div style={{ flex: 1, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 28, alignContent: 'start' }}>
        {filtered.map((y) => {
          const u = utilization(y.id, scenario);
          const avg = Math.round((u.reduce((a, b) => a + b, 0) / 30) * 100);
          return (
            <article key={y.id} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              <YachtPhoto theme={t} yacht={y} h={180} />
              <div>
                <div style={{ fontFamily: t.monoFont, fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.10em' }}>
                  {y.klass === 'own' ? 'Flota Prestige' : `Aliado · ${y.commission}%`}
                </div>
                <h3 style={{ margin: '4px 0 0', fontFamily: t.displayFont, fontSize: 30, fontWeight: 500, letterSpacing: '-0.01em', color: t.text }}>{y.name}</h3>
                <p style={{ margin: '4px 0 12px', fontFamily: t.displayFont, fontStyle: 'italic', fontSize: 16, color: t.muted, fontWeight: 400 }}>{y.tagline}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: `0.5px solid ${t.hairline}`, paddingTop: 10, gap: 4 }}>
                  <MarinaStatItem t={t} k="Eslora" v={`${y.length} ft`} />
                  <MarinaStatItem t={t} k="Capacidad" v={`${y.capacity} pers.`} />
                  <MarinaStatItem t={t} k="Tarifa" v={`$${y.hourlyRate.toLocaleString()}`} />
                  <MarinaStatItem t={t} k="Utilización" v={`${avg}%`} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Toggle t={t} on={y.bookable} />
                    <span style={{ fontSize: 12, color: t.muted }}>Reservable público</span>
                  </div>
                  <button style={{ background: 'transparent', border: 'none', color: t.accent, fontSize: 12.5, cursor: 'pointer', fontFamily: t.sansFont, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                    Editar perfil →
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {showAdd && <AddYachtDialog t={t} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function FilterBar({
  t,
  classFilter,
  setClassFilter,
  setShowAdd,
  count,
}: {
  t: AgencyTheme;
  classFilter: ClassFilter;
  setClassFilter: (c: ClassFilter) => void;
  setShowAdd: (b: boolean) => void;
  count: number;
}) {
  const owns = yachts.filter((y) => y.klass === 'own').length;
  const partners = yachts.filter((y) => y.klass === 'partner').length;
  const tabs: [ClassFilter, string, number][] = [
    ['todos', 'Todos', yachts.length],
    ['own', 'Flota propia', owns],
    ['partner', 'Aliados', partners],
  ];
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'flex', gap: 0, border: `0.5px solid ${t.border}`, borderRadius: t.radius, overflow: 'hidden' }}>
        {tabs.map(([id, lbl, n]) => (
          <button
            key={id}
            onClick={() => setClassFilter(id)}
            style={{
              padding: '5px 14px',
              fontSize: 11,
              fontFamily: t.sansFont,
              background: classFilter === id ? t.accentSoft : 'transparent',
              color: classFilter === id ? t.accent : t.muted,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {lbl} <span style={{ fontFamily: t.monoFont, fontSize: 10, marginLeft: 2 }}>{n}</span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontFamily: t.monoFont, fontSize: 11, color: t.muted }}>{count} yates</span>
        <Btn theme={t} sm onClick={() => setShowAdd(true)}>
          + Yate aliado <Kbd theme={t}>A</Kbd>
        </Btn>
      </div>
    </div>
  );
}

function MarinaStatItem({ t, k, v }: { t: AgencyTheme; k: string; v: string }) {
  return (
    <div>
      <div style={{ fontFamily: t.monoFont, fontSize: 9, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k}</div>
      <div style={{ fontFamily: t.displayFont, fontSize: 18, color: t.text, fontWeight: 500, lineHeight: 1.2 }}>{v}</div>
    </div>
  );
}

function Toggle({ t, on }: { t: AgencyTheme; on: boolean }) {
  return (
    <span style={{
      width: 28, height: 16, borderRadius: 10,
      background: on ? t.accent : t.border,
      display: 'inline-flex', alignItems: 'center', padding: 2,
      transition: 'background .2s',
    }}>
      <span style={{
        width: 12, height: 12, borderRadius: 50, background: '#fff',
        transform: on ? 'translateX(12px)' : 'translateX(0)',
        transition: 'transform .2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }} />
    </span>
  );
}

function AddYachtDialog({ t, onClose }: { t: AgencyTheme; onClose: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const stepLabel = step === 1 ? 'Datos del yate' : step === 2 ? 'Acuerdo comercial' : 'Disponibilidad y fotos';
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,20,20,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, backdropFilter: 'blur(6px)' }}>
      <div style={{ width: 540, background: t.surface, border: `0.5px solid ${t.border}`, borderRadius: t.radiusLg, padding: 22, color: t.text, boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontFamily: t.displayFont, fontSize: 26, fontWeight: 500 }}>Onboarding · yate aliado</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: t.muted, fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ fontSize: 11, fontFamily: t.monoFont, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
          Paso {step} de 3 · {stepLabel}
        </div>
        <div style={{ display: 'flex', height: 4, background: t.bgDeep, borderRadius: 2, marginBottom: 18 }}>
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              style={{
                flex: 1,
                marginRight: n < 3 ? 4 : 0,
                background: n <= step ? t.accent : t.hairline,
                borderRadius: 2,
              }}
            />
          ))}
        </div>
        {step === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field t={t} label="Nombre del yate"><input defaultValue="Mar Sereno" style={inp(t)} /></Field>
            <Field t={t} label="Tipo">
              <select style={inp(t)} defaultValue="Catamarán">
                <option>Sportfisher</option>
                <option>Motor yacht</option>
                <option>Velero</option>
                <option>Catamarán</option>
                <option>Trimarán</option>
              </select>
            </Field>
            <Field t={t} label="Eslora (ft)"><input type="number" defaultValue={42} style={inp(t)} /></Field>
            <Field t={t} label="Capacidad"><input type="number" defaultValue={12} style={inp(t)} /></Field>
            <Field t={t} label="Marina base"><input defaultValue="Marina San José del Cabo" style={inp(t)} /></Field>
            <Field t={t} label="Año"><input type="number" defaultValue={2020} style={inp(t)} /></Field>
          </div>
        )}
        {step === 2 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field t={t} label="Comisión Prestige">
              <input type="number" defaultValue={20} style={inp(t)} />
              <span style={{ fontSize: 10, color: t.muted, marginTop: 4, display: 'block', fontFamily: t.monoFont }}>% sobre tarifa cliente</span>
            </Field>
            <Field t={t} label="Tarifa por hora (USD)"><input type="number" defaultValue={1700} style={inp(t)} /></Field>
            <Field t={t} label="Propietario / agencia"><input defaultValue="Mar Sereno Charters S.A." style={inp(t)} /></Field>
            <Field t={t} label="Contacto principal"><input defaultValue="contacto@marsereno.mx" style={inp(t)} /></Field>
            <Field t={t} label="Capitán asignado"><input defaultValue="Cap. Octavio Pino" style={inp(t)} /></Field>
            <Field t={t} label="Términos del pago">
              <select style={inp(t)}>
                <option>Net 14</option>
                <option>Net 30</option>
                <option>Pago inmediato</option>
              </select>
            </Field>
          </div>
        )}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field t={t} label="Días de operación">
              <div style={{ display: 'flex', gap: 4 }}>
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                  <button
                    key={i}
                    style={{
                      flex: 1,
                      padding: '6px 0',
                      fontSize: 11,
                      fontFamily: t.monoFont,
                      background: i < 6 ? t.accentSoft : 'transparent',
                      color: i < 6 ? t.accent : t.muted,
                      border: `0.5px solid ${i < 6 ? t.accent : t.border}`,
                      borderRadius: t.radius,
                      cursor: 'pointer',
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </Field>
            <Field t={t} label="Fotos">
              <div style={{ border: `1px dashed ${t.border}`, borderRadius: t.radius, padding: 22, textAlign: 'center', color: t.muted, fontSize: 12, fontFamily: t.monoFont }}>
                ↑ arrastra hasta 12 fotos · jpg/png/heic
              </div>
            </Field>
            <Field t={t} label="Reservable público desde">
              <input type="date" defaultValue="2026-05-15" style={inp(t)} />
            </Field>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 22, justifyContent: 'space-between' }}>
          <Btn theme={t} onClick={() => (step > 1 ? setStep((step - 1) as 1 | 2 | 3) : onClose())}>
            {step > 1 ? '← Atrás' : 'Cancelar'}
          </Btn>
          <Btn theme={t} primary onClick={() => (step < 3 ? setStep((step + 1) as 1 | 2 | 3) : onClose())}>
            {step < 3 ? 'Continuar →' : 'Publicar yate ↵'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

const inp = (t: AgencyTheme): CSSProperties => ({
  width: '100%',
  padding: '6px 8px',
  background: t.bgDeep,
  color: t.text,
  border: `0.5px solid ${t.border}`,
  borderRadius: t.radius,
  fontSize: 12,
  fontFamily: t.sansFont,
  outline: 'none',
});

function Field({ t, label, children }: { t: AgencyTheme; label: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: t.monoFont, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}
