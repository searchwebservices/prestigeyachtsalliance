// surface-dashboard.jsx — Panel (landing/connective view), 3 themed variants.
// Same logical content; layout/visual differs heavily by theme.
// Exports: window.Surfaces.Dashboard

(function () {
  const { yachts, EXPERIENCES, alertsFor, todayBookings, revenue, leadsFor, fmt, TODAY, TZ_LABEL } = window.YachtData;
  const { Pill, Stat, Spark, BarSeries, SectionHd, Kbd, Avatar, YachtMark, SourceDot, Priority, Btn, Card } = window.UI;

  function Dashboard({ theme: t, scenario, density, onNav }) {
    const today = todayBookings(scenario);
    const leads = leadsFor(scenario);
    const alerts = alertsFor(scenario);
    const rev = revenue(scenario);
    const newLeads = leads.filter((l) => l.status === 'nuevo');
    const urgentLeads = leads.filter((l) => l.priority === 'urgente' || l.priority === 'alta');
    const dense = density === 'compact';

    if (t.id === 'bridge') return <BridgeDashboard {...{ t, today, leads, alerts, rev, newLeads, urgentLeads, dense, onNav, scenario }} />;
    if (t.id === 'marina') return <MarinaDashboard {...{ t, today, leads, alerts, rev, newLeads, urgentLeads, dense, onNav, scenario }} />;
    return <ConciergeDashboard {...{ t, today, leads, alerts, rev, newLeads, urgentLeads, dense, onNav, scenario }} />;
  }

  // ── BRIDGE ────────────────────────────────────────────────────────────
  function BridgeDashboard({ t, today, leads, alerts, rev, newLeads, urgentLeads, dense, onNav, scenario }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, height: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
          {/* Header strip — instrument cluster */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, border: `0.5px solid ${t.border}`, borderRadius: t.radiusLg, overflow: 'hidden', background: t.surface }}>
            {[
              { label: 'Reservas hoy', value: today.length.toString().padStart(2, '0'), sub: today.reduce((s, b) => s + (b.value || 0), 0) ? fmt.usdK(today.reduce((s, b) => s + (b.value || 0), 0)) + ' bruto' : 'sin actividad' },
              { label: 'Bandeja · nuevos', value: newLeads.length.toString().padStart(2, '0'), sub: newLeads.length ? `pendiente más antiguo: ${fmt.ago(Math.max(...newLeads.map(l => l.ageMin)))}` : 'al día' },
              { label: 'Utilización 30d', value: rev.utilizationPct + '%', sub: 'flota completa' },
              { label: 'Ingresos · MTD', value: fmt.usdK(rev.mtdUSD), sub: (rev.pace >= 0 ? '+' : '') + rev.pace.toFixed(1) + '% vs mes ant.', accentValue: rev.pace > 0 },
            ].map((s, i) => (
              <div key={i} style={{ padding: 14, borderRight: i < 3 ? `0.5px solid ${t.border}` : 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 9.5, letterSpacing: '0.10em', textTransform: 'uppercase', color: t.muted, fontFamily: t.monoFont }}>{s.label}</div>
                <div style={{ fontSize: 24, fontFamily: t.monoFont, color: s.accentValue ? t.success : t.text, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{s.value}</div>
                <div style={{ fontSize: 10.5, color: t.dim, fontFamily: t.monoFont }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Today schedule — horizontal radar/timeline */}
          <Card theme={t} padded={false} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px', borderBottom: `0.5px solid ${t.hairline}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <SectionHd theme={t} title="Hoy · Cronograma de salidas" count={today.length} right={<span style={{ fontFamily: t.monoFont, fontSize: 10.5, color: t.dim }}>{TZ_LABEL}</span>} />
            </div>
            <div style={{ padding: '14px 16px', flex: 1, overflow: 'hidden' }}>
              <BridgeTimeline theme={t} bookings={today} yachts={yachts} />
            </div>
          </Card>

          {/* Utilization bars per yacht */}
          <Card theme={t}>
            <SectionHd theme={t} title="Utilización · últimos 30 días" right={<Pill theme={t} mono sm>media flota {rev.utilizationPct}%</Pill>} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', columnGap: 24, rowGap: 8, marginTop: 12 }}>
              {yachts.map((y) => (
                <div key={y.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <YachtMark yacht={y} theme={t} />
                  <span style={{ fontSize: 12, color: t.text, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{y.name}</span>
                  <BarSeries theme={t} values={window.YachtData.utilization(y.id, scenario)} w={120} h={20} color={`oklch(0.78 0.13 ${y.hue})`} />
                  <span style={{ fontFamily: t.monoFont, fontSize: 10.5, color: t.muted, width: 32, textAlign: 'right' }}>
                    {Math.round(window.YachtData.utilization(y.id, scenario).reduce((a, b) => a + b, 0) / 30 * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right rail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
          {/* Alerts — radar contacts */}
          <Card theme={t}>
            <SectionHd theme={t} title="Alertas activas" count={alerts.length} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {alerts.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', background: t.bgDeep, borderRadius: t.radius, border: `0.5px solid ${t.hairline}` }}>
                  <span style={{ width: 6, height: 6, borderRadius: 50, marginTop: 6, background: a.kind === 'danger' ? t.danger : a.kind === 'warn' ? t.warn : t.info, boxShadow: `0 0 8px ${a.kind === 'danger' ? t.danger : a.kind === 'warn' ? t.warn : t.info}` }} />
                  <span style={{ fontSize: 12, color: t.text, lineHeight: 1.45 }}>{a.text}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Bandeja preview */}
          <Card theme={t} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <SectionHd theme={t} title="Bandeja · prioritarios" count={urgentLeads.length} right={<button onClick={() => onNav?.('inbox')} style={{ background: 'transparent', border: 'none', color: t.accent, fontSize: 11, cursor: 'pointer', fontFamily: t.monoFont }}>abrir →</button>} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 8, overflow: 'auto', minHeight: 0 }}>
              {urgentLeads.slice(0, 6).map((l, i) => (
                <div key={l.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 10, alignItems: 'center', padding: '8px 4px', borderTop: i ? `0.5px solid ${t.hairline}` : 'none' }}>
                  <Priority priority={l.priority} theme={t} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.guestName}</div>
                    <div style={{ fontSize: 10.5, color: t.muted, fontFamily: t.monoFont }}>{EXPERIENCES[l.experience]?.short} · {l.party}p · {fmt.ddmm(l.requestedDate)}</div>
                  </div>
                  <span style={{ fontSize: 10.5, color: t.dim, fontFamily: t.monoFont }}>{fmt.ago(l.ageMin)}</span>
                  <span style={{ fontSize: 10.5, color: t.muted, fontFamily: t.monoFont }}>{l.value ? fmt.usdK(l.value) : '—'}</span>
                </div>
              ))}
              {urgentLeads.length === 0 && (
                <div style={{ padding: 14, textAlign: 'center', color: t.muted, fontSize: 12 }}>Bandeja al día.</div>
              )}
            </div>
          </Card>

          {/* Quick actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Btn theme={t} onClick={() => onNav?.('calendar')}>Bloquear fechas <Kbd theme={t}>B</Kbd></Btn>
            <Btn theme={t} onClick={() => onNav?.('portfolio')}>Añadir yate aliado <Kbd theme={t}>A</Kbd></Btn>
            <Btn theme={t} onClick={() => onNav?.('inbox')}>Nueva reserva manual <Kbd theme={t}>N</Kbd></Btn>
            <Btn theme={t} primary>Ver reporte semanal <Kbd theme={t}>R</Kbd></Btn>
          </div>
        </div>
      </div>
    );
  }

  // Bridge timeline — yachts as rows, hours 06–18 as columns
  function BridgeTimeline({ theme: t, bookings, yachts }) {
    const HOURS = [];
    for (let h = 6; h <= 18; h++) HOURS.push(h);
    const NOW = new Date(window.YachtData.TODAY); NOW.setHours(11, 12, 0, 0); // pretend "now"
    const colWidth = `1fr`;

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8, position: 'relative', height: '100%' }}>
        <div></div>
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${HOURS.length}, 1fr)` }}>
          {HOURS.map((h) => (
            <div key={h} style={{ fontFamily: t.monoFont, fontSize: 9.5, color: t.dim, padding: '0 2px', borderLeft: `0.5px solid ${t.hairline}` }}>{fmt.pad(h)}</div>
          ))}
        </div>
        {yachts.map((y, i) => (
          <React.Fragment key={y.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: t.text, paddingTop: 8, paddingBottom: 8, borderTop: i ? `0.5px solid ${t.hairline}` : 'none' }}>
              <YachtMark yacht={y} theme={t} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{y.name}</span>
            </div>
            <div style={{ position: 'relative', borderTop: i ? `0.5px solid ${t.hairline}` : 'none', height: 30 }}>
              {/* Hour grid */}
              <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${HOURS.length}, 1fr)`, pointerEvents: 'none' }}>
                {HOURS.map((h, hi) => (
                  <div key={h} style={{ borderLeft: `0.5px solid ${t.hairline}`, opacity: 0.5 }} />
                ))}
              </div>
              {/* Bookings */}
              {bookings.filter((b) => b.yachtId === y.id).map((b) => {
                const startH = b.start.getHours() + b.start.getMinutes() / 60;
                const endH = b.end.getHours() + b.end.getMinutes() / 60;
                const left = ((startH - 6) / 12) * 100;
                const width = ((endH - startH) / 12) * 100;
                return (
                  <div key={b.id} style={{
                    position: 'absolute', top: 4, height: 22, left: left + '%', width: width + '%',
                    background: `oklch(0.30 0.04 ${y.hue})`,
                    border: `0.5px solid oklch(0.62 0.13 ${y.hue})`,
                    borderRadius: 3, padding: '2px 6px',
                    fontSize: 10, color: t.text, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    boxShadow: b.conflict ? `0 0 0 1px ${t.danger}` : 'none',
                  }}>{b.title}</div>
                );
              })}
              {/* Now line — only on first row visually but stretches via overlay */}
            </div>
          </React.Fragment>
        ))}
        {/* Now line overlay */}
        <div style={{ position: 'absolute', top: 16, bottom: 0, left: 110 + 8, right: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: ((11.2 - 6) / 12 * 100) + '%', width: 1, background: t.accent, boxShadow: `0 0 6px ${t.accent}` }}>
            <span style={{ position: 'absolute', top: -14, left: -16, fontFamily: t.monoFont, fontSize: 9.5, color: t.accent, background: t.surface, padding: '1px 4px', borderRadius: 2 }}>11:12</span>
          </div>
        </div>
      </div>
    );
  }

  // ── MARINA ────────────────────────────────────────────────────────────
  function MarinaDashboard({ t, today, leads, alerts, rev, newLeads, urgentLeads, dense, onNav, scenario }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 32, height: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, minHeight: 0 }}>
          {/* Editorial masthead */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontFamily: t.monoFont, fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: t.muted }}>Volumen XII · {fmt.longDate(window.YachtData.TODAY)}</span>
            </div>
            <h1 style={{ fontFamily: t.displayFont, fontWeight: 500, fontSize: 56, lineHeight: 1.0, margin: '6px 0 0', letterSpacing: '-0.02em', color: t.text }}>
              Buenos días, Dani.
            </h1>
            <p style={{ fontFamily: t.displayFont, fontStyle: 'italic', fontSize: 22, color: t.muted, margin: '6px 0 0', fontWeight: 400 }}>
              {today.length} salidas hoy · {newLeads.length} solicitudes esperan respuesta · sea-of-cortez II zarpa al atardecer.
            </p>
          </div>

          {/* Today's schedule — editorial table */}
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
                  <tr><td colSpan={5} style={{ padding: 22, textAlign: 'center', color: t.muted, fontStyle: 'italic', fontFamily: t.displayFont, fontSize: 18 }}>Hoy no hay salidas. Día tranquilo, perfecto para mantenimiento.</td></tr>
                )}
                {today.map((b) => {
                  const y = window.YachtData.yById[b.yachtId];
                  return (
                    <tr key={b.id} style={{ borderTop: `0.5px solid ${t.hairline}` }}>
                      <td style={{ padding: '12px 4px', fontFamily: t.monoFont, fontSize: 12, color: t.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt.hhmm(b.start)}<span style={{ color: t.dim }}> – {fmt.hhmm(b.end)}</span></td>
                      <td style={{ padding: '12px 4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <YachtMark yacht={y} theme={t} h={20} />
                          <span style={{ fontFamily: t.displayFont, fontSize: 18, color: t.text }}>{y.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 4px', fontSize: 13, color: t.text }}>{b.title}</td>
                      <td style={{ padding: '12px 4px', textAlign: 'right', fontFamily: t.monoFont, fontSize: 12, color: t.muted }}>{b.party}</td>
                      <td style={{ padding: '12px 4px', textAlign: 'right', fontFamily: t.monoFont, fontSize: 12, color: t.text }}>{fmt.usdK(b.value)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Utilization */}
          <div>
            <SectionHd theme={t} title="Flota · utilización 30 días" right={<span style={{ fontFamily: t.monoFont, fontSize: 11, color: t.muted }}>media {rev.utilizationPct}%</span>} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 32px', marginTop: 14 }}>
              {yachts.map((y) => {
                const u = window.YachtData.utilization(y.id, scenario);
                const avg = Math.round(u.reduce((a, b) => a + b, 0) / 30 * 100);
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

        {/* Right column — accents */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Numbers card */}
          <div style={{ borderTop: `2px solid ${t.accent}`, paddingTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 16, columnGap: 16 }}>
            <Stat theme={t} label="Reservas hoy" value={today.length.toString().padStart(2, '0')} sub={today.length ? fmt.usdK(today.reduce((s, b) => s + b.value, 0)) + ' bruto' : 'sin actividad'} big />
            <Stat theme={t} label="Bandeja" value={newLeads.length.toString().padStart(2, '0')} sub={newLeads.length ? 'esperando respuesta' : 'al día'} big />
            <Stat theme={t} label="Ingresos · MTD" value={'$' + (rev.mtdUSD/1000).toFixed(0) + 'k'} sub={(rev.pace >= 0 ? '+' : '') + rev.pace.toFixed(1) + '% vs mes ant.'} accentValue={rev.pace > 0} big />
            <Stat theme={t} label="Utilización" value={rev.utilizationPct + '%'} sub="flota completa" big />
          </div>

          {/* Alerts */}
          <div>
            <SectionHd theme={t} title="Atención" count={alerts.length} />
            <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {alerts.map((a, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: t.text, lineHeight: 1.5, paddingLeft: 12, borderLeft: `2px solid ${a.kind === 'danger' ? t.danger : a.kind === 'warn' ? t.warn : t.accent}` }}>
                  {a.text}
                </li>
              ))}
            </ul>
          </div>

          {/* Bandeja prioritarios */}
          <div>
            <SectionHd theme={t} title="Bandeja prioritaria" count={urgentLeads.length} right={<button onClick={() => onNav?.('inbox')} style={{ background: 'transparent', border: 'none', color: t.accent, fontSize: 12, cursor: 'pointer', fontFamily: t.sansFont, textDecoration: 'underline', textUnderlineOffset: 3 }}>Ver bandeja</button>} />
            <div style={{ marginTop: 10 }}>
              {urgentLeads.slice(0, 4).map((l, i) => (
                <div key={l.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'baseline', padding: '12px 0', borderTop: `0.5px solid ${t.hairline}` }}>
                  <Priority priority={l.priority} theme={t} />
                  <div>
                    <div style={{ fontFamily: t.displayFont, fontSize: 17, color: t.text, lineHeight: 1.15 }}>{l.guestName}</div>
                    <div style={{ fontSize: 11.5, color: t.muted, marginTop: 2 }}>{EXPERIENCES[l.experience]?.label} · {l.party} pers. · {fmt.ddmm(l.requestedDate)} · llegó hace {fmt.ago(l.ageMin)}</div>
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

  // ── CONCIERGE ──────────────────────────────────────────────────────────
  function ConciergeDashboard({ t, today, leads, alerts, rev, newLeads, urgentLeads, dense, onNav, scenario }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, gridAutoRows: 'min-content', height: '100%' }}>
        {/* Top stats row spans 3 cols */}
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0, border: `0.5px solid ${t.border}`, borderRadius: t.radius, overflow: 'hidden', background: t.surface }}>
          {[
            { l: 'salidas hoy', v: today.length.toString().padStart(2, '0'), s: today.reduce((s, b) => s + (b.value || 0), 0) ? fmt.usdK(today.reduce((s, b) => s + (b.value || 0), 0)) : '—' },
            { l: 'bandeja · nuevos', v: newLeads.length.toString().padStart(2, '0'), s: newLeads.length ? 'oldest ' + fmt.ago(Math.max(...newLeads.map(l=>l.ageMin))) : 'al día' },
            { l: 'urgentes', v: urgentLeads.filter(l=>l.priority==='urgente').length.toString().padStart(2, '0'), s: 'requieren acción' },
            { l: 'utilización', v: rev.utilizationPct + '%', s: 'flota · 30d' },
            { l: 'mtd', v: fmt.usdK(rev.mtdUSD), s: (rev.pace >= 0 ? '↑ ' : '↓ ') + Math.abs(rev.pace).toFixed(1) + '%' },
          ].map((s, i) => (
            <div key={i} style={{ padding: '10px 14px', borderRight: i < 4 ? `0.5px solid ${t.hairline}` : 'none' }}>
              <div style={{ fontSize: 9.5, fontFamily: t.monoFont, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.l}</div>
              <div style={{ fontSize: 22, fontFamily: t.monoFont, color: t.text, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{s.v}</div>
              <div style={{ fontSize: 10, fontFamily: t.monoFont, color: t.dim, marginTop: 1 }}>{s.s}</div>
            </div>
          ))}
        </div>

        {/* Left col: Today list */}
        <Card theme={t} padded={false} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 14px', borderBottom: `0.5px solid ${t.hairline}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SectionHd theme={t} title="hoy" count={today.length} />
            <Kbd theme={t}>1</Kbd>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
            {today.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: t.muted, fontFamily: t.monoFont, fontSize: 12 }}>sin salidas hoy.</div>}
            {today.map((b, i) => {
              const y = window.YachtData.yById[b.yachtId];
              return (
                <div key={b.id} style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr auto', gap: 8, alignItems: 'center', padding: '8px 14px', borderTop: i ? `0.5px solid ${t.hairline}` : 'none', fontFamily: t.monoFont }}>
                  <span style={{ fontSize: 11, color: t.accent, fontVariantNumeric: 'tabular-nums', minWidth: 36 }}>{fmt.hhmm(b.start)}</span>
                  <YachtMark yacht={y} theme={t} h={12} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title}</div>
                    <div style={{ fontSize: 10, color: t.muted }}>{y.name} · {b.party}p</div>
                  </div>
                  <span style={{ fontSize: 10.5, color: t.muted }}>{fmt.usdK(b.value)}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Middle col: Bandeja */}
        <Card theme={t} padded={false} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 14px', borderBottom: `0.5px solid ${t.hairline}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SectionHd theme={t} title="bandeja" count={leads.length} />
            <div style={{ display: 'flex', gap: 4 }}>
              <Kbd theme={t}>2</Kbd>
              <button onClick={() => onNav?.('inbox')} style={{ background: 'transparent', border: 'none', color: t.accent, fontSize: 11, cursor: 'pointer', fontFamily: t.monoFont }}>open →</button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {leads.slice(0, 8).map((l, i) => (
              <div key={l.id} style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr auto', gap: 8, alignItems: 'center', padding: '8px 14px', borderTop: i ? `0.5px solid ${t.hairline}` : 'none', fontFamily: t.monoFont }}>
                <Priority priority={l.priority} theme={t} />
                <SourceDot source={l.source} theme={t} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.guestName}</div>
                  <div style={{ fontSize: 10, color: t.muted }}>{EXPERIENCES[l.experience]?.short} · {l.party}p · {fmt.ddmm(l.requestedDate)}</div>
                </div>
                <span style={{ fontSize: 10.5, color: t.dim }}>{fmt.ago(l.ageMin)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Right col: alerts + actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Card theme={t} padded={false}>
            <div style={{ padding: '10px 14px', borderBottom: `0.5px solid ${t.hairline}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionHd theme={t} title="alertas" count={alerts.length} />
              <Kbd theme={t}>3</Kbd>
            </div>
            <div style={{ padding: '4px 0' }}>
              {alerts.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 14px', borderTop: i ? `0.5px solid ${t.hairline}` : 'none', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 9.5, fontFamily: t.monoFont, color: a.kind === 'danger' ? t.danger : a.kind === 'warn' ? t.warn : t.info, textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 50 }}>{a.kind === 'danger' ? 'crit' : a.kind === 'warn' ? 'warn' : 'info'}</span>
                  <span style={{ fontSize: 11.5, color: t.text, lineHeight: 1.4 }}>{a.text}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card theme={t}>
            <SectionHd theme={t} title="atajos" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
              {[['G I', 'bandeja', () => onNav?.('inbox')], ['G C', 'calendario', () => onNav?.('calendar')], ['G F', 'flota', () => onNav?.('portfolio')], ['B', 'bloquear fechas'], ['A', 'añadir aliado'], ['⌘ K', 'comando']].map(([k, l, f], i) => (
                <button key={i} onClick={f} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'transparent', border: `0.5px solid ${t.hairline}`, borderRadius: t.radius, color: t.text, fontFamily: t.monoFont, fontSize: 11, cursor: 'pointer' }}>
                  <span>{l}</span>
                  <Kbd theme={t}>{k}</Kbd>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  window.Surfaces = window.Surfaces || {};
  window.Surfaces.Dashboard = Dashboard;
})();
