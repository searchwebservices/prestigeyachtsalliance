// surface-portfolio.jsx — Flota (Yacht Portfolio), 3 themed variants.
(function () {
  const { yachts, yById, bookingsFor, utilization, fmt } = window.YachtData;
  const { Pill, SectionHd, Kbd, Avatar, YachtMark, Btn, Card, Spark, BarSeries, YachtPhoto } = window.UI;

  function Portfolio({ theme: t, scenario, density }) {
    const [classFilter, setClassFilter] = React.useState('todos');
    const [selectedId, setSelectedId] = React.useState(null);
    const [showAdd, setShowAdd] = React.useState(false);

    let filtered = yachts;
    if (classFilter === 'own') filtered = yachts.filter(y => y.klass === 'own');
    if (classFilter === 'partner') filtered = yachts.filter(y => y.klass === 'partner');

    if (t.id === 'bridge') return <BridgePortfolio {...{ t, filtered, classFilter, setClassFilter, scenario, showAdd, setShowAdd }} />;
    if (t.id === 'marina') return <MarinaPortfolio {...{ t, filtered, classFilter, setClassFilter, scenario, showAdd, setShowAdd }} />;
    return <ConciergePortfolio {...{ t, filtered, classFilter, setClassFilter, scenario, showAdd, setShowAdd }} />;
  }

  // ── Add partner yacht dialog ───────────────────────────
  function AddYachtDialog({ t, onClose }) {
    const [step, setStep] = React.useState(1);
    return (
      <div style={{ position: 'absolute', inset: 0, background: t.isDark ? 'rgba(0,0,0,0.55)' : 'rgba(20,20,20,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, backdropFilter: 'blur(6px)' }}>
        <div style={{ width: 540, background: t.surface, border: `0.5px solid ${t.border}`, borderRadius: t.radiusLg, padding: 22, color: t.text, boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <h3 style={{ margin: 0, fontFamily: t.displayFont, fontSize: t.id === 'marina' ? 26 : 18, fontWeight: 500 }}>Onboarding · yate aliado</h3>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: t.muted, fontSize: 18, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ fontSize: 11, fontFamily: t.monoFont, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Paso {step} de 3 · {step === 1 ? 'Datos del yate' : step === 2 ? 'Acuerdo comercial' : 'Disponibilidad y fotos'}</div>
          <div style={{ display: 'flex', height: 4, background: t.bgDeep, borderRadius: 2, marginBottom: 18 }}>
            {[1,2,3].map(n => <div key={n} style={{ flex: 1, marginRight: n < 3 ? 4 : 0, background: n <= step ? t.accent : t.hairline, borderRadius: 2 }} />)}
          </div>
          {step === 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field t={t} label="Nombre del yate"><input defaultValue="Mar Sereno" style={inp(t)} /></Field>
              <Field t={t} label="Tipo">
                <select style={inp(t)} defaultValue="Catamarán"><option>Sportfisher</option><option>Motor yacht</option><option>Velero</option><option>Catamarán</option><option>Trimarán</option></select>
              </Field>
              <Field t={t} label="Eslora (ft)"><input type="number" defaultValue={42} style={inp(t)} /></Field>
              <Field t={t} label="Capacidad"><input type="number" defaultValue={12} style={inp(t)} /></Field>
              <Field t={t} label="Marina base"><input defaultValue="Marina San José del Cabo" style={inp(t)} /></Field>
              <Field t={t} label="Año"><input type="number" defaultValue={2020} style={inp(t)} /></Field>
            </div>
          )}
          {step === 2 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field t={t} label="Comisión Prestige"><input type="number" defaultValue={20} style={inp(t)} /><span style={{ fontSize: 10, color: t.muted, marginTop: 4, display: 'block', fontFamily: t.monoFont }}>% sobre tarifa cliente</span></Field>
              <Field t={t} label="Tarifa por hora (USD)"><input type="number" defaultValue={1700} style={inp(t)} /></Field>
              <Field t={t} label="Propietario / agencia"><input defaultValue="Mar Sereno Charters S.A." style={inp(t)} /></Field>
              <Field t={t} label="Contacto principal"><input defaultValue="contacto@marsereno.mx" style={inp(t)} /></Field>
              <Field t={t} label="Capitán asignado"><input defaultValue="Cap. Octavio Pino" style={inp(t)} /></Field>
              <Field t={t} label="Términos del pago"><select style={inp(t)}><option>Net 14</option><option>Net 30</option><option>Pago inmediato</option></select></Field>
            </div>
          )}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field t={t} label="Días de operación">
                <div style={{ display: 'flex', gap: 4 }}>
                  {['L','M','M','J','V','S','D'].map((d, i) => <button key={i} style={{ flex: 1, padding: '6px 0', fontSize: 11, fontFamily: t.monoFont, background: i < 6 ? t.accentSoft : 'transparent', color: i < 6 ? t.accent : t.muted, border: `0.5px solid ${i < 6 ? t.accent : t.border}`, borderRadius: t.radius, cursor: 'pointer' }}>{d}</button>)}
                </div>
              </Field>
              <Field t={t} label="Fotos">
                <div style={{ border: `1px dashed ${t.border}`, borderRadius: t.radius, padding: 22, textAlign: 'center', color: t.muted, fontSize: 12, fontFamily: t.monoFont }}>↑ arrastra hasta 12 fotos · jpg/png/heic</div>
              </Field>
              <Field t={t} label="Reservable público desde">
                <input type="date" defaultValue="2026-05-15" style={inp(t)} />
              </Field>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 22, justifyContent: 'space-between' }}>
            <Btn theme={t} onClick={() => step > 1 ? setStep(step - 1) : onClose()}>{step > 1 ? '← Atrás' : 'Cancelar'}</Btn>
            <Btn theme={t} primary onClick={() => step < 3 ? setStep(step + 1) : onClose()}>{step < 3 ? 'Continuar →' : 'Publicar yate ↵'}</Btn>
          </div>
        </div>
      </div>
    );
  }

  const inp = (t) => ({ width: '100%', padding: '6px 8px', background: t.bgDeep, color: t.text, border: `0.5px solid ${t.border}`, borderRadius: t.radius, fontSize: 12, fontFamily: t.sansFont, outline: 'none' });
  function Field({ t, label, children }) {
    return (
      <div>
        <div style={{ fontSize: 9.5, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: t.monoFont, marginBottom: 4 }}>{label}</div>
        {children}
      </div>
    );
  }

  function FilterBar({ t, classFilter, setClassFilter, setShowAdd, count }) {
    const owns = yachts.filter(y => y.klass === 'own').length;
    const partners = yachts.filter(y => y.klass === 'partner').length;
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', gap: 0, border: `0.5px solid ${t.border}`, borderRadius: t.radius, overflow: 'hidden' }}>
          {[['todos', 'Todos', yachts.length], ['own', 'Flota propia', owns], ['partner', 'Aliados', partners]].map(([id, lbl, n]) => (
            <button key={id} onClick={() => setClassFilter(id)} style={{ padding: '5px 14px', fontSize: 11, fontFamily: t.id === 'concierge' ? t.monoFont : t.sansFont, background: classFilter === id ? t.accentSoft : 'transparent', color: classFilter === id ? t.accent : t.muted, border: 'none', cursor: 'pointer' }}>
              {lbl} <span style={{ fontFamily: t.monoFont, fontSize: 10, marginLeft: 2 }}>{n}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontFamily: t.monoFont, fontSize: 11, color: t.muted }}>{count} yates</span>
          <Btn theme={t} sm onClick={() => setShowAdd(true)}>+ Yate aliado <Kbd theme={t}>A</Kbd></Btn>
        </div>
      </div>
    );
  }

  // ── BRIDGE — spec-sheet card grid ───────────────────────
  function BridgePortfolio({ t, filtered, classFilter, setClassFilter, scenario, showAdd, setShowAdd }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12, position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: t.text, fontFamily: t.sansFont }}>Flota</h2>
          <FilterBar t={t} classFilter={classFilter} setClassFilter={setClassFilter} setShowAdd={setShowAdd} count={filtered.length} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, flex: 1, overflow: 'auto', minHeight: 0 }}>
          {filtered.map(y => {
            const u = utilization(y.id, scenario);
            const avg = Math.round(u.reduce((a, b) => a + b, 0) / 30 * 100);
            const days30 = u.filter(v => v > 0.05).length;
            const revBookings = bookingsFor(scenario).filter(b => b.yachtId === y.id && b.type === 'reservation');
            const totalRev = revBookings.reduce((s, b) => s + (b.value || 0), 0);
            return (
              <div key={y.id} style={{ background: t.surface, border: `0.5px solid ${t.border}`, borderRadius: t.radiusLg, padding: 14, display: 'grid', gridTemplateColumns: '120px 1fr', gap: 14 }}>
                <YachtPhoto yacht={y} theme={t} h={120} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <YachtMark yacht={y} theme={t} h={14} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{y.name}</span>
                      </div>
                      <div style={{ fontFamily: t.monoFont, fontSize: 10, color: t.muted, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{y.type} · {y.length}ft · {y.year}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
                      <Pill theme={t} tone={y.klass === 'partner' ? 'info' : 'accent'} mono sm>{y.klass === 'own' ? 'PROPIA' : 'ALIADO'}</Pill>
                      <Pill theme={t} tone={y.bookable ? 'success' : 'warn'} mono sm>{y.bookable ? 'PÚBLICO' : 'OCULTO'}</Pill>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, padding: '6px 0', borderTop: `0.5px solid ${t.hairline}`, borderBottom: `0.5px solid ${t.hairline}` }}>
                    <BridgeStat t={t} label="Tarifa" value={'$' + y.hourlyRate.toLocaleString()} sub="/ hora" />
                    <BridgeStat t={t} label={y.klass === 'own' ? 'Capacidad' : 'Comisión'} value={y.klass === 'own' ? y.capacity + 'p' : y.commission + '%'} sub={y.klass === 'own' ? 'invitados' : 'Prestige'} />
                    <BridgeStat t={t} label="Util. 30d" value={avg + '%'} sub={days30 + ' días'} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: t.monoFont, fontSize: 9.5, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>30d</span>
                    <BarSeries theme={t} values={u} w={140} h={20} color={`oklch(0.78 0.13 ${y.hue})`} />
                    <span style={{ fontFamily: t.monoFont, fontSize: 11, color: t.text, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{fmt.usdK(totalRev)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: t.muted, fontStyle: 'italic' }}>{y.tagline}</div>
                </div>
              </div>
            );
          })}
        </div>
        {showAdd && <AddYachtDialog t={t} onClose={() => setShowAdd(false)} />}
      </div>
    );
  }

  function BridgeStat({ t, label, value, sub }) {
    return (
      <div>
        <div style={{ fontFamily: t.monoFont, fontSize: 8.5, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
        <div style={{ fontFamily: t.monoFont, fontSize: 14, color: t.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontFamily: t.monoFont, fontSize: 8.5, color: t.dim }}>{sub}</div>
      </div>
    );
  }

  // ── MARINA — magazine listing cards ─────────────────────
  function MarinaPortfolio({ t, filtered, classFilter, setClassFilter, scenario, showAdd, setShowAdd }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 18, position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: t.displayFont, fontSize: 36, fontWeight: 500, color: t.text, letterSpacing: '-0.01em' }}>La Flota</h2>
            <p style={{ margin: '4px 0 0', fontFamily: t.displayFont, fontStyle: 'italic', fontSize: 16, color: t.muted, fontWeight: 400 }}>Cinco yates Prestige · tres aliados con licencia</p>
          </div>
          <FilterBar t={t} classFilter={classFilter} setClassFilter={setClassFilter} setShowAdd={setShowAdd} count={filtered.length} />
        </div>
        <div style={{ flex: 1, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 28, alignContent: 'start' }}>
          {filtered.map(y => {
            const u = utilization(y.id, scenario);
            const avg = Math.round(u.reduce((a, b) => a + b, 0) / 30 * 100);
            return (
              <article key={y.id} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                <YachtPhoto yacht={y} theme={t} h={180} />
                <div>
                  <div style={{ fontFamily: t.monoFont, fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.10em' }}>{y.klass === 'own' ? 'Flota Prestige' : 'Aliado · ' + y.commission + '%'}</div>
                  <h3 style={{ margin: '4px 0 0', fontFamily: t.displayFont, fontSize: 30, fontWeight: 500, letterSpacing: '-0.01em', color: t.text }}>{y.name}</h3>
                  <p style={{ margin: '4px 0 12px', fontFamily: t.displayFont, fontStyle: 'italic', fontSize: 16, color: t.muted, fontWeight: 400 }}>{y.tagline}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: `0.5px solid ${t.hairline}`, paddingTop: 10, gap: 4 }}>
                    <MarinaStatItem t={t} k="Eslora" v={y.length + ' ft'} />
                    <MarinaStatItem t={t} k="Capacidad" v={y.capacity + ' pers.'} />
                    <MarinaStatItem t={t} k="Tarifa" v={'$' + y.hourlyRate.toLocaleString()} />
                    <MarinaStatItem t={t} k="Utilización" v={avg + '%'} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Toggle t={t} on={y.bookable} />
                      <span style={{ fontSize: 12, color: t.muted }}>Reservable público</span>
                    </div>
                    <button style={{ background: 'transparent', border: 'none', color: t.accent, fontSize: 12.5, cursor: 'pointer', fontFamily: t.sansFont, textDecoration: 'underline', textUnderlineOffset: 3 }}>Editar perfil →</button>
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

  function MarinaStatItem({ t, k, v }) {
    return (
      <div>
        <div style={{ fontFamily: t.monoFont, fontSize: 9, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k}</div>
        <div style={{ fontFamily: t.displayFont, fontSize: 18, color: t.text, fontWeight: 500, lineHeight: 1.2 }}>{v}</div>
      </div>
    );
  }

  function Toggle({ t, on }) {
    return (
      <span style={{ width: 28, height: 16, borderRadius: 10, background: on ? t.accent : t.border, display: 'inline-flex', alignItems: 'center', padding: 2, transition: 'background .2s' }}>
        <span style={{ width: 12, height: 12, borderRadius: 50, background: '#fff', transform: on ? 'translateX(12px)' : 'translateX(0)', transition: 'transform .2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
      </span>
    );
  }

  // ── CONCIERGE — dense table ─────────────────────────────
  function ConciergePortfolio({ t, filtered, classFilter, setClassFilter, scenario, showAdd, setShowAdd }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10, position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: t.text, fontFamily: t.monoFont, textTransform: 'uppercase', letterSpacing: '0.10em' }}>flota · {filtered.length}</h2>
          <FilterBar t={t} classFilter={classFilter} setClassFilter={setClassFilter} setShowAdd={setShowAdd} count={filtered.length} />
        </div>
        <Card theme={t} padded={false} style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: t.monoFont }}>
            <thead>
              <tr style={{ background: t.surfaceAlt, fontSize: 9.5, color: t.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {['', 'yate', 'tipo', 'clase', 'cap', 'rate', 'comis.', 'utiliz. 30d', 'res 30d', 'reservable', 'capitán'].map((h, i) => (
                  <th key={i} style={{ textAlign: i >= 4 && i <= 8 ? 'right' : 'left', padding: '8px 12px', fontWeight: 500, borderBottom: `0.5px solid ${t.hairline}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((y, i) => {
                const u = utilization(y.id, scenario);
                const avg = Math.round(u.reduce((a, b) => a + b, 0) / 30 * 100);
                const res = bookingsFor(scenario).filter(b => b.yachtId === y.id && b.type === 'reservation').length;
                return (
                  <tr key={y.id} style={{ borderBottom: `0.5px solid ${t.hairline}`, fontSize: 11.5, color: t.text }}>
                    <td style={{ padding: '10px 0 10px 12px', width: 8 }}><YachtMark yacht={y} theme={t} h={28} w={3} /></td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ color: t.text, fontWeight: 500 }}>{y.name}</div>
                      <div style={{ fontSize: 9.5, color: t.dim }}>{y.length}ft · {y.year} · {y.base}</div>
                    </td>
                    <td style={{ padding: '10px 12px', color: t.muted }}>{y.type}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {y.klass === 'own'
                        ? <span style={{ color: t.accent }}>own</span>
                        : <span style={{ color: t.muted }}>partner</span>}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: t.muted }}>{y.capacity}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>${y.hourlyRate.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: t.muted }}>{y.commission ? y.commission + '%' : '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                        <BarSeries theme={t} values={u} w={70} h={16} color={`oklch(0.84 0.10 ${y.hue})`} />
                        <span style={{ width: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{avg}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: t.muted }}>{res}</td>
                    <td style={{ padding: '10px 12px' }}><Toggle t={t} on={y.bookable} /></td>
                    <td style={{ padding: '10px 12px', color: t.muted, fontSize: 10.5 }}>{y.captain.replace('Cap. ', '')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        {showAdd && <AddYachtDialog t={t} onClose={() => setShowAdd(false)} />}
      </div>
    );
  }

  window.Surfaces = window.Surfaces || {};
  window.Surfaces.Portfolio = Portfolio;
})();
