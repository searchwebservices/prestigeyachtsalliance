// data.js — shared yacht/lead/booking data + scenario logic.
// Plain JS, attaches to window. Loaded as <script src> before any JSX.

(function () {
  // ── Today ──────────────────────────────────────────────
  // Anchor "today" so the prototype is reproducible. Jueves 7 mayo 2026.
  const TODAY = new Date(2026, 4, 7); // May 7, 2026 (month is 0-indexed)
  const TZ_LABEL = 'GMT-7 · Mazatlán';

  // ── Yacht catalog ──────────────────────────────────────
  const yachts = [
    {
      id: 'made-for-waves', name: 'Made for Waves', klass: 'own',
      type: 'Sportfisher', length: 52, capacity: 12, hourlyRate: 2400,
      base: 'Marina Cabo San Lucas', captain: 'Cap. Esteban Ruiz',
      bookable: true, year: 2021, hue: 198,
      tagline: 'Buque insignia de Prestige · pesca de altura',
    },
    {
      id: 'sea-of-cortez-ii', name: 'Sea of Cortez II', klass: 'own',
      type: 'Motor yacht', length: 48, capacity: 10, hourlyRate: 2100,
      base: 'Marina Cabo San Lucas', captain: 'Cap. Mario Beltrán',
      bookable: true, year: 2019, hue: 215,
      tagline: 'Crucero al atardecer y celebraciones íntimas',
    },
    {
      id: 'capricho', name: 'Capricho', klass: 'own',
      type: 'Motor yacht', length: 65, capacity: 14, hourlyRate: 2800,
      base: 'Marina Cabo San Lucas', captain: 'Cap. Diego Salinas',
      bookable: true, year: 2022, hue: 230,
      tagline: 'Yate insignia VIP · 65 pies, dos cubiertas',
    },
    {
      id: 'pacifica', name: 'Pacífica', klass: 'own',
      type: 'Velero', length: 46, capacity: 8, hourlyRate: 1800,
      base: 'Marina Puerto Los Cabos', captain: 'Cap. Lía Mendoza',
      bookable: true, year: 2018, hue: 175,
      tagline: 'Velero clásico · navegación silenciosa',
    },
    {
      id: 'marlin-azul', name: 'Marlín Azul', klass: 'own',
      type: 'Sportfisher', length: 38, capacity: 6, hourlyRate: 1400,
      base: 'Marina Cabo San Lucas', captain: 'Cap. Jorge Almada',
      bookable: false, year: 2017, hue: 210,
      tagline: 'Pesca deportiva · presupuesto ajustado',
    },
    {
      id: 'trimaran-la-paz', name: 'Trimarán La Paz', klass: 'partner',
      type: 'Trimarán', length: 45, capacity: 16, hourlyRate: 1950,
      base: 'Marina La Paz', captain: 'Cap. Andrés Cota',
      bookable: true, year: 2020, hue: 32, commission: 18,
      ownerName: 'Familia Cota Robles', ownerContact: 'andres@cotaventures.mx',
      tagline: 'Aliado · trimarán para snorkel y grupos grandes',
    },
    {
      id: 'lucero-del-mar', name: 'Lucero del Mar', klass: 'partner',
      type: 'Catamarán', length: 52, capacity: 18, hourlyRate: 2300,
      base: 'Marina Cabo San Lucas', captain: 'Cap. Renata Ávila',
      bookable: true, year: 2021, hue: 50, commission: 22,
      ownerName: 'Pacific Sail Holdings', ownerContact: 'r.avila@pacsail.com',
      tagline: 'Aliado · catamarán de lujo · cubierta amplia',
    },
    {
      id: 'dorado', name: 'Dorado del Pacífico', klass: 'partner',
      type: 'Sportfisher', length: 41, capacity: 8, hourlyRate: 1600,
      base: 'Marina San José del Cabo', captain: 'Cap. Felipe Quintero',
      bookable: true, year: 2019, hue: 18, commission: 20,
      ownerName: 'Quintero & Hijos S.A.', ownerContact: 'felipe@doradopacifico.mx',
      tagline: 'Aliado · sport fishing torneos certificados',
    },
  ];

  const yById = Object.fromEntries(yachts.map((y) => [y.id, y]));

  // ── Experience catalog ─────────────────────────────────
  const EXPERIENCES = {
    pesca:        { label: 'Pesca deportiva',      short: 'Pesca' },
    atardecer:    { label: 'Crucero al atardecer', short: 'Atardecer' },
    snorkel:      { label: 'Snorkel & playa',      short: 'Snorkel' },
    privada:      { label: 'Celebración privada',  short: 'Privada' },
    ballenas:     { label: 'Avistamiento ballenas',short: 'Ballenas' },
    despedida:    { label: 'Despedida de soltera', short: 'Despedida' },
    corporativo:  { label: 'Evento corporativo',   short: 'Corporativo' },
    abierto:      { label: 'Consulta abierta',     short: 'Abierta' },
    directa:      { label: 'Reserva directa',      short: 'Directa' },
  };

  // ── Helper: build a Date in Mazatlán-local-ish terms ──
  const day = (offset, h = 0, m = 0) => {
    const d = new Date(TODAY);
    d.setDate(d.getDate() + offset);
    d.setHours(h, m, 0, 0);
    return d;
  };

  // ── Lead generators (scenario-aware) ───────────────────
  // Each lead: { id, source, channel, experience, guestName, party, requestedDate,
  //   backupDate?, hours, note, value, priority, ageMin, status, country }

  const baseLeadsTypical = [
    {
      id: 'L-2041', source: 'experiencia', channel: 'web', experience: 'pesca',
      guestName: 'Familia Whitfield', party: 6, country: 'US · CA',
      requestedDate: day(2, 6, 30), backupDate: day(4, 6, 30), hours: 6,
      note: 'Padre + 2 hijos adolescentes. Marlin específicamente. Salida temprano.',
      value: 14400, priority: 'alta', ageMin: 14, status: 'nuevo',
      preferredYachtId: 'made-for-waves',
    },
    {
      id: 'L-2040', source: 'reserva', channel: 'directa', experience: 'atardecer',
      guestName: 'Sandra Reséndiz', party: 8, country: 'MX · CDMX',
      requestedDate: day(0, 17, 0), hours: 4,
      note: 'Aniversario 25 años. Pidió Sea of Cortez II por nombre.',
      value: 8400, priority: 'urgente', ageMin: 38, status: 'nuevo',
      preferredYachtId: 'sea-of-cortez-ii',
    },
    {
      id: 'L-2039', source: 'experiencia', channel: 'web', experience: 'snorkel',
      guestName: 'Tomás & Olivia Hartmann', party: 4, country: 'CA · ON',
      requestedDate: day(3, 9, 0), hours: 5,
      note: 'Luna de miel. Quieren Chileno Bay y Santa María. Almuerzo a bordo.',
      value: 9750, priority: 'alta', ageMin: 92, status: 'leído',
      preferredYachtId: 'trimaran-la-paz',
    },
    {
      id: 'L-2038', source: 'abierta', channel: 'whatsapp', experience: 'abierto',
      guestName: 'Kevin O\'Brien', party: 12, country: 'US · IL',
      requestedDate: day(7, 10, 0), hours: 6,
      note: 'Despedida. "Algo grande, fiestero". No menciona presupuesto.',
      value: 13800, priority: 'media', ageMin: 220, status: 'leído',
    },
    {
      id: 'L-2037', source: 'reserva', channel: 'directa', experience: 'privada',
      guestName: 'Grupo Cibrián', party: 14, country: 'MX · NL',
      requestedDate: day(5, 14, 0), hours: 5,
      note: 'Cumpleaños 40. DJ a bordo, contrato firmado pendiente.',
      value: 14000, priority: 'alta', ageMin: 410, status: 'leído',
      preferredYachtId: 'capricho',
    },
    {
      id: 'L-2036', source: 'experiencia', channel: 'web', experience: 'pesca',
      guestName: 'Robert Kowalski', party: 4, country: 'US · TX',
      requestedDate: day(9, 6, 30), backupDate: day(11, 6, 30), hours: 8,
      note: 'Torneo amistoso. Pidió Marlín Azul, pero está bloqueado.',
      value: 11200, priority: 'media', ageMin: 1180, status: 'esperando',
      preferredYachtId: 'marlin-azul',
    },
    {
      id: 'L-2035', source: 'abierta', channel: 'email', experience: 'abierto',
      guestName: 'Priya Venkatesh', party: 2, country: 'US · NY',
      requestedDate: day(14, 12, 0), hours: 4,
      note: '"¿Qué recomiendan para una primera vez en Cabo?" Quiere consejo.',
      value: 0, priority: 'baja', ageMin: 2880, status: 'esperando',
    },
    {
      id: 'L-2034', source: 'experiencia', channel: 'web', experience: 'ballenas',
      guestName: 'Léa & Mathieu Dupuis', party: 5, country: 'FR',
      requestedDate: day(1, 8, 0), hours: 4,
      note: 'Temporada termina pronto, quieren ir mañana o pasado.',
      value: 7800, priority: 'alta', ageMin: 28, status: 'nuevo',
    },
  ];

  const extraLeadsBusy = [
    {
      id: 'L-2045', source: 'experiencia', channel: 'web', experience: 'despedida',
      guestName: 'Mariana Aguirre', party: 11, country: 'MX · JAL',
      requestedDate: day(2, 13, 0), hours: 6,
      note: 'Despedida de soltera. Foto-shoot, prosecco, snorkel.',
      value: 13800, priority: 'alta', ageMin: 9, status: 'nuevo',
    },
    {
      id: 'L-2044', source: 'reserva', channel: 'directa', experience: 'corporativo',
      guestName: 'Helix Capital LLP', party: 16, country: 'US · NY',
      requestedDate: day(1, 11, 0), hours: 7,
      note: 'Off-site ejecutivo. Contrato con NDA, contabilidad pidió factura USD.',
      value: 19600, priority: 'urgente', ageMin: 22, status: 'nuevo',
      preferredYachtId: 'lucero-del-mar',
    },
    {
      id: 'L-2043', source: 'experiencia', channel: 'web', experience: 'atardecer',
      guestName: 'David & Hannah Cole', party: 2, country: 'UK',
      requestedDate: day(0, 17, 30), hours: 3,
      note: 'Luna de miel. Reservan hoy mismo si confirmamos en 1h.',
      value: 6300, priority: 'urgente', ageMin: 12, status: 'nuevo',
    },
    {
      id: 'L-2042', source: 'abierta', channel: 'whatsapp', experience: 'pesca',
      guestName: 'Carlos Romero', party: 4, country: 'MX · BCS',
      requestedDate: day(2, 6, 30), hours: 6,
      note: 'Cliente recurrente. Quiere mismo capitán que en marzo.',
      value: 14400, priority: 'media', ageMin: 240, status: 'leído',
      preferredYachtId: 'made-for-waves',
    },
    {
      id: 'L-2046', source: 'experiencia', channel: 'web', experience: 'snorkel',
      guestName: 'Familia Hartwell', party: 7, country: 'US · WA',
      requestedDate: day(3, 10, 0), hours: 5,
      note: 'Niños pequeños. Necesitan chalecos talla XS.',
      value: 9750, priority: 'media', ageMin: 95, status: 'nuevo',
    },
    {
      id: 'L-2047', source: 'reserva', channel: 'directa', experience: 'privada',
      guestName: 'Boda Vela / Nakamura', party: 32, country: 'US · CA',
      requestedDate: day(4, 16, 0), hours: 6,
      note: 'Recepción de boda. Necesitan dos yates en flotilla.',
      value: 31200, priority: 'urgente', ageMin: 45, status: 'nuevo',
    },
  ];

  const baseLeadsQuiet = [
    {
      id: 'L-2050', source: 'abierta', channel: 'email', experience: 'abierto',
      guestName: 'Julien Marchand', party: 3, country: 'FR',
      requestedDate: day(21, 10, 0), hours: 4,
      note: 'Vacaciones largas. Pregunta cuál fue nuestra mejor experiencia este año.',
      value: 0, priority: 'baja', ageMin: 60, status: 'nuevo',
    },
    {
      id: 'L-2049', source: 'experiencia', channel: 'web', experience: 'atardecer',
      guestName: 'Park & Choi', party: 2, country: 'KR',
      requestedDate: day(10, 17, 0), hours: 3,
      note: 'Aniversario. Pidieron foto con champaña al atardecer.',
      value: 6300, priority: 'media', ageMin: 800, status: 'leído',
    },
  ];

  function leadsFor(scenario) {
    if (scenario === 'busy') return [...extraLeadsBusy, ...baseLeadsTypical];
    if (scenario === 'quiet') return baseLeadsQuiet;
    return baseLeadsTypical;
  }

  // ── Bookings (calendar events) ──────────────────────────
  // { id, yachtId, start, end, type: 'reservation'|'block'|'hold', title, party?, value?, note?, conflict? }
  function bookingsFor(scenario) {
    const B = [];
    const push = (yachtId, dayOffset, h0, dur, opts) =>
      B.push({
        id: 'B-' + B.length.toString().padStart(3, '0'),
        yachtId,
        start: day(dayOffset, h0, 0),
        end: day(dayOffset, h0 + dur, 0),
        type: 'reservation',
        ...opts,
      });

    // Anchor: typical week, 5 own + 3 partner yachts.
    push('made-for-waves', 0, 6, 6, { title: 'Whitfield · Pesca', party: 6, value: 14400, experience: 'pesca' });
    push('sea-of-cortez-ii', 0, 17, 4, { title: 'Reséndiz · Atardecer', party: 8, value: 8400, experience: 'atardecer' });
    push('lucero-del-mar', 0, 10, 5, { title: 'Group Marston · Snorkel', party: 14, value: 11500, experience: 'snorkel' });
    push('pacifica', 0, 14, 4, { title: 'Sotomayor · Velero', party: 6, value: 7200, experience: 'privada' });

    push('made-for-waves', 1, 6, 7, { title: 'Helix Capital · Pesca corp.', party: 8, value: 16800, experience: 'corporativo' });
    push('capricho', 1, 11, 6, { title: 'Boda Tijerina · Brunch', party: 22, value: 16800, experience: 'privada' });
    push('trimaran-la-paz', 1, 8, 5, { title: 'Hartmann · Luna miel', party: 4, value: 9750, experience: 'snorkel' });

    push('sea-of-cortez-ii', 2, 9, 5, { title: 'Aguirre · Despedida', party: 11, value: 10500, experience: 'despedida' });
    push('made-for-waves', 2, 14, 4, { title: 'Romero · Pesca', party: 4, value: 9600, experience: 'pesca' });
    push('lucero-del-mar', 2, 11, 6, { title: 'Cibrián · Cumpleaños', party: 14, value: 13800, experience: 'privada' });
    push('dorado', 2, 6, 6, { title: 'Calhoun · Pesca', party: 4, value: 9600, experience: 'pesca' });

    push('capricho', 3, 12, 6, { title: 'Vela / Nakamura · Boda', party: 32, value: 16800, experience: 'privada' });
    push('pacifica', 3, 9, 5, { title: 'Müller · Snorkel', party: 6, value: 9000, experience: 'snorkel' });
    push('trimaran-la-paz', 3, 14, 4, { title: 'Vasquez · Atardecer', party: 12, value: 7800, experience: 'atardecer' });

    push('made-for-waves', 4, 6, 8, { title: 'O\'Brien · Despedida', party: 12, value: 19200, experience: 'despedida' });
    push('sea-of-cortez-ii', 4, 11, 5, { title: 'Park · Aniversario', party: 2, value: 10500, experience: 'privada' });
    push('dorado', 4, 7, 6, { title: 'Familia Bauer · Pesca', party: 6, value: 9600, experience: 'pesca' });

    push('capricho', 5, 14, 5, { title: 'Cibrián · 40 cumpleaños', party: 14, value: 14000, experience: 'privada' });
    push('lucero-del-mar', 5, 10, 6, { title: 'Yamato Group · Corporativo', party: 16, value: 13800, experience: 'corporativo' });
    push('pacifica', 5, 8, 4, { title: 'Hanford · Snorkel', party: 4, value: 7200, experience: 'snorkel' });

    push('made-for-waves', 6, 7, 7, { title: 'Familia Donato · Pesca', party: 6, value: 16800, experience: 'pesca' });
    push('sea-of-cortez-ii', 6, 16, 4, { title: 'Bartlett · Atardecer', party: 8, value: 8400, experience: 'atardecer' });

    // Blocks
    B.push({
      id: 'BL-001', yachtId: 'marlin-azul',
      start: day(-2, 6, 0), end: day(5, 18, 0),
      type: 'block', blockKind: 'mantenimiento',
      title: 'Mantenimiento · cambio de motor', note: 'Astilleros Cabo · ETA 12 mayo',
    });
    B.push({
      id: 'BL-002', yachtId: 'capricho',
      start: day(8, 6, 0), end: day(9, 18, 0),
      type: 'block', blockKind: 'propietario',
      title: 'Uso del propietario · 9–10 mayo', note: 'Familia Reyes Solana',
    });

    // Holds (tentative)
    B.push({
      id: 'H-001', yachtId: 'lucero-del-mar',
      start: day(2, 11, 0), end: day(2, 16, 0),
      type: 'hold', title: 'Helix Capital · tentativo',
      party: 16, value: 19600, expiresAt: day(0, 18, 0), conflict: true,
    });

    if (scenario === 'busy') {
      // Pile on more bookings — Saturday festival overflow
      push('made-for-waves', 2, 6, 6, { title: 'Calhoun · Pesca · 2do turno', party: 4, value: 14400, experience: 'pesca', conflict: true });
      push('capricho', 0, 16, 5, { title: 'Phillips · Atardecer VIP', party: 18, value: 14000, experience: 'atardecer' });
      push('sea-of-cortez-ii', 1, 7, 5, { title: 'Familia Tanaka · Snorkel', party: 8, value: 10500, experience: 'snorkel' });
      push('trimaran-la-paz', 2, 6, 5, { title: 'Festival flotilla A', party: 16, value: 9750, experience: 'privada' });
      push('lucero-del-mar', 3, 7, 5, { title: 'Festival flotilla B', party: 18, value: 11500, experience: 'privada' });
      push('dorado', 0, 14, 4, { title: 'Gibson · Pesca tarde', party: 4, value: 6400, experience: 'pesca' });
      push('pacifica', 1, 14, 4, { title: 'Schaefer · Velero', party: 4, value: 7200, experience: 'privada' });
      push('capricho', 2, 9, 4, { title: 'Festival VIP · Stage 1', party: 22, value: 11200, experience: 'corporativo' });
      // Buffer warning candidate (back-to-back-ish on Made for Waves day 1)
      push('made-for-waves', 1, 14, 3, { title: 'Hartwell · Snorkel', party: 7, value: 7200, experience: 'snorkel', conflict: true });
    }

    if (scenario === 'quiet') {
      // Strip down: only a few survive
      return B.filter((b) => b.type === 'block' || ['L-2049', 'L-2050'].includes(b.title));
    }

    return B;
  }

  // ── Alerts (derived) ───────────────────────────────────
  function alertsFor(scenario) {
    if (scenario === 'quiet') {
      return [
        { kind: 'info', text: 'Marlín Azul sigue en mantenimiento (regresa 12 mayo).' },
        { kind: 'info', text: 'Bandeja al día. 0 solicitudes pendientes.' },
      ];
    }
    const a = [
      { kind: 'warn', text: 'Lucero del Mar · 2 reservas con superposición el 9 mayo (11:00 vs hold Helix).' },
      { kind: 'warn', text: 'Made for Waves · holgura de 1h entre Whitfield y siguiente reserva (regla: 2h).' },
      { kind: 'info', text: 'Hold de Helix Capital expira hoy 18:00 si no confirma.' },
      { kind: 'info', text: 'Marlín Azul · regresa de mantenimiento 12 mayo.' },
    ];
    if (scenario === 'busy') {
      a.unshift({ kind: 'danger', text: 'Sábado 9 mayo: 4 yates al 100%. Evaluar lista de espera para 3 solicitudes nuevas.' });
    }
    return a;
  }

  // ── Today's bookings ───────────────────────────────────
  function todayBookings(scenario) {
    return bookingsFor(scenario)
      .filter((b) => b.start.getDate() === TODAY.getDate() && b.type === 'reservation')
      .sort((a, b) => a.start - b.start);
  }

  // ── Revenue snapshot (last 30) ─────────────────────────
  function revenue(scenario) {
    const base = scenario === 'busy' ? 412800 : scenario === 'quiet' ? 184500 : 287400;
    const last = scenario === 'busy' ? 318900 : scenario === 'quiet' ? 211200 : 254100;
    return {
      mtdUSD: base,
      lastMtdUSD: last,
      pace: ((base - last) / last) * 100,
      bookings: scenario === 'busy' ? 41 : scenario === 'quiet' ? 18 : 28,
      utilizationPct: scenario === 'busy' ? 78 : scenario === 'quiet' ? 32 : 54,
    };
  }

  // ── Utilization sparkline data (last 30 days, 0..1) ───
  function utilization(yachtId, scenario) {
    // Deterministic pseudo-random based on yachtId + scenario
    let seed = (yachtId + scenario).split('').reduce((s, c) => s * 31 + c.charCodeAt(0), 7);
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const base = scenario === 'busy' ? 0.65 : scenario === 'quiet' ? 0.25 : 0.45;
    const out = [];
    for (let i = 0; i < 30; i++) {
      const v = Math.max(0, Math.min(1, base + (rnd() - 0.4) * 0.6));
      out.push(v);
    }
    return out;
  }

  // ── Format helpers ─────────────────────────────────────
  const usd = (n) =>
    '$' + Math.round(n).toLocaleString('en-US') + ' USD';
  const usdK = (n) => '$' + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k';
  const pct = (n) => Math.round(n) + '%';
  const pad = (n) => n.toString().padStart(2, '0');
  const hhmm = (d) => pad(d.getHours()) + ':' + pad(d.getMinutes());
  const ddmm = (d) => pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
  const monthAbbr = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const dowFull = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const dow = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const longDate = (d) =>
    `${dowFull[d.getDay()]} ${d.getDate()} ${monthAbbr[d.getMonth()]} ${d.getFullYear()}`;
  const ago = (mins) => {
    if (mins < 1) return 'ahora';
    if (mins < 60) return mins + 'm';
    if (mins < 24 * 60) return Math.floor(mins / 60) + 'h';
    return Math.floor(mins / (24 * 60)) + 'd';
  };

  window.YachtData = {
    TODAY, TZ_LABEL,
    yachts, yById,
    EXPERIENCES,
    leadsFor, bookingsFor, alertsFor, todayBookings, revenue, utilization,
    fmt: { usd, usdK, pct, pad, hhmm, ddmm, longDate, ago, dow, dowFull, monthAbbr },
    day,
  };
})();
