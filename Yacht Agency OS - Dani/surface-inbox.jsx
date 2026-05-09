// surface-inbox.jsx — Bandeja (Lead Inbox), 3 themed variants.
(function () {
  const { yachts, yById, EXPERIENCES, leadsFor, fmt } = window.YachtData;
  const { Pill, Stat, SectionHd, Kbd, Avatar, YachtMark, SourceDot, Priority, Btn, Card } = window.UI;

  function Inbox({ theme: t, scenario, density, onConvert }) {
    const leads = leadsFor(scenario);
    const [filter, setFilter] = React.useState('todos');
    const [selectedId, setSelectedId] = React.useState(leads[0]?.id);
    const [search, setSearch] = React.useState('');
    const [showConvert, setShowConvert] = React.useState(false);

    const FILTERS = [
      { id: 'todos', label: 'todos', count: leads.length },
      { id: 'urgente', label: 'urgentes', count: leads.filter(l => l.priority === 'urgente').length },
      { id: 'experiencia', label: 'experiencia', count: leads.filter(l => l.source === 'experiencia').length },
      { id: 'reserva', label: 'reserva directa', count: leads.filter(l => l.source === 'reserva').length },
      { id: 'abierta', label: 'abierta', count: leads.filter(l => l.source === 'abierta').length },
    ];

    let filtered = leads;
    if (filter === 'urgente') filtered = leads.filter(l => l.priority === 'urgente');
    else if (['experiencia', 'reserva', 'abierta'].includes(filter)) filtered = leads.filter(l => l.source === filter);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(l => l.guestName.toLowerCase().includes(q) || l.note.toLowerCase().includes(q));
    }
    const selected = filtered.find(l => l.id === selectedId) || filtered[0];

    if (t.id === 'bridge') return <BridgeInbox {...{ t, leads, filtered, FILTERS, filter, setFilter, search, setSearch, selected, setSelectedId, showConvert, setShowConvert, onConvert }} />;
    if (t.id === 'marina') return <MarinaInbox {...{ t, leads, filtered, FILTERS, filter, setFilter, search, setSearch, selected, setSelectedId, showConvert, setShowConvert, onConvert }} />;
    return <ConciergeInbox {...{ t, leads, filtered, FILTERS, filter, setFilter, search, setSearch, selected, setSelectedId, showConvert, setShowConvert, onConvert }} />;
  }

  // ── Convert dialog (shared) ─────────────────────────────
  function ConvertDialog({ t, lead, onClose }) {
    const [yachtId, setYachtId] = React.useState(lead.preferredYachtId || yachts.find(y => y.bookable)?.id);
    const [hours, setHours] = React.useState(lead.hours);
    const yacht = yById[yachtId];
    const total = yacht.hourlyRate * hours;
    return (
      <div style={{ position: 'absolute', inset: 0, background: t.isDark ? 'rgba(0,0,0,0.55)' : 'rgba(20,20,20,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, backdropFilter: 'blur(6px)' }}>
        <div style={{ width: 480, background: t.surface, border: `0.5px solid ${t.border}`, borderRadius: t.radiusLg, padding: 22, color: t.text, boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontFamily: t.displayFont, fontSize: t.id === 'marina' ? 24 : 18, fontWeight: 500 }}>Confirmar reserva · {lead.guestName}</h3>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: t.muted, fontSize: 18, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12 }}>
            <Field t={t} label="Experiencia"><span style={{ color: t.text }}>{EXPERIENCES[lead.experience]?.label}</span></Field>
            <Field t={t} label="Fecha solicitada"><span style={{ color: t.text, fontFamily: t.monoFont }}>{fmt.longDate(lead.requestedDate)} · {fmt.hhmm(lead.requestedDate)}</span></Field>
            <Field t={t} label="Asignar yate">
              <select value={yachtId} onChange={(e) => setYachtId(e.target.value)} style={{ width: '100%', padding: '6px 8px', background: t.bgDeep, color: t.text, border: `0.5px solid ${t.border}`, borderRadius: t.radius, fontFamily: t.sansFont, fontSize: 12 }}>
                {yachts.filter(y => y.bookable).map(y => (
                  <option key={y.id} value={y.id}>{y.name} · {y.type} · ${y.hourlyRate}/h</option>
                ))}
              </select>
              {lead.preferredYachtId === yachtId && (
                <div style={{ fontSize: 10.5, color: t.success, marginTop: 4, fontFamily: t.monoFont }}>✓ coincide con preferencia del cliente</div>
              )}
            </Field>
            <Field t={t} label="Duración">
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="number" min="3" max="8" value={hours} onChange={(e) => setHours(Math.max(3, Math.min(8, +e.target.value)))} style={{ width: 60, padding: '6px 8px', background: t.bgDeep, color: t.text, border: `0.5px solid ${t.border}`, borderRadius: t.radius, fontFamily: t.monoFont, fontSize: 12 }} />
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
            <Btn theme={t} primary onClick={onClose}>Confirmar y enviar contrato <Kbd theme={t}>↵</Kbd></Btn>
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

  // ── BRIDGE — list+detail with technical metadata ─────────
  function BridgeInbox({ t, leads, filtered, FILTERS, filter, setFilter, search, setSearch, selected, setSelectedId, showConvert, setShowConvert }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 12, height: '100%', position: 'relative' }}>
        {/* List pane */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="buscar por nombre, nota, yate..." style={{ width: '100%', padding: '7px 10px 7px 28px', background: t.surface, color: t.text, border: `0.5px solid ${t.border}`, borderRadius: t.radius, fontSize: 12, fontFamily: t.sansFont, outline: 'none' }} />
              <span style={{ position: 'absolute', left: 9, top: 7, color: t.muted, fontSize: 12 }}>⌕</span>
              <Kbd theme={t} dim><span style={{ position: 'absolute', right: 8, top: 7 }}>/</span></Kbd>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {FILTERS.map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)} style={{ padding: '4px 8px', fontSize: 10.5, fontFamily: t.monoFont, background: filter === f.id ? t.accentSoft : 'transparent', color: filter === f.id ? t.accent : t.muted, border: `0.5px solid ${filter === f.id ? t.accent : t.border}`, borderRadius: t.radius, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {f.label} · {f.count}
                </button>
              ))}
            </div>
          </div>
          <Card theme={t} padded={false} style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            {filtered.map((l, i) => {
              const yacht = l.preferredYachtId ? yById[l.preferredYachtId] : null;
              const isSel = l.id === (selected?.id);
              return (
                <button key={l.id} onClick={() => setSelectedId(l.id)} style={{
                  display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center', padding: '10px 12px',
                  width: '100%', textAlign: 'left',
                  background: isSel ? t.accentSoft : 'transparent',
                  borderTop: i ? `0.5px solid ${t.hairline}` : 'none',
                  borderLeft: isSel ? `2px solid ${t.accent}` : '2px solid transparent',
                  cursor: 'pointer',
                }}>
                  <Priority priority={l.priority} theme={t} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12.5, color: l.status === 'nuevo' ? t.text : t.muted, fontWeight: l.status === 'nuevo' ? 600 : 400 }}>{l.guestName}</span>
                      <SourceDot source={l.source} theme={t} />
                      {yacht && <YachtMark yacht={yacht} theme={t} h={11} />}
                    </div>
                    <div style={{ fontSize: 10.5, color: t.muted, fontFamily: t.monoFont, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {EXPERIENCES[l.experience]?.short} · {l.party}p · {fmt.ddmm(l.requestedDate)} {fmt.hhmm(l.requestedDate)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: t.monoFont, fontSize: 11, color: t.text, fontVariantNumeric: 'tabular-nums' }}>{l.value ? fmt.usdK(l.value) : '—'}</div>
                    <div style={{ fontSize: 9.5, color: t.dim, fontFamily: t.monoFont, marginTop: 2 }}>{fmt.ago(l.ageMin)}</div>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: t.muted, fontSize: 12, fontFamily: t.monoFont }}>{search ? '⌕ sin resultados' : '· bandeja al día ·'}</div>
            )}
          </Card>
        </div>

        {/* Detail pane */}
        {selected ? <BridgeLeadDetail t={t} lead={selected} setShowConvert={setShowConvert} /> : <Card theme={t}><div style={{ color: t.muted, textAlign: 'center', padding: 40 }}>Selecciona una solicitud</div></Card>}

        {showConvert && selected && <ConvertDialog t={t} lead={selected} onClose={() => setShowConvert(false)} />}
      </div>
    );
  }

  function BridgeLeadDetail({ t, lead, setShowConvert }) {
    const yacht = lead.preferredYachtId ? yById[lead.preferredYachtId] : null;
    return (
      <Card theme={t} padded={false} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '14px 18px', borderBottom: `0.5px solid ${t.hairline}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: t.monoFont, fontSize: 10, color: t.dim }}>{lead.id}</span>
              <Pill theme={t} tone={lead.priority === 'urgente' ? 'danger' : lead.priority === 'alta' ? 'warn' : 'muted'} mono sm>{lead.priority}</Pill>
              <Pill theme={t} tone="muted" mono sm>{lead.source}</Pill>
              <span style={{ fontFamily: t.monoFont, fontSize: 10.5, color: t.muted }}>· vía {lead.channel}</span>
              <span style={{ fontFamily: t.monoFont, fontSize: 10.5, color: t.muted }}>· {fmt.ago(lead.ageMin)}</span>
            </div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: t.text }}>{lead.guestName}</h2>
            <div style={{ fontSize: 12, color: t.muted, fontFamily: t.monoFont, marginTop: 2 }}>{lead.country} · {lead.party} pers.</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn theme={t} sm kbd="R">Responder</Btn>
            <Btn theme={t} sm kbd="A">Archivar</Btn>
            <Btn theme={t} sm primary kbd="C" onClick={() => setShowConvert(true)}>Confirmar</Btn>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 9.5, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: t.monoFont, marginBottom: 6 }}>Mensaje del cliente</div>
            <p style={{ margin: 0, fontSize: 13.5, color: t.text, lineHeight: 1.5, padding: 14, background: t.bgDeep, borderRadius: t.radius, border: `0.5px solid ${t.hairline}` }}>{lead.note}</p>
          </div>

          <DetailGrid t={t} title="Solicitud" items={[
            ['Experiencia', EXPERIENCES[lead.experience]?.label],
            ['Fecha primaria', fmt.longDate(lead.requestedDate) + ' · ' + fmt.hhmm(lead.requestedDate)],
            ['Fecha alterna', lead.backupDate ? fmt.longDate(lead.backupDate) : '—'],
            ['Duración', lead.hours + 'h'],
            ['Invitados', lead.party + ' personas'],
            ['Valor estimado', lead.value ? fmt.usd(lead.value) : 'sin presupuesto declarado'],
          ]} />

          <DetailGrid t={t} title="Yate sugerido" items={[
            ['Yate', yacht ? yacht.name : '— por asignar'],
            ['Tipo', yacht ? yacht.type + ' · ' + yacht.length + 'ft' : '—'],
            ['Capacidad', yacht ? yacht.capacity + ' personas' : '—'],
            ['Tarifa', yacht ? '$' + yacht.hourlyRate + '/h' : '—'],
            ['Disponibilidad', yacht && yacht.bookable ? '✓ disponible para fecha' : '⚠ verificar calendario'],
            ['Capitán', yacht ? yacht.captain : '—'],
          ]} />
        </div>
      </Card>
    );
  }

  function DetailGrid({ t, title, items }) {
    return (
      <div>
        <div style={{ fontSize: 9.5, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: t.monoFont, marginBottom: 8 }}>{title}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px 14px', fontSize: 12 }}>
          {items.map(([k, v], i) => (
            <React.Fragment key={i}>
              <span style={{ color: t.muted }}>{k}</span>
              <span style={{ color: t.text, fontFamily: typeof v === 'string' && /[\d$]/.test(v) ? t.monoFont : 'inherit' }}>{v}</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  // ── MARINA — editorial vertical feed + side detail ───────
  function MarinaInbox({ t, leads, filtered, FILTERS, filter, setFilter, search, setSearch, selected, setSelectedId, showConvert, setShowConvert }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 28, height: '100%', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ borderBottom: `0.5px solid ${t.hairline}`, paddingBottom: 16, marginBottom: 8 }}>
            <h2 style={{ fontFamily: t.displayFont, fontWeight: 500, fontSize: 36, margin: 0, letterSpacing: '-0.01em', color: t.text }}>Bandeja</h2>
            <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 12.5, color: t.muted, fontFamily: t.sansFont, alignItems: 'center', flexWrap: 'wrap' }}>
              {FILTERS.map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)} style={{ background: 'transparent', border: 'none', padding: 0, color: filter === f.id ? t.text : t.muted, fontWeight: filter === f.id ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, letterSpacing: 0, textDecoration: filter === f.id ? `underline ${t.accent} 2px` : 'none', textUnderlineOffset: 5 }}>
                  {f.label} <span style={{ fontFamily: t.monoFont, fontSize: 10, color: t.dim, marginLeft: 2 }}>{f.count}</span>
                </button>
              ))}
              <span style={{ flex: 1 }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="buscar..." style={{ padding: '5px 9px', background: 'transparent', color: t.text, border: `0.5px solid ${t.border}`, borderRadius: t.radius, fontSize: 12, fontFamily: t.sansFont, outline: 'none', width: 180 }} />
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {filtered.map((l, i) => {
              const isSel = l.id === (selected?.id);
              return (
                <button key={l.id} onClick={() => setSelectedId(l.id)} style={{ width: '100%', textAlign: 'left', background: isSel ? t.surfaceAlt : 'transparent', border: 'none', borderTop: `0.5px solid ${t.hairline}`, padding: '18px 14px', cursor: 'pointer', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 16, alignItems: 'baseline' }}>
                  <Priority priority={l.priority} theme={t} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <span style={{ fontFamily: t.displayFont, fontSize: 22, fontWeight: 500, color: t.text, letterSpacing: '-0.005em' }}>{l.guestName}</span>
                      <span style={{ fontFamily: t.monoFont, fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l.source}</span>
                    </div>
                    <div style={{ fontSize: 13, color: t.muted, marginTop: 4 }}>{EXPERIENCES[l.experience]?.label} · {l.party} personas · {fmt.longDate(l.requestedDate)}</div>
                    <p style={{ margin: '6px 0 0', fontSize: 13, color: t.text, lineHeight: 1.45, fontStyle: 'italic', opacity: 0.85, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>"{l.note}"</p>
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
            <div style={{ fontFamily: t.monoFont, fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.10em' }}>{selected.id} · {selected.country} · {fmt.ago(selected.ageMin)}</div>
            <h2 style={{ fontFamily: t.displayFont, fontSize: 44, fontWeight: 500, margin: '8px 0 0', letterSpacing: '-0.02em', color: t.text }}>{selected.guestName}</h2>
            <p style={{ fontFamily: t.displayFont, fontStyle: 'italic', fontSize: 18, color: t.muted, margin: '8px 0 0' }}>
              {EXPERIENCES[selected.experience]?.label} · {selected.party} pers. · {selected.hours}h · {fmt.longDate(selected.requestedDate)}
            </p>
            <p style={{ fontSize: 14, color: t.text, lineHeight: 1.6, margin: '20px 0 0', borderLeft: `2px solid ${t.accent}`, paddingLeft: 14 }}>{selected.note}</p>

            <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 14, columnGap: 18 }}>
              <Stat theme={t} label="Valor estimado" value={selected.value ? fmt.usd(selected.value) : 'Sin presupuesto'} mono />
              <Stat theme={t} label="Yate sugerido" value={selected.preferredYachtId ? yById[selected.preferredYachtId].name : 'Por asignar'} />
              <Stat theme={t} label="Fecha alterna" value={selected.backupDate ? fmt.longDate(selected.backupDate) : '—'} />
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

  // ── CONCIERGE — split-pane velocity ──────────────────────
  function ConciergeInbox({ t, leads, filtered, FILTERS, filter, setFilter, search, setSearch, selected, setSelectedId, showConvert, setShowConvert }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 10, height: '100%', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="/ buscar" style={{ flex: 1, padding: '6px 9px', background: t.surface, color: t.text, border: `0.5px solid ${t.border}`, borderRadius: t.radius, fontSize: 12, fontFamily: t.monoFont, outline: 'none' }} />
            <Kbd theme={t}>/</Kbd>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, fontFamily: t.monoFont }}>
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 10px', fontSize: 11.5, background: filter === f.id ? t.accentSoft : 'transparent', color: filter === f.id ? t.accent : t.text, border: 'none', borderRadius: t.radius, cursor: 'pointer', textAlign: 'left' }}>
                <span># {f.label}</span><span style={{ color: filter === f.id ? t.accent : t.dim }}>{f.count}</span>
              </button>
            ))}
          </div>
          <Card theme={t} padded={false} style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            {filtered.map((l, i) => {
              const isSel = l.id === (selected?.id);
              const yacht = l.preferredYachtId ? yById[l.preferredYachtId] : null;
              return (
                <button key={l.id} onClick={() => setSelectedId(l.id)} style={{
                  display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, alignItems: 'center', padding: '7px 12px',
                  width: '100%', textAlign: 'left',
                  background: isSel ? t.accentSoft : 'transparent',
                  borderTop: i ? `0.5px solid ${t.hairline}` : 'none',
                  borderLeft: isSel ? `2px solid ${t.accent}` : '2px solid transparent',
                  cursor: 'pointer', fontFamily: t.monoFont,
                }}>
                  <Priority priority={l.priority} theme={t} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: l.status === 'nuevo' ? t.text : t.muted, fontWeight: l.status === 'nuevo' ? 500 : 400 }}>{l.guestName}</span>
                      {yacht && <YachtMark yacht={yacht} theme={t} h={9} />}
                    </div>
                    <div style={{ fontSize: 10, color: t.muted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {EXPERIENCES[l.experience]?.short} · {l.party}p · {fmt.ddmm(l.requestedDate)}
                    </div>
                  </div>
                  <span style={{ fontSize: 9.5, color: t.dim }}>{fmt.ago(l.ageMin)}</span>
                </button>
              );
            })}
          </Card>
        </div>

        {selected && (
          <Card theme={t} padded={false} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: '10px 16px', borderBottom: `0.5px solid ${t.hairline}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontFamily: t.monoFont }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10.5, color: t.dim }}>{selected.id}</span>
                <span style={{ fontSize: 14, color: t.text }}>{selected.guestName}</span>
                <Pill theme={t} tone={selected.priority === 'urgente' ? 'danger' : selected.priority === 'alta' ? 'warn' : 'muted'} mono sm>{selected.priority}</Pill>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <ConciergeBtn t={t} kbd="R">reply</ConciergeBtn>
                <ConciergeBtn t={t} kbd="P">phone</ConciergeBtn>
                <ConciergeBtn t={t} kbd="A">archive</ConciergeBtn>
                <ConciergeBtn t={t} kbd="C" primary onClick={() => setShowConvert(true)}>convert</ConciergeBtn>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <p style={{ margin: 0, fontSize: 13, color: t.text, lineHeight: 1.55, fontFamily: t.sansFont }}>{selected.note}</p>
              </div>
              <DetailGrid t={t} title="solicitud" items={[
                ['exp', EXPERIENCES[selected.experience]?.label],
                ['fecha', fmt.longDate(selected.requestedDate) + ' · ' + fmt.hhmm(selected.requestedDate)],
                ['alterna', selected.backupDate ? fmt.longDate(selected.backupDate) : '—'],
                ['horas', selected.hours + 'h'],
                ['inv', selected.party],
                ['valor', selected.value ? fmt.usd(selected.value) : 'sin presup.'],
              ]} />
              <DetailGrid t={t} title="yate" items={[
                ['nombre', selected.preferredYachtId ? yById[selected.preferredYachtId].name : '— asignar'],
                ['tipo', selected.preferredYachtId ? yById[selected.preferredYachtId].type : '—'],
                ['rate', selected.preferredYachtId ? '$' + yById[selected.preferredYachtId].hourlyRate + '/h' : '—'],
                ['cap', selected.preferredYachtId ? yById[selected.preferredYachtId].capacity + 'p' : '—'],
                ['cap.', selected.preferredYachtId ? yById[selected.preferredYachtId].captain : '—'],
                ['canal', selected.channel],
              ]} />
            </div>
          </Card>
        )}

        {showConvert && selected && <ConvertDialog t={t} lead={selected} onClose={() => setShowConvert(false)} />}
      </div>
    );
  }

  function ConciergeBtn({ t, children, kbd, primary, onClick }) {
    return (
      <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px', fontSize: 11, fontFamily: t.monoFont, color: primary ? t.bgDeep : t.text, background: primary ? t.accent : 'transparent', border: `0.5px solid ${primary ? 'transparent' : t.border}`, borderRadius: t.radius, cursor: 'pointer' }}>
        {children}
        <Kbd theme={t} dim={primary}>{kbd}</Kbd>
      </button>
    );
  }

  window.Surfaces = window.Surfaces || {};
  window.Surfaces.Inbox = Inbox;
})();
