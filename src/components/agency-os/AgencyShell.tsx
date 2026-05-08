// AgencyShell — UniqueOS-style desktop chrome for /agency. Port of `app.jsx`
// from the Yacht Agency OS prototype, marina-only. Drops the prototype's
// design canvas / tweaks-panel scaffolding (those were for the standalone
// preview, not the real app).

import { ReactNode, useEffect, useState } from 'react';
import { marinaTheme, Avatar, Btn, Kbd, Pill } from './theme';
import type { Density, Scenario } from '@/lib/agency-os/data';
import { TODAY, TZ_LABEL, fmt } from '@/lib/agency-os/data';

export type SurfaceId = 'dashboard' | 'inbox' | 'calendar' | 'portfolio';

const SURFACE_LABELS: Record<SurfaceId, string> = {
  dashboard: 'Panel',
  inbox: 'Bandeja',
  calendar: 'Calendario',
  portfolio: 'Flota',
};

const SURFACE_SUBTITLES: Record<SurfaceId, string> = {
  dashboard: 'Panorama del día — salidas, bandeja y atención.',
  inbox: 'Solicitudes entrantes en orden de urgencia.',
  calendar: 'Disponibilidad de la flota y fechas bloqueadas.',
  portfolio: 'Cinco yates Prestige y aliados con licencia.',
};

interface AgencyShellProps {
  surface: SurfaceId;
  scenario: Scenario;
  density: Density;
  onNav: (next: SurfaceId) => void;
  children: ReactNode;
}

export default function AgencyShell({ surface, scenario, onNav, children }: AgencyShellProps) {
  const t = marinaTheme;
  const surfaceLabel = SURFACE_LABELS[surface];
  const subtitle = SURFACE_SUBTITLES[surface];

  return (
    <div style={{
      width: '100%', height: '100vh', background: t.bgDeep, color: t.text,
      display: 'flex', flexDirection: 'column', fontFamily: t.sansFont, fontSize: 13,
      position: 'relative', overflow: 'hidden',
    }}>
      <MenuBar surface={surface} scenario={scenario} />

      <div style={{
        flex: 1, minHeight: 0, padding: '18px 22px 90px',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          flex: 1, minHeight: 0,
          background: t.bg,
          border: `1px solid ${t.border}`,
          borderRadius: 14,
          boxShadow: '0 4px 14px rgba(31,29,24,0.06)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <header style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 22px', borderBottom: `1px solid ${t.border}`,
            background: t.bg,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ display: 'flex', gap: 6 }}>
                <span style={{ width: 11, height: 11, borderRadius: 50, background: '#e5b8aa', border: `1px solid ${t.border}` }} />
                <span style={{ width: 11, height: 11, borderRadius: 50, background: '#e8d9b3', border: `1px solid ${t.border}` }} />
                <span style={{ width: 11, height: 11, borderRadius: 50, background: '#c4d5b4', border: `1px solid ${t.border}` }} />
              </span>
              <div>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>
                  {surfaceLabel}
                </h1>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: t.muted }}>{subtitle}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Pill theme={t} tone={scenario === 'busy' ? 'warn' : scenario === 'quiet' ? 'info' : 'muted'} sm>
                {scenario === 'busy' ? 'saturado' : scenario === 'quiet' ? 'tranquilo' : 'típico'}
              </Pill>
              <button style={{ width: 32, height: 32, background: '#fff', border: `1px solid ${t.border}`, borderRadius: 8, color: t.muted, cursor: 'pointer', fontSize: 13 }}>⌕</button>
              <Avatar theme={t} name="Daniela Cardia" size={32} />
              <Btn theme={t} sm primary>+ Reserva</Btn>
            </div>
          </header>
          <div style={{ flex: 1, padding: '20px 22px', overflow: 'hidden', minHeight: 0, position: 'relative' }}>
            {children}
          </div>
        </div>
      </div>

      <Dock surface={surface} onNav={onNav} />
      <CommandPalette />
    </div>
  );
}

function MenuBar({ surface, scenario }: { surface: SurfaceId; scenario: Scenario }) {
  const t = marinaTheme;
  const today = TODAY;
  const dateLabel = `${fmt.dowFull[today.getDay()]} ${today.getDate()} ${fmt.monthAbbr[today.getMonth()]}`;
  const surfaceLabel = SURFACE_LABELS[surface];
  return (
    <div style={{
      height: 32, background: 'rgba(245,244,238,0.85)', backdropFilter: 'blur(12px)',
      borderBottom: `1px solid ${t.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 14px', fontFamily: t.sansFont, fontSize: 12, color: t.text, flex: '0 0 auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 50, background: t.accent }} />
          <span style={{ fontWeight: 700, letterSpacing: '-0.005em' }}>Prestige</span>
        </span>
        <span style={{ fontWeight: 600, color: t.text }}>{surfaceLabel}</span>
        {['Archivo', 'Ver', 'Reservas', 'Ayuda'].map(m => (
          <span key={m} style={{ color: t.muted, fontSize: 12 }}>{m}</span>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: t.monoFont, fontSize: 11, color: t.muted }}>
        <span>esc · {scenario}</span>
        <span>{dateLabel}</span>
        <span>{TZ_LABEL}</span>
      </div>
    </div>
  );
}

function Dock({ surface, onNav }: { surface: SurfaceId; onNav: (s: SurfaceId) => void }) {
  const t = marinaTheme;
  const NAV: { id: SurfaceId; label: string; glyph: string }[] = [
    { id: 'dashboard', label: 'Panel', glyph: '◉' },
    { id: 'inbox', label: 'Bandeja', glyph: '✉' },
    { id: 'calendar', label: 'Calendario', glyph: '◫' },
    { id: 'portfolio', label: 'Flota', glyph: '⛵' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', alignItems: 'flex-end', gap: 8,
      padding: '8px 12px',
      background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(20px)',
      border: `1px solid rgba(31,29,24,0.08)`,
      borderRadius: 16,
      boxShadow: '0 12px 32px rgba(31,29,24,0.12), inset 0 1px 0 rgba(255,255,255,0.6)',
      zIndex: 5,
    }}>
      {NAV.map(n => {
        const active = n.id === surface;
        return (
          <button key={n.id} onClick={() => onNav(n.id)} title={n.label} style={{
            position: 'relative',
            width: 44, height: 44, borderRadius: 10,
            background: active ? t.accent : '#fff',
            color: active ? '#fff' : t.text,
            border: `1px solid ${active ? 'transparent' : t.border}`,
            cursor: 'pointer', fontSize: 18, fontFamily: t.sansFont,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: active ? '0 4px 10px rgba(201,100,66,0.30)' : '0 1px 2px rgba(31,29,24,0.06)',
          }}>
            {n.glyph}
            {active && <span style={{
              position: 'absolute', bottom: -7, left: '50%', transform: 'translateX(-50%)',
              width: 4, height: 4, borderRadius: 50, background: t.accent,
            }} />}
          </button>
        );
      })}
    </div>
  );
}

function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;
  const t = marinaTheme;
  const ITEMS = [
    { icon: '⏎', label: 'Confirmar solicitud activa', kbd: 'C' },
    { icon: '✉', label: 'Responder solicitud', kbd: 'R' },
    { icon: '⊟', label: 'Bloquear fechas (mantenimiento)', kbd: 'B' },
    { icon: '+', label: 'Añadir yate aliado', kbd: 'A' },
    { icon: '→', label: 'Ir a Bandeja', kbd: 'G I' },
    { icon: '→', label: 'Ir a Calendario', kbd: 'G C' },
    { icon: '→', label: 'Ir a Flota', kbd: 'G F' },
    { icon: '↻', label: 'Cambiar escenario · saturado', kbd: '⌘ S' },
    { icon: '✎', label: 'Nueva reserva manual', kbd: 'N' },
  ];
  const filtered = query
    ? ITEMS.filter(i => i.label.toLowerCase().includes(query.toLowerCase()))
    : ITEMS;
  return (
    <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(31,29,24,0.40)', backdropFilter: 'blur(6px)', zIndex: 2147483645, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '14vh' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 520, background: '#fff', border: `1px solid ${t.border}`, borderRadius: 12, color: t.text, fontFamily: t.sansFont, boxShadow: '0 24px 80px rgba(31,29,24,0.25)' }}>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar comando, yate, solicitud..."
          style={{ width: '100%', padding: '14px 18px', background: 'transparent', border: 'none', borderBottom: `1px solid ${t.border}`, color: t.text, fontSize: 15, fontFamily: t.sansFont, outline: 'none' }}
        />
        <div style={{ padding: '6px 0', maxHeight: 360, overflow: 'auto' }}>
          {filtered.map((it, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', cursor: 'pointer', fontSize: 13 }}>
              <span style={{ width: 18, color: t.accent, fontFamily: t.monoFont, textAlign: 'center' }}>{it.icon}</span>
              <span style={{ flex: 1 }}>{it.label}</span>
              <Kbd theme={t}>{it.kbd}</Kbd>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: t.muted }}>Sin resultados</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 18px', borderTop: `1px solid ${t.border}`, fontSize: 11, color: t.muted, fontFamily: t.monoFont }}>
          <span>↑↓ navegar · ↵ ejecutar · esc cerrar</span>
          <span>{filtered.length} comandos</span>
        </div>
      </div>
    </div>
  );
}
