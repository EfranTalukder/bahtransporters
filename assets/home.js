// Home page: the instant price calculator. Uses the live prices from the admin app
// (Settings → Routes & prices); the same sums as the database's website booking.
(function () {
  'use strict';
  const B = window.BAH;
  const $ = (id) => document.getElementById(id);
  const money = (v) => {
    try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v); }
    catch (_) { return '£' + Number(v).toFixed(2); }
  };
  const state = { route: 'UKGAM', type: 'parcel', kg: 5, routes: {} };
  const rateOf = () => Number(state.routes[state.route]?.rate) || B.FALLBACK_RATE;
  const minOf = () => Number(state.routes[state.route]?.min_charge) || rateOf();
  const docOf = () => Number(state.routes[state.route]?.document_fee) || B.FALLBACK_DOCUMENT;

  function render() {
    const kgWrap = $('calcWeight');
    kgWrap.hidden = state.type === 'document';
    let total, note;
    if (state.type === 'document') {
      total = docOf();
      note = 'Documents — one flat price, any size envelope.';
    } else {
      const raw = Math.round(state.kg * rateOf() * 100) / 100;
      total = Math.max(raw, minOf());
      note = raw < minOf() ? `Under 1 kg is charged as 1 kg (${money(minOf())}).` : `${state.kg} kg × ${money(rateOf())}/kg`;
      if (state.type === 'shopping') note += ' + the item cost';
    }
    $('calcTotal').textContent = money(total);
    $('calcNote').textContent = note;
    const q = new URLSearchParams({ route: state.route, type: state.type });
    if (state.type !== 'document') q.set('kg', String(state.kg));
    $('calcBook').href = `/book?${q}`;
  }

  document.querySelectorAll('[data-calc-route]').forEach((b) => b.addEventListener('click', () => {
    state.route = b.dataset.calcRoute;
    document.querySelectorAll('[data-calc-route]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    render();
  }));
  document.querySelectorAll('[data-calc-type]').forEach((b) => b.addEventListener('click', () => {
    state.type = b.dataset.calcType;
    document.querySelectorAll('[data-calc-type]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    render();
  }));
  const slider = $('calcKg');
  const num = $('calcKgNum');
  slider.addEventListener('input', () => { state.kg = Number(slider.value); num.value = slider.value; render(); });
  num.addEventListener('input', () => {
    const v = parseFloat(num.value);
    if (!(v > 0)) return;
    state.kg = Math.min(500, Math.round(v * 10) / 10);
    slider.value = String(Math.max(1, Math.min(50, Math.round(state.kg))));
    render();
  });
  num.addEventListener('blur', () => { if (!(parseFloat(num.value) > 0)) { num.value = String(state.kg); } });

  render();
  const load = () => window.BAHLive && window.BAHLive().then(({ routes }) => {
    for (const r of routes) state.routes[r.code] = r;
    render();
  }).catch(() => { /* fallback prices stay */ });
  if (window.BAHLive) load(); else addEventListener('DOMContentLoaded', load);
})();
