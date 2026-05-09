// app.jsx — UniqueOS shell wrapping the four yacht-agency surfaces.
// Single warm-cream design language; Montserrat + JetBrains Mono;
// menu bar + dock chrome (UniqueOS), one direction on the canvas.

(function () {
  const { Themes, UI, YachtData, Surfaces } = window;
  const { Pill, Kbd, Btn, Avatar } = UI;

  // ── UniqueOS top menu bar ─────────────────────────────────
  function MenuBar({ t, surface, scenario }) {
    const today = YachtData.TODAY;
    const dateLabel = `${YachtData.fmt.dowFull[today.getDay()]} ${today.getDate()} ${YachtData.fmt.monthAbbr[today.getMonth()]}`;
    const surfaceLabel = { dashboard: 'Panel', inbox: 'Bandeja', calendar: 'Calendario', portfolio: 'Flota' }[surface];
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
          <span>{YachtData.TZ_LABEL}</span>
        </div>
      </div>
    );
  }

  // ── UniqueOS bottom dock (frosted) ────────────────────────
  function Dock({ t, surface, onNav }) {
    const NAV = [
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

  // Surface chrome — UniqueOS desktop shell with menu bar, dock, content area
  function ScreenShell({ theme: t, surface, scenario, density, children, onNav }) {
    const surfaceLabel = { dashboard: 'Panel', inbox: 'Bandeja', calendar: 'Calendario', portfolio: 'Flota' }[surface];
    const subtitle = {
      dashboard: 'Panorama del día — salidas, bandeja y atención.',
      inbox: 'Solicitudes entrantes en orden de urgencia.',
      calendar: 'Disponibilidad de la flota y fechas bloqueadas.',
      portfolio: 'Cinco yates Prestige y aliados con licencia.',
    }[surface];

    return (
      <div style={{
        width: '100%', height: '100%', background: t.bgDeep, color: t.text,
        display: 'flex', flexDirection: 'column', fontFamily: t.sansFont, fontSize: 13,
        position: 'relative', overflow: 'hidden',
      }}>
        <MenuBar t={t} surface={surface} scenario={scenario} />

        {/* OS window — the active app */}
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
            {/* Window title bar */}
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
                <Pill theme={t} tone={scenario === 'busy' ? 'warn' : scenario === 'quiet' ? 'info' : 'muted'} sm>{scenario === 'busy' ? 'saturado' : scenario === 'quiet' ? 'tranquilo' : 'típico'}</Pill>
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

        <Dock t={t} surface={surface} onNav={onNav} />
      </div>
    );
  }

  // Render a surface for a given theme + scenario
  function ArtScreen({ surface, scenario, density, onNav }) {
    const theme = Themes.marina;
    const Surface = Surfaces[surface[0].toUpperCase() + surface.slice(1)];
    return (
      <ScreenShell theme={theme} surface={surface} scenario={scenario} density={density} onNav={onNav}>
        <Surface theme={theme} scenario={scenario} density={density} onNav={onNav} />
      </ScreenShell>
    );
  }

  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "scenario": "typical",
    "density": "comfortable",
    "accent": "#c96442"
  }/*EDITMODE-END*/;

  function App() {
    const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
    const scenario = t.scenario;
    const density = t.density;

    // Apply accent override live
    React.useEffect(() => {
      Object.values(Themes).forEach(th => {
        th.accent = t.accent;
        th.accentSoft = `color-mix(in srgb, ${t.accent} 12%, transparent)`;
      });
    }, [t.accent]);

    const ART_W = 1440, ART_H = 900;
    const SURFACES = ['dashboard', 'inbox', 'calendar', 'portfolio'];
    const SURFACE_LABEL = { dashboard: 'Panel', inbox: 'Bandeja', calendar: 'Calendario', portfolio: 'Flota' };

    // Per-artboard active surface (so Dock works inside each card).
    const [activeBySurface, setActiveBySurface] = React.useState({});
    const getActive = (id) => activeBySurface[id] || id;

    return (
      <>
        <window.DesignCanvas>
          <window.DCSection
            id="uniqueos"
            title="UniqueOS · Prestige Yachts"
            subtitle={`Cuatro superficies en escenario "${scenario === 'typical' ? 'típico' : scenario === 'busy' ? 'saturado' : 'tranquilo'}" · densidad ${density === 'compact' ? 'compacta' : 'cómoda'}.`}
          >
            {SURFACES.map(s => {
              const active = getActive(s);
              return (
                <window.DCArtboard
                  key={s}
                  id={`art-${s}`}
                  label={SURFACE_LABEL[s]}
                  width={ART_W}
                  height={ART_H}
                >
                  <ArtScreen
                    surface={active}
                    scenario={scenario}
                    density={density}
                    onNav={(next) => setActiveBySurface(p => ({ ...p, [s]: next }))}
                  />
                </window.DCArtboard>
              );
            })}
          </window.DCSection>
        </window.DesignCanvas>

        <window.TweaksPanel>
          <window.TweakSection label="Escenario" />
          <window.TweakRadio
            label="Día"
            value={scenario}
            options={[
              { value: 'quiet', label: 'Tranquilo' },
              { value: 'typical', label: 'Típico' },
              { value: 'busy', label: 'Saturado' },
            ]}
            onChange={(v) => setTweak('scenario', v)}
          />
          <window.TweakSection label="Densidad" />
          <window.TweakRadio
            label="Espacio"
            value={density}
            options={[
              { value: 'compact', label: 'Compacto' },
              { value: 'comfortable', label: 'Cómodo' },
            ]}
            onChange={(v) => setTweak('density', v)}
          />
          <window.TweakSection label="Color de acento" />
          <window.TweakColor
            label="Acento"
            value={t.accent}
            options={['#c96442', '#3b6ea5', '#5a8a5b', '#a35c87']}
            onChange={(v) => setTweak('accent', v)}
          />
        </window.TweaksPanel>

        <CommandPalette />
      </>
    );
  }

  // ── Cmd+K command palette (global) ───────────────────────
  function CommandPalette() {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState('');

    React.useEffect(() => {
      const onKey = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          setOpen((v) => !v);
        } else if (e.key === 'Escape') setOpen(false);
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, []);

    if (!open) return null;
    const t = Themes.marina;
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
    const filtered = query ? ITEMS.filter(i => i.label.toLowerCase().includes(query.toLowerCase())) : ITEMS;
    return (
      <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(31,29,24,0.40)', backdropFilter: 'blur(6px)', zIndex: 2147483645, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '14vh' }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: 520, background: '#fff', border: `1px solid ${t.border}`, borderRadius: 12, color: t.text, fontFamily: t.sansFont, boxShadow: '0 24px 80px rgba(31,29,24,0.25)' }}>
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar comando, yate, solicitud..." style={{ width: '100%', padding: '14px 18px', background: 'transparent', border: 'none', borderBottom: `1px solid ${t.border}`, color: t.text, fontSize: 15, fontFamily: t.sansFont, outline: 'none' }} />
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

  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
})();
