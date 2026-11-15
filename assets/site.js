// Shared by every page: header shadow, phone menu, scroll reveals, live prices and next flights,
// the phone "Book now" bar, and the year in the footer.
(function () {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const B = window.BAH || {};

  // Header: a soft edge once the page moves.
  const header = $('#siteHeader');
  const onScroll = () => header && header.classList.toggle('scrolled', window.scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Phone menu.
  const menu = $('#mobileMenu');
  const openBtn = $('#menuOpen');
  const closeBtn = $('#menuClose');
  function setMenu(open) {
    if (!menu) return;
    menu.hidden = !open;
    document.documentElement.style.overflow = open ? 'hidden' : '';
    openBtn && openBtn.setAttribute('aria-expanded', String(open));
    if (open) (closeBtn || menu).focus();
    else openBtn && openBtn.focus();
  }
  openBtn && openBtn.addEventListener('click', () => setMenu(true));
  closeBtn && closeBtn.addEventListener('click', () => setMenu(false));
  menu && menu.addEventListener('click', (e) => { if (e.target === menu || e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu && !menu.hidden) setMenu(false); });

  // Reveal on scroll (content is visible straight away when motion is reduced or the browser is old).
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const els = $$('.reveal');
  if (reduce || !('IntersectionObserver' in window)) els.forEach((el) => el.classList.add('in'));
  else {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach((el) => io.observe(el));
  }

  // Phone bar with "Book now" once the first screen has scrolled away.
  const bar = $('#mobileCta');
  const hero = $('[data-hero]');
  if (bar && hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => bar.classList.toggle('show', !en.isIntersecting), { threshold: 0 }).observe(hero);
  }

  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  // ---------------------------------------------------------------- live data
  const fmtDate = (d, opts = { weekday: 'short', day: 'numeric', month: 'short' }) =>
    d ? new Intl.DateTimeFormat('en-GB', opts).format(new Date(d + 'T12:00:00')) : '';
  const money = (v, cur = 'GBP') => {
    try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v); }
    catch (_) { return '£' + Number(v).toFixed(2); }
  };
  async function rpc(name) {
    const r = await fetch(`${B.SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { apikey: B.SUPABASE_KEY, 'Content-Type': 'application/json' }, body: '{}',
    });
    if (!r.ok) throw new Error(name);
    return r.json();
  }
  // One request for the whole page, shared by whoever needs it (prices, next flights, calculator).
  let live = null;
  window.BAHLive = () => live || (live = Promise.all([rpc('get_public_rates'), rpc('get_public_schedule')])
    .then(([routes, schedule]) => ({ routes: routes || [], schedule: schedule || [] })));
  window.BAHFmt = { fmtDate, money };

  const needsLive = $$('[data-rate], [data-next-flight], [data-doc-fee]');
  if (!needsLive.length) return;
  window.BAHLive().then(({ routes, schedule }) => {
    const out = routes.find((r) => r.origin === 'United Kingdom') || routes[0];
    if (out && out.rate) $$('[data-rate]').forEach((el) => { el.textContent = money(out.rate, out.currency); });
    if (out && out.document_fee) $$('[data-doc-fee]').forEach((el) => { el.textContent = money(out.document_fee, out.currency).replace('.00', ''); });
    const today = new Date().toISOString().slice(0, 10);
    $$('[data-next-flight]').forEach((el) => {
      const code = el.dataset.nextFlight;
      const dep = schedule.filter((s) => s.route_code === code && s.status === 'open' && (!s.cut_off || s.cut_off >= today))
        .sort((a, b) => String(a.departure_date).localeCompare(String(b.departure_date)))[0];
      const d = el.querySelector('[data-date]');
      const n = el.querySelector('[data-note]');
      if (dep && dep.departure_date) {
        d.textContent = fmtDate(dep.departure_date, { weekday: 'short', day: 'numeric', month: 'long' });
        if (n) n.textContent = dep.cut_off ? `Book by ${fmtDate(dep.cut_off)}` : 'Taking bookings now';
        el.dataset.hasDate = 'true';
        const a = el.closest('a');
        if (a) a.href = `/book?d=${encodeURIComponent(dep.id)}`;
      } else {
        d.textContent = d.dataset.empty || 'Date being confirmed';
        if (n) n.textContent = 'Book now and we’ll put you on it, then confirm the date on WhatsApp.';
      }
    });
  }).catch(() => { /* the printed fallback copy stays */ });
})();
