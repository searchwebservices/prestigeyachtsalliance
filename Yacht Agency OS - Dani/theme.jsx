// theme.jsx — UniqueOS-tokenized theme. Single warm-cream design language;
// kept three theme keys for compatibility with surface dispatchers, but only
// `marina` (the editorial branch) is rendered by app.jsx — and it now uses
// UniqueOS tokens (Montserrat, cream surfaces, clay accent, 8px radius).

(function () {
  // Shared UniqueOS palette
  const palette = {
    bgPrimary:   '#f5f4ee',
    bgSecondary: '#eceae0',
    surfaceLow:  '#f0eee5',
    surfaceMid:  '#e8e5d8',
    surfaceHigh: '#ddd9c8',
    raised:      '#ffffff',
    textPrimary: '#1f1d18',
    textSecondary: '#6b6557',
    textSubtle:  '#94907f',
    border:      '#e3e0d2',
    borderStrong:'#c8c3b1',
    accent:      '#c96442',
    accentSoft:  'color-mix(in srgb, #c96442 12%, transparent)',
    success:     '#10b981',
    warn:        '#f59e0b',
    danger:      '#b3392b',
    info:        '#3b82f6',
    sans:        '"Montserrat", system-ui, sans-serif',
    mono:        '"JetBrains Mono", ui-monospace, monospace',
  };

  function makeTheme(id, label, sub) {
    return {
      id, label, sub,
      isDark: false,
      bg:        palette.bgPrimary,
      bgDeep:    palette.surfaceLow,
      surface:   palette.raised,
      surfaceAlt:palette.bgSecondary,
      border:    palette.border,
      hairline:  palette.border,
      text:      palette.textPrimary,
      muted:     palette.textSecondary,
      dim:       palette.textSubtle,
      accent:    palette.accent,
      accentSoft:palette.accentSoft,
      success:   palette.success,
      warn:      palette.warn,
      danger:    palette.danger,
      info:      palette.info,
      sansFont:  palette.sans,
      monoFont:  palette.mono,
      displayFont: palette.sans,
      radius:    '8px',
      radiusLg:  '12px',
      cardShadow:'0 1px 2px 0 rgba(31, 29, 24, 0.06)',
      chrome:    'uniqueos',
    };
  }

  const Themes = {
    bridge:    makeTheme('marina', 'UniqueOS', 'Cabo · Operaciones'),
    marina:    makeTheme('marina', 'UniqueOS', 'Cabo · Operaciones'),
    concierge: makeTheme('marina', 'UniqueOS', 'Cabo · Operaciones'),
  };

  // ── Shared primitives (theme-aware) ───────────────────
  function Pill({ theme, tone = 'muted', children, mono, sm, style }) {
    const t = theme;
    const map = {
      muted:   { color: t.muted, bg: 'transparent',                 border: t.border },
      accent:  { color: t.accent, bg: t.accentSoft,                 border: 'transparent' },
      success: { color: t.success, bg: 'color-mix(in srgb, ' + t.success + ' 14%, transparent)', border: 'transparent' },
      warn:    { color: '#9a6500', bg: 'color-mix(in srgb, ' + t.warn + ' 18%, transparent)',     border: 'transparent' },
      danger:  { color: t.danger,  bg: 'color-mix(in srgb, ' + t.danger + ' 12%, transparent)',  border: 'transparent' },
      info:    { color: t.info,    bg: 'color-mix(in srgb, ' + t.info + ' 12%, transparent)',    border: 'transparent' },
      solid:   { color: '#fff',    bg: t.text,                       border: 'transparent' },
    };
    const p = map[tone] || map.muted;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: sm ? '2px 7px' : '3px 9px',
        fontSize: sm ? 10 : 11,
        fontWeight: 600,
        letterSpacing: '0.02em',
        color: p.color, background: p.bg,
        border: `1px solid ${p.border}`,
        borderRadius: 9999,
        fontFamily: mono ? t.monoFont : t.sansFont,
        textTransform: tone === 'muted' ? 'none' : 'uppercase',
        ...style,
      }}>{children}</span>
    );
  }

  function Stat({ theme, label, value, sub, mono, big, accentValue }) {
    const t = theme;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: t.muted, fontWeight: 600 }}>{label}</div>
        <div style={{
          fontSize: big ? 28 : 20,
          fontWeight: 600,
          color: accentValue ? t.accent : t.text,
          fontFamily: mono ? t.monoFont : t.sansFont,
          lineHeight: 1.1,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.01em',
        }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: t.muted, fontFamily: t.sansFont }}>{sub}</div>}
      </div>
    );
  }

  function Spark({ theme, values, w = 80, h = 18, fill }) {
    const t = theme;
    if (!values || !values.length) return null;
    const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - v * h}`).join(' ');
    const area = `M0,${h} L${pts} L${w},${h} Z`;
    const color = fill || t.accent;
    return (
      <svg width={w} height={h} style={{ display: 'block' }}>
        <path d={area} fill={color} opacity="0.18" />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" />
      </svg>
    );
  }

  function BarSeries({ theme, values, w = 120, h = 28, color }) {
    const t = theme;
    const c = color || t.accent;
    const bw = w / values.length - 1;
    return (
      <svg width={w} height={h} style={{ display: 'block' }}>
        {values.map((v, i) => (
          <rect key={i} x={i * (bw + 1)} y={h - v * h} width={bw} height={v * h} fill={c} opacity={0.35 + v * 0.5} rx="1" />
        ))}
      </svg>
    );
  }

  function SectionHd({ theme, title, count, right, level = 1 }) {
    const t = theme;
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderBottom: `1px solid ${t.hairline}`, paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h3 style={{ margin: 0, fontFamily: t.sansFont, fontWeight: 600, fontSize: level === 1 ? 18 : 16, letterSpacing: '-0.005em', color: t.text }}>{title}</h3>
          {count != null && (
            <span style={{ fontFamily: t.monoFont, fontSize: 11, color: t.muted, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
          )}
        </div>
        {right}
      </div>
    );
  }

  function Kbd({ theme, children, dim }) {
    const t = theme;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 18, height: 18, padding: '0 5px',
        fontSize: 10,
        fontFamily: t.monoFont, fontWeight: 500,
        color: dim ? t.dim : t.muted,
        background: '#fff',
        border: `1px solid ${t.border}`,
        borderRadius: 4,
        textTransform: 'uppercase',
      }}>{children}</span>
    );
  }

  function Avatar({ name, theme, size = 24 }) {
    const t = theme;
    const initials = name.replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
    return (
      <span style={{
        width: size, height: size, borderRadius: '50%',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: t.accentSoft, color: t.accent,
        fontSize: size * 0.40, fontWeight: 600, flex: '0 0 auto',
      }}>{initials}</span>
    );
  }

  function YachtMark({ yacht, theme, w = 4, h = 16 }) {
    const t = theme;
    return (
      <span style={{
        display: 'inline-block',
        width: w, height: h,
        background: `oklch(0.55 0.13 ${yacht.hue})`,
        borderRadius: 2, flex: '0 0 auto',
      }} />
    );
  }

  function SourceDot({ source, theme }) {
    const t = theme;
    const map = { experiencia: t.accent, reserva: t.success, abierta: t.info };
    return <span style={{ width: 6, height: 6, borderRadius: 50, background: map[source] || t.muted, flex: '0 0 auto' }} />;
  }

  function Priority({ priority, theme }) {
    const t = theme;
    const m = { urgente: t.danger, alta: t.warn, media: t.muted, baja: t.dim };
    return <span style={{ width: 8, height: 8, borderRadius: 50, background: m[priority] || t.muted, flex: '0 0 auto' }} />;
  }

  function Btn({ theme, children, primary, sm, style, onClick, kbd, mono }) {
    const t = theme;
    return (
      <button onClick={onClick} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: sm ? '6px 12px' : '8px 14px',
        fontSize: sm ? 12 : 13,
        fontWeight: 500,
        fontFamily: mono ? t.monoFont : t.sansFont,
        color: primary ? '#fff' : t.text,
        background: primary ? t.accent : '#fff',
        border: `1px solid ${primary ? 'transparent' : t.border}`,
        borderRadius: 8,
        cursor: 'pointer', minHeight: 32,
        boxShadow: primary ? '0 1px 2px rgba(31,29,24,0.08)' : 'none',
        ...style,
      }}>
        {children}
        {kbd && <Kbd theme={t} dim={primary}>{kbd}</Kbd>}
      </button>
    );
  }

  function Card({ theme, children, style, padded = true, glow, level = 0 }) {
    const t = theme;
    return (
      <div style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        boxShadow: glow ? `0 0 0 2px ${t.accentSoft}, ${t.cardShadow}` : t.cardShadow,
        padding: padded ? 16 : 0,
        ...style,
      }}>{children}</div>
    );
  }

  function YachtPhoto({ yacht, theme, w, h, label }) {
    const t = theme;
    const stripe = `repeating-linear-gradient(135deg, oklch(0.94 0.02 ${yacht.hue}) 0 8px, oklch(0.97 0.02 ${yacht.hue}) 8px 16px)`;
    return (
      <div style={{
        width: w || '100%', height: h || 120,
        background: stripe,
        borderRadius: 8,
        position: 'relative', overflow: 'hidden', flex: '0 0 auto',
        border: `1px solid ${t.border}`,
      }}>
        <span style={{
          position: 'absolute', left: 10, bottom: 8,
          fontFamily: t.monoFont, fontSize: 10, color: t.muted,
          textTransform: 'uppercase', letterSpacing: '0.10em', fontWeight: 600,
        }}>{label || 'foto · ' + yacht.length + 'ft'}</span>
      </div>
    );
  }

  window.Themes = Themes;
  window.UI = { Pill, Stat, Spark, BarSeries, SectionHd, Kbd, Avatar, YachtMark, SourceDot, Priority, Btn, Card, YachtPhoto };
})();
