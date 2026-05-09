// surface-calendar.jsx — Calendario y disponibilidad, 3 themed variants.
(function () {
  const { yachts, yById, EXPERIENCES, bookingsFor, fmt, TODAY, day: dayFn } = window.YachtData;
  const { Pill, SectionHd, Kbd, YachtMark, Btn, Card } = window.UI;

  function Calendar({ theme: t, scenario }) {
    const [view, setView] = React.useState(t.id === 'marina' ? 'month' : 'week'); // week | day | month
    const [showBlock, setShowBlock] = React.useState(false);
    const [draggingId, setDraggingId] = React.useState(null);
    const [dragOffset, setDragOffset] = React.useState(0);
    const bookings = bookingsFor(scenario);

    if (t.id === 'bridge') return <BridgeCal {...{ t, view, setView, bookings, showBlock, setShowBlock, draggingId, setDraggingId, dragOffset, setDragOffset }} />;
    if (t.id === 'marina') return <MarinaCal {...{ t, view, setView, bookings, showBlock, setShowBlock }} />;
    return <ConciergeCal {...{ t, view, setView, bookings, showBlock, setShowBlock }} />;
  }

  // ── Block-dates dialog ─────────────────────────────────
  function BlockDialog({ t, onClose }) {
    const [yachtId, setYachtId] = React.useState(yachts[0].id);
    const [kind, setKind] = React.useState('mantenimiento');
    return (
      <div style={{ position: 'absolute', inset: 0, background: t.isDark ? 'rgba(0,0,0,0.55)' : 'rgba(20,20,20,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, backdropFilter: 'blur(6px)' }}>
        <div style={{ width: 440, background: t.surface, border: `0.5px solid ${t.border}`, borderRadius: t.radiusLg, padding: 22, color: t.text, boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontFamily: t.displayFont, fontSize: t.id === 'marina' ? 24 : 18, fontWeight: 500 }}>Bloquear fechas</h3>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: t.muted, fontSize: 18, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field t={t} label="Yate">
              <select value={yachtId} onChange={(e) => setYachtId(e.target.value)} style={{ width: '100%', padding: '6px 8px', background: t.bgDeep, color: t.text, border: `0.5px solid ${t.border}`, borderRadius: t.radius, fontSize: 12 }}>
                {yachts.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </Field>
            <Field t={t} label="Tipo de bloqueo">
              <div style={{ display: 'flex', gap: 6 }}>
                {[['mantenimiento', 'Mantenimiento'], ['propietario', 'Uso del propietario'], ['privado', 'Reserva interna']].map(([k, l]) => (
                  <button key={k} onClick={() => setKind(k)} style={{ flex: 1, padding: '6px 8px', fontSize: 11, background: kind === k ? t.accentSoft : 'transparent', color: kind === k ? t.accent : t.text, border: `0.5px solid ${kind === k ? t.accent : t.border}`, borderRadius: t.radius, cursor: 'pointer' }}>{l}</button>
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
              <textarea rows={2} placeholder="ej. Astilleros Cabo · cambio de motor" style={{ width: '100%', padding: '6px 8px', background: t.bgDeep, color: t.text, border: `0.5px solid ${t.border}`, borderRadius: t.radius, fontSize: 12, fontFamily: t.sansFont, resize: 'none' }} />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
            <Btn theme={t} onClick={onClose}>Cancelar</Btn>
            <Btn theme={t} primary onClick={onClose}>Bloquear <Kbd theme={t}>↵</Kbd></Btn>
          </div>
        </div>
      </div>
    );
  }
  function Field({ t, label, children }) {
    return (
      <div>
        <div style={{ fontSize: 9.5, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: t.monoFont, marginBottom: 4 }}>{label}</div>
        {children}
      </div>
    );
  }

  // Generate week/days array
  function daysOfWeek() {
    // Monday-anchored 7 days starting from this week's Monday relative to TODAY
    const d = new Date(TODAY);
    const wd = d.getDay(); // Sun=0
    const diff = wd === 0 ? -6 : 1 - wd;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    return Array.from({ length: 7 }).map((_, i) => {
      const x = new Date(monday); x.setDate(monday.getDate() + i); return x;
    });
  }

  // Booking color
  const bgColor = (b, t) => {
    const y = yById[b.yachtId];
    if (b.type === 'block') return `repeating-linear-gradient(135deg, oklch(${t.isDark ? 0.32 : 0.86} 0.03 30) 0 6px, oklch(${t.isDark ? 0.36 : 0.92} 0.03 30) 6px 12px)`;
    if (b.type === 'hold') return `oklch(${t.isDark ? 0.32 : 0.96} 0.10 ${y.hue} / 0.55)`;
    return t.id === 'marina' ? `oklch(0.94 0.04 ${y.hue})` : `oklch(${t.isDark ? 0.34 : 0.92} 0.06 ${y.hue})`;
  };
  const borderColor = (b, t) => {
    const y = yById[b.yachtId];
    if (b.type === 'block') return `oklch(${t.isDark ? 0.55 : 0.55} 0.06 30 / 0.7)`;
    if (b.type === 'hold') return `oklch(0.65 0.13 ${y.hue})`;
    return t.id === 'marina' ? `oklch(0.55 0.10 ${y.hue})` : `oklch(${t.isDark ? 0.62 : 0.50} 0.13 ${y.hue})`;
  };

  // ── BRIDGE — week-grid with rows per yacht ─────────────
  function BridgeCal({ t, view, setView, bookings, showBlock, setShowBlock, draggingId, setDraggingId, dragOffset, setDragOffset }) {
    const days = daysOfWeek();
    const HOURS = []; for (let h = 6; h <= 18; h++) HOURS.push(h);
    const colWidth = 88;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12, position: 'relative' }}>
        <Toolbar t={t} view={view} setView={setView} setShowBlock={setShowBlock} bookings={bookings} />
        <Card theme={t} padded={false} style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `170px repeat(7, ${colWidth * 13}px)`, position: 'relative', minWidth: 'min-content' }}>
            {/* header row */}
            <div style={{ position: 'sticky', top: 0, left: 0, zIndex: 3, background: t.surface, borderBottom: `0.5px solid ${t.border}`, borderRight: `0.5px solid ${t.border}`, padding: '10px 12px', fontFamily: t.monoFont, fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Yate ↓ / Día →</div>
            {days.map((d, i) => {
              const isToday = d.toDateString() === TODAY.toDateString();
              return (
                <div key={i} style={{ position: 'sticky', top: 0, zIndex: 2, background: t.surface, borderBottom: `0.5px solid ${t.border}`, padding: '8px 6px 4px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontFamily: t.monoFont, fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{fmt.dow[d.getDay()]}</span>
                    <span style={{ fontFamily: t.monoFont, fontSize: 18, color: isToday ? t.accent : t.text, fontVariantNumeric: 'tabular-nums', fontWeight: isToday ? 600 : 400 }}>{fmt.pad(d.getDate())}</span>
                    <span style={{ fontFamily: t.monoFont, fontSize: 10, color: t.dim }}>{fmt.monthAbbr[d.getMonth()]}</span>
                    {isToday && <Pill theme={t} tone="accent" mono sm style={{ marginLeft: 4 }}>HOY</Pill>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(13, 1fr)`, marginTop: 6 }}>
                    {HOURS.map(h => (
                      <div key={h} style={{ fontSize: 9, color: t.dim, fontFamily: t.monoFont, textAlign: 'left', borderLeft: `0.5px solid ${t.hairline}`, paddingLeft: 1 }}>{fmt.pad(h)}</div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* yacht rows */}
            {yachts.map((y, ri) => (
              <React.Fragment key={y.id}>
                <div style={{ position: 'sticky', left: 0, zIndex: 1, background: t.surface, borderRight: `0.5px solid ${t.border}`, borderBottom: `0.5px solid ${t.hairline}`, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, height: 56 }}>
                  <YachtMark yacht={y} theme={t} h={20} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{y.name}</div>
                    <div style={{ fontSize: 9.5, color: t.muted, fontFamily: t.monoFont, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{y.klass === 'own' ? 'flota propia' : 'aliado · ' + y.commission + '%'}</div>
                  </div>
                </div>
                {days.map((d, di) => (
                  <DayCell key={di} t={t} day={d} yacht={y} bookings={bookings} hours={HOURS} draggingId={draggingId} setDraggingId={setDraggingId} dragOffset={dragOffset} setDragOffset={setDragOffset} />
                ))}
              </React.Fragment>
            ))}
          </div>
        </Card>
        {showBlock && <BlockDialog t={t} onClose={() => setShowBlock(false)} />}
      </div>
    );
  }

  function DayCell({ t, day, yacht, bookings, hours, draggingId, setDraggingId, dragOffset, setDragOffset }) {
    const cellRef = React.useRef();
    const items = bookings.filter(b => b.yachtId === yacht.id && b.start.toDateString() === day.toDateString());

    const onDragStart = (id) => (e) => {
      setDraggingId(id);
      setDragOffset(0);
      const startX = e.clientX;
      const move = (ev) => setDragOffset(ev.clientX - startX);
      const up = () => {
        setDraggingId(null); setDragOffset(0);
        window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
      };
      window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    };

    return (
      <div ref={cellRef} style={{ borderBottom: `0.5px solid ${t.hairline}`, borderLeft: `0.5px solid ${t.hairline}`, position: 'relative', height: 56, background: day.toDateString() === TODAY.toDateString() ? t.accentSoft : 'transparent' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${hours.length}, 1fr)`, pointerEvents: 'none' }}>
          {hours.map((h, i) => <div key={h} style={{ borderLeft: i ? `0.5px solid ${t.hairline}` : 'none', opacity: 0.5 }} />)}
        </div>
        {items.map(b => {
          const startH = b.start.getHours() + b.start.getMinutes() / 60;
          const endH = b.end.getHours() + b.end.getMinutes() / 60;
          const left = ((startH - 6) / 13) * 100;
          const width = ((endH - startH) / 13) * 100;
          const isDragging = draggingId === b.id;
          return (
            <div key={b.id} onMouseDown={onDragStart(b.id)} style={{
              position: 'absolute', top: 6, height: 44,
              left: `calc(${left}% + ${isDragging ? dragOffset : 0}px)`, width: width + '%',
              background: bgColor(b, t),
              border: `0.5px solid ${b.conflict ? t.danger : borderColor(b, t)}`,
              borderRadius: 4, padding: '3px 6px',
              cursor: 'grab', userSelect: 'none',
              boxShadow: b.conflict ? `0 0 0 1px ${t.danger}` : isDragging ? `0 8px 24px rgba(0,0,0,0.4)` : 'none',
              opacity: isDragging ? 0.85 : 1, zIndex: isDragging ? 5 : 1,
            }}>
              <div style={{ fontSize: 10, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{b.title}</div>
              <div style={{ fontFamily: t.monoFont, fontSize: 9, color: t.muted, marginTop: 1 }}>{fmt.hhmm(b.start)}–{fmt.hhmm(b.end)}{b.party ? ' · ' + b.party + 'p' : ''}</div>
            </div>
          );
        })}
      </div>
    );
  }

  function Toolbar({ t, view, setView, setShowBlock, bookings }) {
    const monthLabel = `Mayo 2026 · semana ${Math.ceil(TODAY.getDate()/7)}`;
    const totalRev = bookings.filter(b => b.type === 'reservation').reduce((s, b) => s + (b.value || 0), 0);
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontFamily: t.id === 'marina' ? t.displayFont : t.sansFont, fontSize: t.id === 'marina' ? 30 : 18, fontWeight: t.id === 'marina' ? 500 : 600, color: t.text, letterSpacing: t.id === 'marina' ? '-0.01em' : 0 }}>{monthLabel}</h2>
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={{ width: 26, height: 26, background: 'transparent', border: `0.5px solid ${t.border}`, borderRadius: t.radius, color: t.muted, cursor: 'pointer' }}>‹</button>
            <button style={{ padding: '4px 10px', background: 'transparent', border: `0.5px solid ${t.border}`, borderRadius: t.radius, color: t.text, fontSize: 11, cursor: 'pointer', fontFamily: t.monoFont }}>HOY</button>
            <button style={{ width: 26, height: 26, background: 'transparent', border: `0.5px solid ${t.border}`, borderRadius: t.radius, color: t.muted, cursor: 'pointer' }}>›</button>
          </div>
          <div style={{ display: 'flex', gap: 0, border: `0.5px solid ${t.border}`, borderRadius: t.radius, overflow: 'hidden' }}>
            {[['day', 'Día'], ['week', 'Semana'], ['month', 'Mes']].map(([id, lbl]) => (
              <button key={id} onClick={() => setView(id)} style={{ padding: '4px 12px', fontSize: 11, fontFamily: t.id === 'concierge' ? t.monoFont : t.sansFont, background: view === id ? t.accentSoft : 'transparent', color: view === id ? t.accent : t.muted, border: 'none', cursor: 'pointer' }}>{lbl}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: t.monoFont, fontSize: 11, color: t.muted }}>{bookings.filter(b => b.type === 'reservation').length} reservas · {fmt.usdK(totalRev)}</span>
          <Btn theme={t} sm onClick={() => setShowBlock(true)}>Bloquear fechas <Kbd theme={t}>B</Kbd></Btn>
          <Btn theme={t} sm primary>Nueva reserva</Btn>
        </div>
      </div>
    );
  }

  // ── MARINA — month grid (calendar look), elegant ─────────
  function MarinaCal({ t, view, setView, bookings, showBlock, setShowBlock }) {
    // Build full month of May 2026
    const firstOfMonth = new Date(2026, 4, 1);
    const lastDay = new Date(2026, 5, 0);
    const startWd = (firstOfMonth.getDay() + 6) % 7; // Monday=0
    const totalCells = Math.ceil((startWd + lastDay.getDate()) / 7) * 7;
    const cells = [];
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(2026, 4, i - startWd + 1);
      cells.push(d);
    }
    const dayBookings = (d) => bookings.filter(b => b.start.toDateString() === d.toDateString());

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16, position: 'relative' }}>
        <Toolbar t={t} view={view} setView={setView} setShowBlock={setShowBlock} bookings={bookings} />
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'auto repeat(' + (totalCells / 7) + ', 1fr)', borderLeft: `0.5px solid ${t.hairline}`, borderTop: `0.5px solid ${t.hairline}` }}>
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d, i) => (
            <div key={i} style={{ padding: '8px 12px', fontFamily: t.monoFont, fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.10em', borderRight: `0.5px solid ${t.hairline}`, borderBottom: `0.5px solid ${t.hairline}` }}>{d}</div>
          ))}
          {cells.map((d, i) => {
            const inMonth = d.getMonth() === 4;
            const isToday = d.toDateString() === TODAY.toDateString();
            const items = dayBookings(d);
            return (
              <div key={i} style={{ padding: 8, borderRight: `0.5px solid ${t.hairline}`, borderBottom: `0.5px solid ${t.hairline}`, opacity: inMonth ? 1 : 0.35, position: 'relative', minHeight: 96, background: isToday ? t.accentSoft : 'transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: t.displayFont, fontSize: 22, fontWeight: 500, color: isToday ? t.accent : t.text, lineHeight: 1 }}>{d.getDate()}</span>
                  {items.length > 0 && <span style={{ fontFamily: t.monoFont, fontSize: 10, color: t.muted }}>{items.length}</span>}
                </div>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {items.slice(0, 4).map(b => {
                    const y = yById[b.yachtId];
                    return (
                      <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: t.text, padding: '1px 4px', borderLeft: `2px solid oklch(0.55 0.13 ${y.hue})`, background: b.type === 'block' ? bgColor(b, t) : 'transparent', borderRadius: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <span style={{ fontFamily: t.monoFont, fontSize: 9.5, color: t.muted }}>{fmt.hhmm(b.start)}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title.split(' · ')[0]}</span>
                      </div>
                    );
                  })}
                  {items.length > 4 && <span style={{ fontSize: 10, color: t.muted, fontStyle: 'italic' }}>+{items.length - 4} más</span>}
                </div>
              </div>
            );
          })}
        </div>
        {showBlock && <BlockDialog t={t} onClose={() => setShowBlock(false)} />}
      </div>
    );
  }

  // ── CONCIERGE — dense week grid ─────────────────────────
  function ConciergeCal({ t, view, setView, bookings, showBlock, setShowBlock }) {
    const days = daysOfWeek();
    const HOURS = []; for (let h = 6; h <= 18; h++) HOURS.push(h);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10, position: 'relative' }}>
        <Toolbar t={t} view={view} setView={setView} setShowBlock={setShowBlock} bookings={bookings} />
        <Card theme={t} padded={false} style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {/* Day-by-day stack: each day a horizontal row of yacht-mini-bars */}
          {days.map((d, di) => {
            const isToday = d.toDateString() === TODAY.toDateString();
            return (
              <div key={di} style={{ borderTop: di ? `0.5px solid ${t.hairline}` : 'none', display: 'grid', gridTemplateColumns: '110px 1fr', minHeight: 64 }}>
                <div style={{ padding: '10px 14px', borderRight: `0.5px solid ${t.hairline}`, fontFamily: t.monoFont, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: 10.5, color: isToday ? t.accent : t.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{fmt.dow[d.getDay()]}</span>
                  <span style={{ fontSize: 22, color: isToday ? t.accent : t.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{fmt.pad(d.getDate())} <span style={{ fontSize: 11, color: t.dim }}>{fmt.monthAbbr[d.getMonth()]}</span></span>
                  <span style={{ fontSize: 9.5, color: t.dim, marginTop: 2 }}>{bookings.filter(b => b.start.toDateString() === d.toDateString() && b.type === 'reservation').length} res</span>
                </div>
                <div style={{ position: 'relative', padding: '8px 14px' }}>
                  {/* Hour ruler */}
                  <div style={{ position: 'relative', height: 14, marginBottom: 4 }}>
                    {HOURS.map((h, hi) => (
                      <span key={h} style={{ position: 'absolute', left: ((h - 6) / 13 * 100) + '%', fontSize: 8.5, fontFamily: t.monoFont, color: t.dim }}>{fmt.pad(h)}</span>
                    ))}
                  </div>
                  {/* Yacht stacked rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, position: 'relative' }}>
                    {yachts.map(y => {
                      const items = bookings.filter(b => b.yachtId === y.id && b.start.toDateString() === d.toDateString());
                      return (
                        <div key={y.id} style={{ position: 'relative', height: 14, background: t.bgDeep, borderRadius: 2 }}>
                          {items.map(b => {
                            const startH = b.start.getHours() + b.start.getMinutes() / 60;
                            const endH = b.end.getHours() + b.end.getMinutes() / 60;
                            const left = ((startH - 6) / 13) * 100;
                            const width = ((endH - startH) / 13) * 100;
                            return (
                              <div key={b.id} title={b.title} style={{
                                position: 'absolute', top: 0, height: 14,
                                left: left + '%', width: width + '%',
                                background: b.type === 'block' ? bgColor(b, t) : `oklch(0.62 0.13 ${y.hue})`,
                                borderRadius: 2,
                                fontSize: 9, color: t.bgDeep, padding: '0 4px',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                fontFamily: t.monoFont, fontWeight: 500,
                                boxShadow: b.conflict ? `0 0 0 1px ${t.danger}` : 'none',
                              }}>{b.title.split(' · ')[0]}</div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
        {/* Yacht legend */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontFamily: t.monoFont, fontSize: 10.5, color: t.muted }}>
          {yachts.map(y => (
            <span key={y.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, background: `oklch(0.62 0.13 ${y.hue})`, borderRadius: 2 }} />
              {y.name}
            </span>
          ))}
        </div>
        {showBlock && <BlockDialog t={t} onClose={() => setShowBlock(false)} />}
      </div>
    );
  }

  window.Surfaces = window.Surfaces || {};
  window.Surfaces.Calendar = Calendar;
})();
