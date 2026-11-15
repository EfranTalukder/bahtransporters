// ─────────────────────────────────────────────────────────────────────────────
// Booking page (bahtransporters.com/book, /track) — talks to the BAH Supabase backend.
// Visitors can only read flight dates and prices and track with a reference;
// bookings go through the protected public-booking server function (spam checks,
// rate limits). The sums here are the same as the database's (create_website_booking).
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';
  const B = window.BAH;
  const F = window.BAHForm;
  const startedAt = Date.now();
  const $ = (id) => document.getElementById(id);
  const state = {
    route: null, departure: null, itemType: 'parcel', method: null, step: 1,
    receiverDelivery: false, routes: [], schedule: [], photos: [], submitting: false, guides: null,
  };

  async function rpc(name, body = {}) {
    const res = await F.send(`${B.SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { apikey: B.SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }, 'booking');
    if (!res.ok) throw new Error(`Could not load ${name}`);
    return res.json();
  }
  async function callFunction(name, body) {
    const res = await F.send(`${B.SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST', headers: { apikey: B.SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }, 'booking');
    let data = {};
    try { data = await res.json(); } catch (_) { /* ignore */ }
    if (!res.ok) {
      const err = new Error(data.error || `Something went wrong. Please try again or WhatsApp us on ${B.PHONE}.`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (d, opts = { weekday: 'short', day: 'numeric', month: 'short' }) =>
    d ? new Intl.DateTimeFormat('en-GB', opts).format(new Date(d + 'T12:00:00')) : '—';
  const money = (v, cur = 'GBP') => {
    if (v === null || v === undefined || isNaN(v)) return '—';
    try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v); }
    catch (_) { return `${cur} ${Number(v).toFixed(2)}`; }
  };
  const daysUntil = (d) => d ? Math.round((new Date(d + 'T12:00:00') - new Date(new Date().toDateString() + ' 12:00:00')) / 86400000) : null;
  const isInbound = (route) => !!route && route.destination === 'United Kingdom';
  const fromUK = (route) => !!route && route.origin === 'United Kingdom';
  const routeCountries = () => state.route ? [state.route.origin, state.route.destination].map(F.countryCode).filter((c) => c && c !== 'GB') : ['GM'];
  const shortPlace = (p) => (p === 'United Kingdom' ? 'the UK' : p);

  const svg = (d, w = 22) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONS = {
    plane: svg('<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>'),
    tick: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
    box: svg('<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>'),
    doc: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>'),
    bag: svg('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>'),
    store: svg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>'),
    truck: svg('<rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>'),
    home: svg('<path d="M20 9v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9"/><path d="M9 22V12h6v10"/><path d="M2 10.6 12 2l10 8.6"/>'),
    mail: svg('<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="m22 6-10 7L2 6"/>'),
    clock: svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
  };
  const TYPES = {
    parcel: { t: 'Parcel', s: 'Clothes, shoes, gifts, electronics — priced per kg.', i: ICONS.box, label: 'Parcel' },
    document: { t: 'Documents', s: 'Passports, certificates, papers — one flat price.', i: ICONS.doc, label: 'Documents' },
    shopping: { t: 'We buy it for you', s: 'Send a shop link: item cost + shipping.', i: ICONS.bag, label: 'We buy it for you' },
  };

  // ─────────────────────────────── Tabs ───────────────────────────────
  const tabs = document.querySelectorAll('.tab-btn');
  const HERO = {
    book: { kicker: 'Book online', title: $('heroTitle').innerHTML, sub: $('heroSub').innerHTML, page: document.title },
    flights: { kicker: 'Flight schedule', title: 'Upcoming flights.', sub: 'Every booking is tied to a real flight date. No date up yet? Book anyway — you’re first on the next one.', page: 'Flights UK ⇄ The Gambia — BAH Transporters' },
    track: { kicker: 'Track online', title: 'Where’s my shipment?', sub: 'Live progress from booking to collection, updated by our team as it moves.', page: 'Track your shipment — BAH Transporters' },
  };
  function showTab(name, push = true) {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    ['book', 'flights', 'track'].forEach((n) => { $('panel-' + n).hidden = n !== name; });
    document.querySelectorAll('.nav-link, .mobile-link').forEach((a) => {
      const href = a.getAttribute('href');
      a.classList.toggle('active', (name === 'track' && href === '/track') || (name === 'flights' && href === '/book?tab=flights') || (name === 'book' && href === '/book'));
    });
    const h = HERO[name];
    $('heroKicker').textContent = h.kicker; $('heroTitle').innerHTML = h.title; $('heroSub').innerHTML = h.sub; document.title = h.page;
    if (push) {
      const url = new URL(location.href);
      url.searchParams.delete('tab');
      if (name === 'track') url.pathname = '/track';
      else {
        url.pathname = '/book'; url.searchParams.delete('ref');
        if (name === 'flights') url.searchParams.set('tab', 'flights');
      }
      history.replaceState(null, '', url);
    }
  }
  tabs.forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));
  // Arrow keys move between the tabs.
  document.querySelector('[role=tablist]').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const list = [...tabs];
    const i = list.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    const next = list[(i + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
    showTab(next.dataset.tab); next.focus();
  });

  // ─────────────────────────────── Data ───────────────────────────────
  async function loadData() {
    rpc('get_booking_guidelines').then((g) => { if (g && Array.isArray(g.air) && g.air.length) { state.guides = g.air; renderGuides(); } }).catch(() => {});
    try {
      const [routes, schedule] = await Promise.all([rpc('get_public_rates'), rpc('get_public_schedule')]);
      state.routes = (routes || []).filter((r) => r.mode === 'air');
      state.schedule = (schedule || []).filter((s) => s.mode === 'air');
    } catch (e) {
      state.routes = []; state.schedule = [];
      $('routePills').innerHTML = `<p class="sm:col-span-2 rounded-2xl bg-sand p-4 text-[0.95rem] text-ink-soft">We couldn’t load the routes right now. Please refresh the page, or <a class="link" href="${F.waLink('Hi BAH Transporters, I would like to book a shipment.')}" target="_blank" rel="noopener">book on WhatsApp</a>.</p>`;
      $('depGrid').innerHTML = `<div class="md:col-span-2 rounded-3xl bg-sand p-8 text-center"><p class="font-bold">We couldn’t load the flights right now.</p><p class="mt-1 text-sm text-ink-soft">Please refresh, or WhatsApp us on ${B.PHONE}.</p></div>`;
      $('ratesBody').innerHTML = '<tr><td colspan="4" class="py-4 text-ink-faint">Prices unavailable right now.</td></tr>';
      return;
    }
    renderRoutes();
    renderDepartures();
    renderRates();
  }

  function depStatus(s) {
    const d = daysUntil(s.cut_off);
    if (s.status === 'closed') return '<span class="chip muted">Fully booked</span>';
    if (d !== null && d < 0) return '<span class="chip muted">Booking closed</span>';
    if (d !== null && d <= 2) return `<span class="chip warn">Closing ${d === 0 ? 'today' : d === 1 ? 'tomorrow' : 'soon'}</span>`;
    return '<span class="chip">Taking bookings</span>';
  }
  const canBook = (s) => s.status === 'open' && !(daysUntil(s.cut_off) !== null && daysUntil(s.cut_off) < 0);

  // ───────────────────────────── Flights tab ─────────────────────────────
  let depFilter = 'all';
  function renderDepartures() {
    const list = state.schedule.filter((s) => depFilter === 'all' || s.route_code === depFilter);
    const routesShown = state.routes.filter((r) => depFilter === 'all' || r.code === depFilter);
    // Routes with no date listed get a "next available flight" card, so nobody hits a dead end.
    const noDate = routesShown.filter((r) => !list.some((s) => s.route_code === r.code && canBook(s)));
    const cards = list.map((s) => `
      <article class="flex flex-col gap-5 rounded-3xl border border-ink-line bg-white p-6">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="flex h-11 w-11 items-center justify-center rounded-xl ${s.origin === 'United Kingdom' ? 'bg-ember-light text-ember-dark' : 'bg-sky-light text-sky-dark'}">${ICONS.plane}</span>
            <div><p class="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-ink-faint">Air freight</p><h3 class="text-[1.15rem]">${esc(s.route_label || 'Route to be confirmed')}</h3></div>
          </div>
          ${depStatus(s)}
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-2xl bg-sand px-4 py-3"><p class="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-ink-faint">Flies</p><p class="mt-0.5 font-display font-bold">${fmtDate(s.departure_date)}</p></div>
          <div class="rounded-2xl bg-sand px-4 py-3"><p class="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-ink-faint">Book by</p><p class="mt-0.5 font-display font-bold">${fmtDate(s.cut_off)}</p></div>
        </div>
        ${s.expected_arrival ? `<p class="-mt-2 text-sm text-ink-soft">Expected to arrive around <strong class="text-ink">${fmtDate(s.expected_arrival)}</strong></p>` : ''}
        ${s.public_note ? `<p class="-mt-2 text-sm text-ink-soft">${esc(s.public_note)}</p>` : ''}
        <div class="mt-auto flex items-end justify-between gap-3">
          <p class="font-display text-xl font-bold">${s.rate_per_kg ? money(s.rate_per_kg, s.currency) + '<span class="text-sm font-semibold text-ink-soft"> / kg</span>' : ''}</p>
          ${canBook(s) ? `<button type="button" class="btn-primary btn-sm" data-go-book="${s.id}">Book this flight</button>` : ''}
        </div>
      </article>`);
    for (const r of noDate) {
      cards.push(`
      <article class="flex flex-col gap-4 rounded-3xl border-2 border-dashed border-ink-line bg-sand/40 p-6">
        <div class="flex items-center gap-3">
          <span class="flex h-11 w-11 items-center justify-center rounded-xl ${r.origin === 'United Kingdom' ? 'bg-ember-light text-ember-dark' : 'bg-sky-light text-sky-dark'}">${ICONS.plane}</span>
          <div><p class="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-ink-faint">Next available flight</p><h3 class="text-[1.15rem]">${esc(r.label)}</h3></div>
        </div>
        <p class="text-[0.95rem] text-ink-soft">Book now and we’ll put you on the next flight to ${esc(shortPlace(r.destination))}, then confirm the date with you on WhatsApp.</p>
        <div class="mt-auto flex items-end justify-between gap-3">
          <p class="font-display text-xl font-bold">${r.rate ? money(r.rate, r.currency) + '<span class="text-sm font-semibold text-ink-soft"> / kg</span>' : ''}</p>
          <button type="button" class="btn-dark btn-sm" data-go-route="${r.code}">Book now</button>
        </div>
      </article>`);
    }
    $('depGrid').innerHTML = cards.join('') || '<p class="text-ink-soft">No routes to show.</p>';
    document.querySelectorAll('[data-go-book]').forEach((b) => b.addEventListener('click', () => {
      const dep = state.schedule.find((s) => s.id === b.dataset.goBook);
      if (dep) preselect(dep.route_code, dep.id);
      goToForm();
    }));
    document.querySelectorAll('[data-go-route]').forEach((b) => b.addEventListener('click', () => { preselect(b.dataset.goRoute, null); goToForm(); }));
  }
  document.querySelectorAll('[data-filter]').forEach((p) => p.addEventListener('click', () => {
    depFilter = p.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-checked', String(x === p)));
    renderDepartures();
  }));
  function goToForm() {
    showTab('book');
    window.scrollTo({ top: $('bookCard').getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
  }

  function renderRates() {
    if (!state.routes.length) { $('ratesBody').innerHTML = '<tr><td colspan="4" class="py-4 text-ink-faint">Prices unavailable right now.</td></tr>'; return; }
    $('ratesBody').innerHTML = state.routes.map((r) => `
      <tr class="border-b border-ink-line/70 last:border-0">
        <td class="py-3.5 font-semibold">${esc(r.label)}</td>
        <td class="py-3.5">${r.rate ? money(r.rate, r.currency) + ' / kg' : 'On request'}</td>
        <td class="py-3.5">${r.document_fee ? money(r.document_fee, r.currency) + ' flat' : '—'}</td>
        <td class="py-3.5">${r.min_charge ? money(r.min_charge, r.currency) + ' (1 kg)' : '—'}${Number(r.delivery_fee) > 0 ? `<span class="block text-xs text-ink-faint">Delivery to the door ${money(r.delivery_fee, r.currency)}</span>` : ''}</td>
      </tr>`).join('');
  }

  // ─────────────────────────────── Step 1 ───────────────────────────────
  function renderRoutes() {
    $('routePills').innerHTML = state.routes.map((r) => `
      <button type="button" class="choice" role="radio" aria-checked="${state.route?.code === r.code}" data-route="${r.code}">
        <span class="ico">${ICONS.plane}</span>
        <span class="pr-6">
          <span class="title block">${esc(r.label)}</span>
          <span class="sub block">${fromUK(r) ? 'Drop off in Birmingham, collect in Tallinding' : 'Drop off in Tallinding, collect in Birmingham'}</span>
          ${r.rate ? `<span class="meta"><span class="font-bold text-ink">${money(r.rate, r.currency)}/kg</span>${r.document_fee ? `<span>Documents ${money(r.document_fee, r.currency)}</span>` : ''}</span>` : ''}
        </span>
        <span class="tick">${ICONS.tick}</span>
      </button>`).join('') || '<p class="text-sm text-ink-faint">No routes open for booking right now — please WhatsApp us.</p>';
    document.querySelectorAll('[data-route]').forEach((b) => b.addEventListener('click', () => chooseRoute(b.dataset.route)));
    renderDepOptions();
  }

  function chooseRoute(code) {
    if (state.route?.code !== code) state.receiverDelivery = false;
    state.route = state.routes.find((r) => r.code === code) || null;
    if (state.departure && state.departure.route_code !== code) state.departure = null;
    document.querySelectorAll('[data-route]').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.route === code)));
    $('routeError').classList.add('hidden');
    $('routeHint').textContent = state.route?.rate_note && !state.route.rate ? state.route.rate_note + '.' : '';
    renderDepOptions();
    renderMethods();
    applyDirectionText();
    updateSummary();
  }

  function renderDepOptions() {
    if (!state.route) { $('depOptions').innerHTML = '<p class="rounded-2xl bg-sand px-4 py-3 text-[0.92rem] text-ink-soft">Choose a direction to see the flights.</p>'; return; }
    const deps = state.schedule.filter((s) => s.route_code === state.route.code && canBook(s));
    const to = shortPlace(state.route.destination);
    const opts = deps.map((s) => `
      <button type="button" class="choice" role="radio" aria-checked="${state.departure?.id === s.id}" data-dep="${s.id}">
        <span class="ico">${ICONS.plane}</span>
        <span class="pr-6">
          <span class="title block">Flies ${fmtDate(s.departure_date, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <span class="meta"><span>Book by ${fmtDate(s.cut_off)}</span>${s.rate_per_kg ? `<span>${money(s.rate_per_kg, s.currency)}/kg</span>` : ''}${depStatus(s)}</span>
        </span>
        <span class="tick">${ICONS.tick}</span>
      </button>`);
    // No dates listed: say what happens (they're put on the next flight), not what's missing.
    opts.push(`
      <button type="button" class="choice" role="radio" aria-checked="${!state.departure}" data-dep="">
        <span class="ico">${deps.length ? ICONS.clock : ICONS.plane}</span>
        <span class="pr-6"><span class="title block">${deps.length ? 'Not sure yet' : 'Next available flight'}</span>
        <span class="sub block">${deps.length ? 'We’ll put you on the best flight for you.' : `Book now and we’ll put you on the next flight to ${esc(to)}, then confirm the date with you on WhatsApp.`}</span></span>
        <span class="tick">${ICONS.tick}</span>
      </button>`);
    $('depOptions').innerHTML = opts.join('');
    document.querySelectorAll('[data-dep]').forEach((b) => b.addEventListener('click', () => {
      state.departure = state.schedule.find((s) => s.id === b.dataset.dep) || null;
      document.querySelectorAll('[data-dep]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      updateSummary();
    }));
  }

  // ─────────────────────────────── Step 2 ───────────────────────────────
  function renderTypes() {
    $('typeOptions').innerHTML = Object.entries(TYPES).map(([v, c]) => `
      <button type="button" class="choice !flex-col !gap-3" role="radio" aria-checked="${state.itemType === v}" data-type="${v}">
        <span class="ico">${c.i}</span>
        <span class="pr-4"><span class="title block">${c.t}</span><span class="sub block">${c.s}</span></span>
        <span class="tick">${ICONS.tick}</span>
      </button>`).join('');
    document.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => chooseType(b.dataset.type)));
  }
  function chooseType(type) {
    state.itemType = TYPES[type] ? type : 'parcel';
    document.querySelectorAll('[data-type]').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.type === state.itemType)));
    $('kgField').classList.toggle('hidden', state.itemType === 'document');
    $('description').placeholder = state.itemType === 'document' ? 'e.g. 1 envelope: birth certificate and school reports'
      : state.itemType === 'shopping' ? 'Paste the shop link(s) and tell us the size, colour and how many'
      : 'e.g. 2 boxes of clothes and shoes, 1 laptop';
    $('descriptionLabel').innerHTML = (state.itemType === 'shopping' ? 'What should we buy?' : state.itemType === 'document' ? 'Which documents?' : 'What’s inside') + ' <span class="req">*</span>';
    if (state.itemType === 'document') F.setError('estKg', '');
    updateSummary();
  }

  const deliveryFee = () => (state.route && Number(state.route.delivery_fee) > 0 ? Number(state.route.delivery_fee) : null);
  const feeText = () => money(deliveryFee(), state.route.currency);
  // Delivery to the door: "post or deliver to me" into the UK, or "deliver to the receiver" out of the UK.
  const wantsDelivery = () => (isInbound(state.route) ? state.method === 'delivery' : state.receiverDelivery);

  function methodChoices() {
    if (isInbound(state.route)) {
      return [
        { v: 'collection', t: 'I’ll collect it in Birmingham', s: 'From 77 Melbourne Avenue when it lands. No extra cost.', i: ICONS.store },
        { v: 'delivery', t: 'Post or deliver it to me', s: deliveryFee() ? `To your UK address — ${feeText()} extra.` : 'To your UK address. We confirm the cost with you first.', i: ICONS.home },
      ];
    }
    if (!fromUK(state.route)) {
      return [
        { v: 'dropoff', t: 'I’ll drop it off', s: 'At our office — we’ll send you the address.', i: ICONS.store },
        { v: 'collection', t: 'Collect it from me', s: 'We confirm the cost with you first.', i: ICONS.truck },
      ];
    }
    return [
      { v: 'dropoff', t: 'I’ll drop it off', s: '77 Melbourne Avenue, Newtown, Birmingham B19 2HU.', i: ICONS.store },
      { v: 'collection', t: 'Collect it from me', s: 'Anywhere in the UK. We confirm the cost first.', i: ICONS.truck },
      { v: 'postal', t: 'I’ll post it to you', s: 'Send it to our Birmingham office by post or courier.', i: ICONS.mail },
    ];
  }

  function renderMethods() {
    const choices = methodChoices();
    if (state.method && !choices.some((c) => c.v === state.method)) state.method = null;
    $('methodLabel').textContent = isInbound(state.route) ? 'When it lands in the UK' : 'How does it get to us?';
    $('methodOptions').className = `grid gap-3 ${choices.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`;
    $('methodOptions').innerHTML = choices.map((c) => `
      <button type="button" class="choice !flex-col !gap-3" role="radio" aria-checked="${state.method === c.v}" data-method="${c.v}">
        <span class="ico">${c.i}</span>
        <span class="pr-4"><span class="title block">${c.t}</span><span class="sub block">${c.s}</span></span>
        <span class="tick">${ICONS.tick}</span>
      </button>`).join('');
    document.querySelectorAll('[data-method]').forEach((b) => b.addEventListener('click', () => {
      state.method = b.dataset.method;
      document.querySelectorAll('[data-method]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      $('methodError').classList.add('hidden');
      applyAddressRequirement();
      updateSummary();
    }));
    renderReceiver();
    applyAddressRequirement();
  }

  // Out of the UK: the receiver collects (free) or we deliver to them (cost confirmed, or the route's fee).
  function renderReceiver() {
    const show = !!state.route && !isInbound(state.route);
    $('receiverBlock').classList.toggle('hidden', !show);
    if (!show) { state.receiverDelivery = false; $('receiverOptions').innerHTML = ''; return; }
    const where = shortPlace(state.route.destination);
    const choices = [
      { v: false, t: 'Receiver collects it', s: fromUK(state.route) ? 'From Nusrat Junction, Tallinding. No extra cost.' : `From our office in ${where}. No extra cost.`, i: ICONS.store },
      { v: true, t: 'Deliver to the receiver', s: deliveryFee() ? `To their address in ${where} — ${feeText()} extra.` : `To their address in ${where}. We confirm the cost first.`, i: ICONS.home },
    ];
    $('receiverOptions').innerHTML = choices.map((c) => `
      <button type="button" class="choice !flex-col !gap-3" role="radio" aria-checked="${state.receiverDelivery === c.v}" data-receiver="${c.v}">
        <span class="ico">${c.i}</span>
        <span class="pr-4"><span class="title block">${c.t}</span><span class="sub block">${c.s}</span></span>
        <span class="tick">${ICONS.tick}</span>
      </button>`).join('');
    document.querySelectorAll('[data-receiver]').forEach((b) => b.addEventListener('click', () => {
      state.receiverDelivery = b.dataset.receiver === 'true';
      document.querySelectorAll('[data-receiver]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      updateSummary();
    }));
  }

  // A collection from them, or a delivery to their UK address, needs the address.
  const needsAddress = () => (state.method === 'collection' && !isInbound(state.route)) || state.method === 'delivery';
  const ukAddress = () => fromUK(state.route) || isInbound(state.route);
  function applyAddressRequirement() {
    const req = needsAddress();
    $('addressOpt').classList.toggle('hidden', req); $('addressReq').classList.toggle('hidden', !req);
    $('postcodeOpt').classList.toggle('hidden', req && ukAddress());
    $('postcodeReq').classList.toggle('hidden', !(req && ukAddress()));
    $('prefDateLabel').innerHTML = (state.method === 'collection' && !isInbound(state.route) ? 'Preferred collection date' : 'Preferred date') + ' <span class="opt">(optional)</span>';
  }

  function applyDirectionText() {
    const inbound = isInbound(state.route);
    $('youTitle').textContent = inbound ? 'Your details (receiving in the UK)' : 'Your details';
    $('otherTitle').textContent = inbound ? 'Who’s sending it?' : 'Who’s receiving it?';
    $('otherSub').textContent = inbound ? 'So our team in The Gambia can take it from them.' : 'So our team in The Gambia can hand it over.';
    $('step4label').textContent = inbound ? 'Sender' : 'Receiver';
    $('receiverNameLabel').innerHTML = (inbound ? 'Sender’s name' : 'Receiver’s name') + ' <span class="req">*</span>';
    $('receiverPhoneLabel').innerHTML = (inbound ? 'Sender’s phone' : 'Receiver’s phone') + ' <span class="req">*</span>';
    $('receiverCityLabel').innerHTML = (inbound ? 'Sender’s town' : 'Receiver’s town') + ' <span class="opt">(optional)</span>';
    $('receiverCity').placeholder = state.route ? `e.g. a town in ${shortPlace(inbound ? state.route.origin : state.route.destination)}` : 'Town';
    applyAddressRequirement();
  }

  $('estKg').addEventListener('input', () => { F.setError('estKg', ''); updateSummary(); });

  function currentRate() {
    if (state.departure && state.departure.rate_per_kg) return { rate: Number(state.departure.rate_per_kg), currency: state.departure.currency };
    if (state.route && state.route.rate) return { rate: Number(state.route.rate), currency: state.route.currency };
    return null;
  }
  // Same sum as the database (create_website_booking): documents = the flat price; parcels and
  // shopping = kilos × rate, at least the minimum charge; plus delivery when the route has a fee.
  function estimate() {
    if (!state.route) return null;
    const fee = wantsDelivery() ? deliveryFee() : null;
    const cur = state.departure?.currency || state.route.currency;
    if (state.itemType === 'document' && state.route.document_fee) {
      return { value: Number(state.route.document_fee) + (fee || 0), currency: cur, flat: true, fee };
    }
    const kg = parseFloat($('estKg').value);
    const r = currentRate();
    if (!r || !(kg > 0)) return null;
    const raw = Math.round(kg * r.rate * 100) / 100;
    const min = Number(state.route.min_charge) || 0;
    return { value: Math.max(raw, min) + (fee || 0), currency: r.currency, kg, rate: r.rate, fee, min: raw < min ? min : null };
  }

  function updateSummary() {
    $('sumRoute').textContent = state.route ? state.route.label : '—';
    $('sumDep').textContent = state.departure ? fmtDate(state.departure.departure_date) : 'Next available';
    $('sumType').textContent = TYPES[state.itemType].label;
    const kg = parseFloat($('estKg').value);
    $('sumKg').textContent = state.itemType === 'document' ? 'Not needed' : kg > 0 ? `${kg} kg` : '—';
    const m = methodChoices().find((c) => c.v === state.method);
    $('sumMethod').textContent = m ? m.t + (!isInbound(state.route) && wantsDelivery() ? ' · delivered' : '') : '—';
    const est = estimate();
    const r = currentRate();
    const feeNote = wantsDelivery() && deliveryFee() ? ` + ${feeText()} delivery` : wantsDelivery() ? ' Delivery cost confirmed with you.' : '';
    const sum = $('sumEstimate');
    if (est && est.flat) {
      sum.textContent = money(est.value, est.currency);
      $('sumEstimateNote').textContent = 'Documents — one flat price.' + feeNote;
    } else if (est) {
      sum.textContent = money(est.value, est.currency);
      $('sumEstimateNote').textContent = (est.min ? `Under 1 kg is charged as 1 kg.` : `${est.kg} kg × ${money(est.rate, est.currency)}/kg.`)
        + (state.itemType === 'shopping' ? ' Plus the item cost.' : '') + feeNote + ' Final price after weighing.';
    } else if (r) {
      sum.textContent = `${money(r.rate, r.currency)} / kg`;
      $('sumEstimateNote').textContent = 'Add an approximate weight to see your price.' + feeNote;
    } else {
      sum.textContent = state.route ? 'Priced by our team' : 'Choose a route';
      $('sumEstimateNote').textContent = state.route ? 'We’ll confirm the price on WhatsApp.' : 'Final price is confirmed after weighing.';
    }
    $('estimateStrip').classList.toggle('hidden', !est);
    $('estimateStrip').classList.toggle('flex', !!est);
    if (est) $('estimateStripValue').textContent = money(est.value, est.currency);
  }

  // Photos: shrink big phone photos before upload (max 1600 px, JPEG).
  async function shrink(file) {
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
      canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
      if (blob) return blob;
    } catch (_) { /* fall through */ }
    return file.size <= 6 * 1024 * 1024 ? file : null;
  }
  $('photoInput').addEventListener('change', async (e) => {
    for (const f of Array.from(e.target.files || [])) {
      if (state.photos.length >= 3) break;
      if (!f.type.startsWith('image/')) continue;
      const blob = await shrink(f);
      if (blob) state.photos.push({ blob, url: URL.createObjectURL(blob) });
    }
    e.target.value = '';
    renderThumbs();
  });
  function renderThumbs() {
    $('thumbs').innerHTML = state.photos.map((p, i) => `<div class="thumb"><img src="${p.url}" alt="Photo ${i + 1}"><button type="button" aria-label="Remove photo ${i + 1}" data-rm="${i}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>`).join('');
    document.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.rm); URL.revokeObjectURL(state.photos[i].url); state.photos.splice(i, 1); renderThumbs();
    }));
  }

  // ───────────────────────────── Navigation ─────────────────────────────
  // The booking rules come from the admin app (Settings → Invoices); this copy is used only if they can't load.
  const GUIDES_FALLBACK = [
    'Pack securely, especially anything fragile — we may repack to airline rules.',
    'Describe the contents and their value honestly for customs.',
    'Double-check the receiver’s name and phone number.',
    'Parcels are £11.99 per kg with a 1 kg minimum; documents are £15 flat. The final price is confirmed when we weigh it.',
    'You pay after weigh-in, by bank transfer or cash, before delivery or collection.',
    'No perishable food, seeds or plants, flammable liquids or perfumes, narcotics, or firearms and accessories.',
    'Shipments are not insured. If an airline loses or damages items, we refund once the airline compensates us.',
    'Airlines sometimes change schedules — if your flight date moves, we message you on WhatsApp straight away.',
  ];
  function renderGuides() {
    const list = state.guides && state.guides.length ? state.guides : GUIDES_FALLBACK;
    $('guidesList').innerHTML = list.map((g) => `<li>${esc(g)}</li>`).join('');
  }

  function setStep(n) {
    state.step = n;
    document.querySelectorAll('.step-panel').forEach((p) => { p.hidden = Number(p.dataset.step) !== n; });
    document.querySelectorAll('[data-step-dot]').forEach((d) => {
      const k = Number(d.dataset.stepDot);
      d.classList.toggle('current', k === n); d.classList.toggle('done', k < n);
      d.querySelector('.n').innerHTML = k < n ? ICONS.tick : String(k);
    });
    $('backBtn').classList.toggle('hidden', n === 1);
    $('nextText').textContent = n === 4 ? 'Send booking' : 'Continue';
    hideAlert();
    if (n === 2) renderMethods();
    if (n === 4) renderGuides();
    const top = $('bookCard').getBoundingClientRect().top + window.scrollY - 100;
    if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
  }

  // An alert can carry a WhatsApp button, so nobody is left stuck when something goes wrong.
  function showAlert(msg, waText) {
    $('formAlertText').textContent = msg;
    if (waText) {
      const a = document.createElement('a');
      a.href = F.waLink(waText); a.target = '_blank'; a.rel = 'noopener';
      a.className = 'mt-2 block font-bold underline'; a.textContent = 'Send my booking on WhatsApp instead →';
      $('formAlertText').appendChild(a);
    }
    $('formAlert').classList.add('show');
  }
  function hideAlert() { $('formAlert').classList.remove('show'); }
  const { checks, setError } = F;
  const val = (id) => $(id).value.trim();
  const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

  // The checks for one step; each problem gets its own message under its box.
  function stepErrors(step) {
    const inbound = isInbound(state.route);
    const e = {};
    if (step === 2) {
      e.description = val('description').length < 2
        ? (state.itemType === 'shopping' ? 'Please tell us what to buy — a shop link and the size or colour.' : state.itemType === 'document' ? 'Please tell us which documents, e.g. 1 birth certificate.' : 'Please tell us what you’re sending, e.g. 2 boxes of clothes.') : '';
      e.itemCount = $('itemCount').validity.badInput || (val('itemCount') && !(/^\d+$/.test(val('itemCount')) && +val('itemCount') >= 1 && +val('itemCount') <= 500))
        ? 'Please enter how many items as a whole number, e.g. 3.' : '';
      if (state.itemType !== 'document') {
        const kg = parseFloat(val('estKg'));
        e.estKg = $('estKg').validity.badInput || (val('estKg') && !(kg > 0 && kg <= 5000)) ? 'Please enter the weight in kilos as a number, e.g. 12 or 12.5.' : '';
      } else e.estKg = '';
      const d = $('prefDate').value;
      e.prefDate = $('prefDate').validity.badInput ? 'Please pick a date from the calendar.'
        : d && d < today() ? 'Please pick today or a later date.'
        : d && d > new Date(Date.now() + 366 * 864e5).toISOString().slice(0, 10) ? 'Please pick a date within the next year.' : '';
    }
    if (step === 3) {
      e.contactName = checks.name(val('contactName'));
      e.phone = checks.phone(val('phone'), { hints: routeCountries() });
      e.city = checks.town(val('city'));
      e.email = checks.email(val('email'));
      const need = needsAddress();
      e.address = checks.address(val('address'), { required: need });
      e.postcode = ukAddress() ? checks.ukPostcode(val('postcode'), { required: need }) : '';
      e.customerNo = val('customerNo') && !/^\d{1,6}$/.test(val('customerNo').replace(/\s/g, ''))
        ? 'Your customer number is just digits, e.g. 1024. Leave it empty if you don’t have one.' : '';
    }
    if (step === 4) {
      const who = inbound ? 'the sender’s' : 'the receiver’s';
      e.receiverName = checks.name(val('receiverName'), { what: `${who} full name` });
      e.receiverPhone = checks.phone(val('receiverPhone'), { hints: routeCountries(), what: `${who} phone number` });
      e.receiverCity = checks.town(val('receiverCity'), { required: false, what: `${who} town` });
    }
    return e;
  }

  function validate(step) {
    let ok = true;
    if (step === 1 && !state.route) { $('routeError').classList.remove('hidden'); ok = false; }
    for (const [id, msg] of Object.entries(stepErrors(step))) ok = setError(id, msg) && ok;
    if (step === 2 && !state.method) { $('methodError').classList.remove('hidden'); ok = false; }
    if (step === 4 && !$('consent').checked) { $('consentError').classList.remove('hidden'); ok = false; }
    if (!ok) {
      const firstBad = document.querySelector(`.step-panel[data-step="${step}"] .error, .step-panel[data-step="${step}"] .field-error-block:not(.hidden)`);
      firstBad?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (firstBad && firstBad.focus) firstBad.focus({ preventScroll: true });
    }
    return ok;
  }

  // Typing clears that box's message; leaving a box that was wrong checks it again.
  const FIELDS = { description: 2, itemCount: 2, estKg: 2, prefDate: 2, contactName: 3, phone: 3, city: 3, email: 3, address: 3,
    postcode: 3, customerNo: 3, receiverName: 4, receiverPhone: 4, receiverCity: 4 };
  Object.entries(FIELDS).forEach(([id, step]) => {
    $(id).addEventListener('input', () => setError(id, ''));
    $(id).addEventListener('blur', () => F.afterPress(() => {
      if (id === 'postcode' && ukAddress()) $(id).value = F.formatPostcode($(id).value);
      if (state.step === step && ($(id).value.trim() || $(id).getAttribute('aria-invalid') === 'true')) setError(id, stepErrors(step)[id] || '');
    }));
  });
  $('consent').addEventListener('change', () => $('consentError').classList.add('hidden'));

  // A problem the server found goes back to the box it belongs to.
  const SERVER_FIELDS = [
    [/(receiver|sender).{0,4}s (mobile|phone|number)/i, 4, 'receiverPhone'], [/(receiver|sender).{0,4}s name/i, 4, 'receiverName'],
    [/name/i, 3, 'contactName'], [/phone/i, 3, 'phone'], [/weight|kilo/i, 2, 'estKg'], [/what you are sending/i, 2, null],
    [/guidelines/i, 4, 'consent'], [/route|air freight|departure/i, 1, null],
  ];
  function showServerError(err, payload) {
    const hit = !err.network && err.status === 400 && SERVER_FIELDS.find(([re]) => re.test(err.message));
    if (hit) {
      const [, step, id] = hit;
      if (state.step !== step) setStep(step);
      if (id === 'consent') $('consentError').classList.remove('hidden');
      else if (id) { setError(id, err.message); $(id).focus(); }
      else showAlert(err.message);
      return;
    }
    showAlert(err.message, err.status === 429 ? null : bookingSummary(payload));
    $('formAlert').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function bookingSummary(p) {
    return [
      'Hello BAH Transporters, I tried to book on the website but it didn’t go through:',
      `${TYPES[p.item_type]?.label || 'Parcel'} · ${state.route?.label ?? ''}${state.departure ? ` · flight ${fmtDate(state.departure.departure_date)}` : ''}`,
      `Items: ${p.description}${p.est_kg ? ` · about ${p.est_kg} kg` : ''}`,
      `Name: ${p.contact_name} · Phone: ${p.phone} · ${p.city}`,
      p.receiver_name ? `${isInbound(state.route) ? 'Sender' : 'Receiver'}: ${p.receiver_name}${p.receiver_phone ? ` (${p.receiver_phone})` : ''}` : '',
    ].filter(Boolean).join('\n');
  }

  $('backBtn').addEventListener('click', () => setStep(Math.max(1, state.step - 1)));
  $('nextBtn').addEventListener('click', () => {
    if (state.submitting) return;
    if (!validate(state.step)) return;
    if (state.step < 4) setStep(state.step + 1);
    else submitBooking();
  });
  // Enter in a one-line box moves on, like pressing Continue.
  $('bookForm').addEventListener('submit', (e) => { e.preventDefault(); $('nextBtn').click(); });

  // ─────────────────────────────── Submit ───────────────────────────────
  async function submitBooking() {
    state.submitting = true;
    hideAlert();
    const btn = $('nextBtn');
    btn.disabled = true; btn.classList.add('is-loading'); $('nextText').textContent = 'Sending…';
    const payload = {
      mode: 'air',
      item_type: state.itemType,
      route_code: state.route.code,
      shipment_id: state.departure ? state.departure.id : null,
      contact_name: val('contactName'),
      phone: F.toIntl($('phone').value),
      email: val('email'),
      city: val('city'),
      address: val('address'),
      postcode: ukAddress() ? F.formatPostcode($('postcode').value) : val('postcode'),
      customer_no: $('customerNo').value.replace(/\s/g, ''),
      receiver_name: val('receiverName'),
      receiver_phone: F.toIntl($('receiverPhone').value),
      receiver_city: val('receiverCity'),
      description: val('description'),
      item_count: val('itemCount'),
      est_kg: state.itemType === 'document' ? '' : val('estKg'),
      collection_mode: state.method,
      delivery_requested: wantsDelivery(),
      preferred_date: $('prefDate').value,
      notes: val('notes'),
      consent: $('consent').checked,
      website: $('website').value,
      started_at: startedAt,
      fill_ms: Date.now() - startedAt,   // timed on this device, so a wrong clock can't make it look like spam
      photos: state.photos.map((p) => ({ type: p.blob.type || 'image/jpeg' })),
    };
    try {
      const res = await callFunction('public-booking', payload);
      let uploaded = 0;
      for (let i = 0; i < (res.uploads || []).length && i < state.photos.length; i++) {
        try {
          const up = await fetch(res.uploads[i].signedUrl, { method: 'PUT', headers: { 'Content-Type': state.photos[i].blob.type || 'image/jpeg' }, body: state.photos[i].blob });
          if (up.ok) uploaded++;
        } catch (_) { /* keep going */ }
      }
      showSuccess(res, payload, uploaded);
    } catch (err) {
      showServerError(err, payload);
    } finally {
      state.submitting = false;
      btn.disabled = false; btn.classList.remove('is-loading'); $('nextText').textContent = 'Send booking';
    }
  }

  function showSuccess(res, p, uploaded) {
    $('bookForm').classList.add('hidden');
    $('successWrap').classList.remove('hidden');
    $('successRef').textContent = res.ref;
    $('successName').textContent = p.contact_name ? ', ' + p.contact_name.split(' ')[0] : '';
    if (res.estimate) {
      $('successEstimate').textContent = `Estimated price: ${money(res.estimate, res.currency)} — final price confirmed when we weigh it.`;
      $('successEstimate').classList.remove('hidden');
    }
    if (state.photos.length) {
      $('photoNote').textContent = uploaded === state.photos.length ? `${uploaded} photo${uploaded > 1 ? 's' : ''} sent with your booking.` : 'Some photos didn’t upload — you can send them to us on WhatsApp.';
      $('photoNote').classList.remove('hidden');
    }
    // The team confirms on WhatsApp; showing the number lets the customer spot a typo.
    $('successPhone').innerHTML = p.phone ? ` on <b>${esc(p.phone)}</b>` : '';
    $('wrongNumber').href = F.waLink(`Hi BAH Transporters, my booking ${res.ref} has the wrong phone number. The right number is: `);
    $('successStep2').textContent = p.collection_mode === 'collection' && !isInbound(state.route)
      ? 'We arrange a collection day with you, then weigh everything and confirm the price.'
      : p.collection_mode === 'delivery' ? 'When it lands in the UK we post or deliver it to your address.'
      : p.collection_mode === 'collection' ? 'When it lands we let you know it’s ready to collect in Birmingham.'
      : p.collection_mode === 'postal' ? 'Post it to 77 Melbourne Avenue, Newtown, Birmingham B19 2HU — write your reference on the parcel.'
      : fromUK(state.route) ? 'Bring it to 77 Melbourne Avenue, Newtown, Birmingham B19 2HU — we weigh it and confirm the price.'
      : 'Bring it to our office — we weigh it and confirm the price.';
    if (p.delivery_requested && !isInbound(state.route)) $('successStep2').textContent += ' When it lands we deliver it to the receiver.';
    $('trackRef').value = res.ref;
    knownPhones[res.ref] = p.phone;   // so "Track this booking" shows the total and balance straight away
    try { localStorage.setItem('bah_last_booking', JSON.stringify({ ref: res.ref, phone: p.phone })); } catch (_) { /* private mode */ }
    devicePhone = p.phone;
    window.scrollTo({ top: $('bookCard').getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
  }

  $('copyRef').addEventListener('click', async () => {
    const label = $('copyRef').querySelector('span');
    try { await navigator.clipboard.writeText($('successRef').textContent); label.textContent = 'Copied'; }
    catch (_) { label.textContent = 'Select & copy'; }
    setTimeout(() => { label.textContent = 'Copy'; }, 1800);
  });
  $('trackThis').addEventListener('click', () => { showTab('track'); $('trackForm').requestSubmit(); });
  $('bookAnother').addEventListener('click', () => {
    $('bookForm').reset(); state.photos.forEach((p) => URL.revokeObjectURL(p.url)); state.photos = []; renderThumbs();
    state.method = null; state.receiverDelivery = false; state.departure = null;
    $('bookForm').classList.remove('hidden'); $('successWrap').classList.add('hidden');
    $('successEstimate').classList.add('hidden'); $('photoNote').classList.add('hidden');
    chooseType('parcel'); renderDepOptions();
    setStep(1); updateSummary();
  });

  function preselect(routeCode, depId) {
    if (routeCode && state.routes.some((r) => r.code === routeCode)) chooseRoute(routeCode);
    if (depId) {
      state.departure = state.schedule.find((s) => s.id === depId) || null;
      renderDepOptions(); updateSummary();
    }
  }

  // ─────────────────────────────── Track ───────────────────────────────
  // One box for BAH- references, INV- invoice numbers and customer numbers (with their phone).
  // Money and the customer number show only with the phone they booked with.
  // Steps follow the admin app: booking New → Confirmed → on a flight's sheet, then the flight's
  // own status (Departed → Arrived → Completed).
  function cargoSteps(b, stage) {
    const dep = shipDates(b).departure;
    const at = (i) => i <= stage;
    return [
      { t: 'Booking received', d: stage === 0 ? 'We have your booking and will confirm it shortly.' : 'We have your booking.' },
      { t: 'Confirmed', d: !at(1) ? 'Our team confirms your booking on WhatsApp.' : b.status === 'collected' ? 'Confirmed — your items are with us.' : 'Your booking is confirmed with our team.' },
      { t: 'Booked on a flight', d: !at(2) ? 'We put you on the next flight and tell you the date.' : dep ? `On the flight leaving ${fmtDate(dep)}.` : 'We’ll confirm the date with you on WhatsApp.' },
      { t: 'On the way', d: !at(3) ? 'The flight leaves with your items.' : `Left${dep ? ' ' + fmtDate(dep) : ''}${b.expected_arrival && !at(4) ? ` · expected ${fmtDate(b.expected_arrival)}` : ''}.` },
      { t: 'Arrived', d: at(4) ? `Arrived${b.arrived_on ? ' ' + fmtDate(b.arrived_on) : ''}. Ready for collection or delivery.` : 'Ready for collection or delivery.' },
      { t: 'Collected / delivered', d: at(5) ? 'Handed over. Thank you for sending with us!' : 'Handed over to the receiver.' },
    ];
  }
  const knownPhones = {};   // reference → the phone they booked with, when this device knows it
  let shown = null;
  const onBoard = (b) => b.status === 'added' && !!b.shipment_status && b.shipment_status !== 'cancelled';
  function shipDates(b) {
    const ok = onBoard(b) || ['draft', 'open', 'closed'].includes(b.shipment_status);
    return { departure: ok ? b.departure_date : null, expected: ok ? b.expected_arrival : null };
  }
  // The last step reached. The row's arrival / collection notes are typed freely by the team
  // ("ARRIVED", "Collected 02/07/2026", "DELIVERED"…), so they're read loosely, and only once the flight has left.
  function stageOf(b) {
    if (!onBoard(b)) return ['confirmed', 'scheduled', 'collected', 'added'].includes(b.status) ? 1 : 0;
    const s = b.shipment_status;
    const note = (v) => String(v || '').trim().toLowerCase();
    const arr = note(b.arrival_status), coll = note(b.collection_status);
    const left = ['departed', 'arrived', 'completed'].includes(s);
    const arrived = s === 'arrived' || s === 'completed' || (left && /^(arriv|collected|delivered)/.test(arr));
    if (s === 'completed' || (arrived && (/^(collected|delivered|dropped)/.test(coll) || /^(collected|delivered)/.test(arr)))) return 5;
    if (arrived) return 4;
    if (left) return 3;
    return 2;
  }
  const qtyText = (q) => String(Number(q)).replace(/\.0+$/, '');
  const askLink = (ref, what) => F.waLink(`Hello BAH Transporters, about my ${what} ${ref}`);
  const timeline = (steps, stage, done) => `
      <div class="timeline">
        ${steps.map((s, i) => `
          <div class="tl-step ${i <= stage || done ? 'done' : ''} ${i === stage && !done ? 'now' : ''}"${i === stage && !done ? ' aria-current="step"' : ''}>
            <div class="tl-dot">${i <= stage || done ? ICONS.tick : `<span class="text-xs font-extrabold">${i + 1}</span>`}</div>
            <div><p class="t">${s.t}${i === stage && !done ? '<span class="tl-now">Now</span>' : ''}</p><p class="d">${s.d}</p></div>
          </div>`).join('')}
      </div>`;
  const unlockBox = (title) => `
      <div class="mt-6 rounded-2xl border border-ink-line bg-sand/60 p-4">
        <p class="flex items-center gap-2 font-bold text-ink"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>${title}</p>
        <p class="mt-1 text-[0.88rem] text-ink-soft">Kept private. Add the phone number you booked with to see them.</p>
        <form id="unlockForm" class="mt-3 flex gap-2" novalidate>
          <input type="tel" class="form-input !py-2.5" id="unlockPhone" placeholder="Your phone number" autocomplete="tel" aria-label="The phone number you booked with">
          <button type="submit" class="btn-dark btn-sm" id="unlockBtn">Show</button>
        </form>
        <p class="field-error-block hidden" id="unlockErr" role="alert"></p>
      </div>`;

  function renderCargo(b) {
    if (b.status === 'cancelled') {
      return `<p class="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-ink-faint">${esc(b.ref)}</p>
        <h3 class="mt-1 text-[1.6rem]">This booking was cancelled</h3>
        <p class="mt-2 text-ink-soft">If that’s not right, message us and we’ll sort it out.</p>
        <a class="btn-wa mt-6" href="${askLink(b.ref, 'booking')}" target="_blank" rel="noopener">Message us on WhatsApp</a>`;
    }
    const stage = stageOf(b);
    const done = stage >= 5;
    const steps = cargoSteps(b, stage);
    const dates = shipDates(b);
    const priv = b.phone_ok
      ? `${b.customer_no ? `<div><p>Customer no.</p><p>${esc(b.customer_no)}</p></div>` : ''}
         ${Number(b.total) > 0 ? `<div><p>Total</p><p>${money(b.total, b.currency)}</p></div>
           <div><p>Balance to pay</p><p style="color:${Number(b.balance) > 0 ? '#9E3714' : '#177A4C'}">${Number(b.balance) > 0 ? money(b.balance, b.currency) : 'Paid in full'}</p></div>`
           : b.estimate ? `<div><p>Estimate</p><p>${money(b.estimate, b.currency)}</p></div>` : ''}`
      : '';
    return `
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-ember-dark">${esc(b.ref)}</p>
          <h3 class="mt-1 text-[1.6rem]">${done ? 'Completed — thank you!' : esc(steps[stage].t)}</h3>
          <p class="mt-1 text-sm text-ink-soft">Air freight${b.route_label ? ' · ' + esc(b.route_label) : ''}</p>
        </div>
        <span class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-ember-light text-ember-dark">${ICONS.plane}</span>
      </div>
      ${timeline(steps, stage, done)}
      <div class="info-mini">
        ${b.booked_on ? `<div><p>Booked</p><p>${fmtDate(b.booked_on)}</p></div>` : ''}
        <div><p>Flight</p><p>${dates.departure ? fmtDate(dates.departure) : 'To be confirmed'}</p></div>
        ${b.arrived_on && stage >= 4 ? `<div><p>Arrived</p><p>${fmtDate(b.arrived_on)}</p></div>` : dates.expected && stage < 4 ? `<div><p>Expected</p><p>${fmtDate(dates.expected)}</p></div>` : ''}
        ${b.kilos ? `<div><p>Weight</p><p>${esc(qtyText(b.kilos))} kg</p></div>` : ''}
        ${priv}
      </div>
      ${b.phone_ok ? '' : unlockBox('Total, balance &amp; customer number')}
      <a class="btn-wa mt-6 w-full" href="${askLink(b.ref, 'booking')}" target="_blank" rel="noopener">Ask about this booking</a>`;
  }

  // A customer number (with their phone): the shipments still going, newest first.
  function custLine(b, i) {
    const stage = stageOf(b);
    const steps = cargoSteps(b, stage);
    const dep = shipDates(b).departure;
    const bits = [dep ? `Flight ${fmtDate(dep)}` : '', b.kilos ? `${qtyText(b.kilos)} kg` : '',
      Number(b.total) > 0 ? (Number(b.balance) > 0 ? `${money(b.balance, b.currency)} to pay` : 'Paid in full') : ''].filter(Boolean);
    return `
        <button type="button" class="cust-item group flex w-full items-center gap-3 rounded-2xl border border-ink-line bg-white p-4 text-left transition-colors hover:border-ink/25 hover:bg-sand/50" data-i="${i}">
          <span class="min-w-0 flex-1">
            <span class="block text-[0.72rem] font-bold uppercase tracking-[0.16em] text-ember-dark">${esc(b.ref)}</span>
            <span class="mt-0.5 block font-display font-bold">${stage >= 5 ? 'Collected / delivered' : esc(steps[stage].t)}</span>
            <span class="mt-0.5 block text-[0.84rem] text-ink-soft">${b.route_label ? esc(b.route_label) : 'Air freight'}${bits.length ? ' · ' + esc(bits.join(' · ')) : ''}</span>
          </span>
          <svg class="flex-shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
        </button>`;
  }
  const custLive = (c) => (c.items || []).filter((b) => b.status !== 'cancelled' && stageOf(b) < 5);
  function renderCustomer(c) {
    const live = custLive(c);
    const ask = `<a class="btn-wa mt-6 w-full" href="${askLink(c.customer_no, 'shipments, customer no.')}" target="_blank" rel="noopener">Ask about my shipments</a>`;
    if (live.length > 1) {
      return `
        <p class="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-ember-dark">Customer no. ${esc(c.customer_no)}</p>
        <h3 class="mt-1 text-[1.6rem]">${live.length} shipments in progress</h3>
        <p class="mt-1 text-sm text-ink-soft">${c.first_name ? `Hello ${esc(c.first_name)}. ` : ''}Newest first. Tap one to see where it is.</p>
        <div class="mt-5 grid gap-2">${live.map(custLine).join('')}</div>
        ${ask}`;
    }
    const one = live[0] || (c.items || []).find((b) => b.status !== 'cancelled') || c.latest;
    if (!one) {
      return `
        <p class="text-[0.72rem] font-bold uppercase tracking-[0.2em] text-ember-dark">Customer no. ${esc(c.customer_no)}</p>
        <h3 class="mt-1 text-[1.6rem]">Nothing in progress</h3>
        <p class="mt-2 text-ink-soft">We have no shipments under this number right now. If you’ve just booked, use the BAH- reference from your booking.</p>
        ${ask}`;
    }
    return custDetail(c, one, live.length ? `Customer no. ${esc(c.customer_no)} · 1 shipment in progress` : `Customer no. ${esc(c.customer_no)} · nothing in progress right now. Your last shipment:`);
  }
  function custDetail(c, b, top) {
    return `${top ? `<p class="mb-4 text-sm text-ink-soft">${top}</p>`
      : `<button type="button" class="mb-5 inline-flex items-center gap-1.5 rounded-full px-1 text-sm font-bold text-ink-soft transition-colors hover:text-ink" id="custBack"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>All shipments · customer no. ${esc(c.customer_no)}</button>`}
      ${renderCargo(b)}`;
  }
  function showBox(html) {
    const box = $('trackResult');
    box.innerHTML = html;
    box.classList.remove('hidden');
    $('trackEmpty').classList.add('hidden');
    return box;
  }
  function showCustomer(c, i) {
    const box = showBox(i == null ? renderCustomer(c) : custDetail(c, custLive(c)[i]));
    shown = { ref: null, res: c };
    box.querySelectorAll('.cust-item').forEach((el) => el.addEventListener('click', () => {
      showCustomer(c, Number(el.dataset.i));
      if (box.getBoundingClientRect().top < 0) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
      $('custBack')?.focus({ preventScroll: true });
    }));
    $('custBack')?.addEventListener('click', () => {
      showCustomer(c);
      if (box.getBoundingClientRect().top < 0) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  function showResult(res) {
    if (res.kind === 'customer') return showCustomer(res);
    showBox(renderCargo(res));
    shown = { ref: res.ref, res };
    const form = $('unlockForm');
    if (form) {
      form.addEventListener('submit', unlock);
      $('unlockPhone').addEventListener('input', () => $('unlockErr').classList.add('hidden'));
    }
  }

  // Ask the database. With a phone: the number as typed first, then with its country code.
  async function lookup(ref, phone) {
    const tries = phone ? F.phoneVariants(phone, ['GM']) : [null];
    let res = { found: false };
    for (const p of tries) {
      const r = await F.send(`${B.SUPABASE_URL}/rest/v1/rpc/track_reference`, {
        method: 'POST', headers: { apikey: B.SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_ref: ref, p_phone: p }),
      }, 'tracking');
      if (!r.ok) throw new Error('Tracking isn’t working just now. Please try again in a minute, or WhatsApp us your reference.');
      res = await r.json();
      if (!res || res.error || !p) break;
      if (res.found ? res.phone_ok : res.kind !== 'customer') break;
    }
    if (res && res.error === 'too_many') throw new Error('Too many tries. Please wait a few minutes and try again.');
    return res || { found: false };
  }

  async function unlock(e) {
    e.preventDefault();
    const phone = $('unlockPhone').value.trim();
    const err = (m) => { $('unlockErr').textContent = m; $('unlockErr').classList.remove('hidden'); };
    if (phone.replace(/\D/g, '').length < 7) { err('Please enter the phone number you booked with.'); return; }
    const btn = $('unlockBtn'); btn.disabled = true; btn.textContent = '…';
    try {
      const res = await lookup(shown.ref, phone);
      if (res.found && res.phone_ok) { knownPhones[res.ref] = phone; showResult(res); }
      else { btn.disabled = false; btn.textContent = 'Show'; err('That number doesn’t match. Use the one you booked with, or WhatsApp us.'); }
    } catch (ex) { btn.disabled = false; btn.textContent = 'Show'; err(ex.message); }
  }

  function custNoOf(v) {
    const plain = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const m = plain.match(/^(?:NO)?(\d{1,5})$/);
    return m ? String(Number(m[1])) : null;
  }
  let devicePhone = null;
  function syncPhoneBox() {
    const show = !!custNoOf($('trackRef').value);
    const wrap = $('trackPhoneWrap');
    if (wrap.hidden === !show) return;
    wrap.hidden = !show;
    if (show && !$('trackPhone').value && devicePhone) $('trackPhone').value = devicePhone;
    if (!show) F.setError('trackPhone', '');
  }

  $('trackForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('trackAlert').classList.remove('show');
    const ref = $('trackRef').value.trim().toUpperCase();
    const plain = ref.replace(/[^A-Z0-9]/g, '');
    const cust = custNoOf(ref);
    syncPhoneBox();
    const refMsg = cust ? ''
      : /^\d{7,}$/.test(plain) ? 'That looks like a phone number. Enter your reference (BAH-…), invoice number (INV-…) or customer number.'
      : plain.length < 6 ? 'Please enter your reference, e.g. BAH-7K2QAF, or your customer number.' : '';
    if (!F.setError('trackRef', refMsg)) return;
    const phone = cust ? $('trackPhone').value.trim() : '';
    if (cust && !F.setError('trackPhone', phone.replace(/\D/g, '').length < 7 ? 'Please enter the phone number you booked with.' : '')) return;
    const btn = $('trackBtn'); btn.disabled = true; btn.classList.add('is-loading');
    try {
      const norm = /^(BAH|INV)[A-Z0-9]{6}$/.test(plain) ? plain.slice(0, -6) + '-' + plain.slice(-6) : '';
      const remembered = cust ? phone : knownPhones[ref] || knownPhones[norm] || null;
      const res = await lookup(cust ? cust : ref, remembered);
      const url = new URL(location.href);
      if (!res.found) {
        $('trackResult').classList.add('hidden'); $('trackEmpty').classList.remove('hidden');
        $('trackAlertText').textContent = cust
          ? `We couldn’t find customer number ${cust} with that phone number. Use the phone number you booked with, or your BAH- reference.`
          : 'We couldn’t find that reference. Check it against your booking: references start with BAH-, invoices with INV-.';
        $('trackAlert').classList.add('show');
      } else {
        if (res.kind !== 'customer') $('trackRef').value = res.ref;
        showResult(res);
        if (url.pathname === '/track') { if (res.kind === 'customer') url.searchParams.delete('ref'); else url.searchParams.set('ref', res.ref); history.replaceState(null, '', url); }
        if (window.matchMedia('(max-width: 1023px)').matches) $('trackResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err) {
      $('trackResult').classList.add('hidden'); $('trackEmpty').classList.remove('hidden');
      $('trackAlertText').textContent = err.message; $('trackAlert').classList.add('show');
    } finally {
      btn.disabled = false; btn.classList.remove('is-loading');
    }
  });
  $('trackRef').addEventListener('input', () => { F.setError('trackRef', ''); $('trackAlert').classList.remove('show'); syncPhoneBox(); });
  $('trackPhone').addEventListener('input', () => { F.setError('trackPhone', ''); $('trackAlert').classList.remove('show'); });

  // ─────────────────────────────── Start ───────────────────────────────
  (async () => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    const onTrack = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') === '/track' || tab === 'track';
    if (onTrack) showTab('track', tab === 'track');
    else if (tab === 'flights' || tab === 'departures') showTab('flights', false);
    try {
      const last = JSON.parse(localStorage.getItem('bah_last_booking') || 'null');
      if (last && last.ref) { knownPhones[String(last.ref).toUpperCase()] = last.phone; if (!params.get('ref')) $('trackRef').value = last.ref; }
      if (last && last.phone) devicePhone = String(last.phone);
    } catch (_) { /* ignore */ }
    if (params.get('ref')) $('trackRef').value = params.get('ref').toUpperCase();
    syncPhoneBox();
    if (onTrack && params.get('ref')) $('trackForm').requestSubmit();
    renderTypes();
    const type = params.get('type');
    chooseType(TYPES[type] ? type : 'parcel');
    const kg = parseFloat(params.get('kg'));
    if (kg > 0 && kg <= 5000 && type !== 'document') $('estKg').value = String(kg);
    renderDepOptions();
    renderGuides();
    updateSummary();
    await loadData();
    const depId = params.get('d');
    const dep = depId ? state.schedule.find((s) => s.id === depId) : null;
    const route = params.get('route') ? state.routes.find((r) => r.code === params.get('route').toUpperCase()) : null;
    if (dep) preselect(dep.route_code, dep.id);
    else if (route) preselect(route.code, null);
    updateSummary();
  })();
})();
