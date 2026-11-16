// Customer invoice: bahtransporters.com/invoice?k=<invoice key> (the key is in the link the team sends on WhatsApp).
// Data from get_invoice (migrations 0014 / 0015): the sheet row, its flight, payments and the invoice settings
// the team keeps in the admin app (Settings → Invoices).
(function () {
  'use strict';
  const B = window.BAH;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (d) => d ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(String(d).slice(0, 10) + 'T12:00:00')) : '—';
  const money = (v, cur = 'GBP') => {
    const n = Number(v || 0);
    try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur || 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n); }
    catch (_) { return `${cur} ${n.toFixed(2)}`; }
  };
  const num = (v) => String(Number(v)).replace(/\.0+$/, '');
  const PAY = { cash: 'Cash', bank: 'Bank transfer', mobile: 'Mobile money', card: 'Card', other: 'Other' };
  const METHOD = { collection: 'Collection', delivery: 'Delivery', dropoff: 'Drop-off', postal: 'Post' };
  const DEFAULTS = { email: B.EMAIL, whatsapp: B.PHONE, routes_line: 'AIR FREIGHT · UK ⇄ THE GAMBIA', terms_air: [], guidelines_air: [], acknowledgement: '' };
  const wa = (text) => `https://api.whatsapp.com/send?phone=${B.WHATSAPP}&text=${encodeURIComponent(text)}`;

  $('printBtn').addEventListener('click', () => window.print());

  function message(title, body) {
    $('doc').innerHTML = `<div class="inv-page px-6 py-14 text-center sm:px-10">
      <h1 class="text-[1.8rem]">${esc(title)}</h1>
      <p class="mx-auto mt-3 max-w-md text-ink-soft">${esc(body)}</p>
      <a class="btn-wa mt-7" href="${wa('Hello BAH Transporters, I need my invoice please.')}" target="_blank" rel="noopener">Message us on WhatsApp</a></div>`;
  }

  // "2 boxes, 1 bag" → [2 · boxes] [1 · bag]; anything else is one line.
  function itemLines(description, fallbackQty) {
    const parts = String(description || '').split(/\n|;|,(?![^(]*\))/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return [{ qty: fallbackQty || 1, what: 'Air freight' }];
    if (parts.length === 1 && fallbackQty && !/^\d/.test(parts[0])) return [{ qty: fallbackQty, what: parts[0] }];
    return parts.map((p) => { const m = p.match(/^(\d+)\s*(?:x|×|pcs?|pieces?)?\s+(.+)$/i); return m ? { qty: Number(m[1]), what: m[2] } : { qty: 1, what: p }; });
  }

  function render(inv) {
    const S = { ...DEFAULTS, ...(inv.settings || {}) };
    const cur = inv.currency || 'GBP';
    const sh = inv.shipment || {}, c = inv.customer || {}, o = inv.other || {};
    const total = Number(inv.total || 0), paid = Number(inv.paid || 0), balance = Number(inv.balance || 0);
    const state = total <= 0.004 ? 'tbc' : balance <= 0.004 ? 'paid' : paid > 0.004 ? 'part' : 'unpaid';
    const STATUS = { paid: 'Paid in full', part: 'Part paid', unpaid: 'Payment due', tbc: 'Price to be confirmed' };
    const inbound = sh.destination === 'United Kingdom';
    const route = sh.origin && sh.destination ? `${sh.origin} → ${sh.destination}` : (sh.route || '—');
    const method = inv.method ? (METHOD[String(inv.method).toLowerCase()] || inv.method) : null;
    const address = [c.address, c.city, c.postcode].filter(Boolean).join(', ');
    const lines = itemLines(inv.description, inv.item_count);
    const kg = inv.kilos ? `${num(inv.kilos)} kg` : '—';
    const freight = inv.manual_total !== null && inv.manual_total !== undefined
      ? { label: /^Documents/i.test(inv.description || '') ? 'Documents · flat price' : 'Freight · agreed price', sub: inv.kilos ? `${num(inv.kilos)} kg` : '', amount: Number(inv.manual_total) }
      : inv.kilos && inv.rate ? { label: 'Air freight', sub: `${num(inv.kilos)} kg × ${money(inv.rate, cur)} per kg`, amount: Math.round(Number(inv.kilos) * Number(inv.rate) * 100) / 100 }
      : { label: 'Air freight', sub: 'Price confirmed after weighing', amount: null };
    const extras = Number(inv.extras || 0), discount = Number(inv.discount || 0);
    const pays = inv.payments || [];
    const bank = S.bank_air || {};
    const terms = S.terms_air || [];
    const guides = S.guidelines_air || [];
    const pageCount = 1 + (terms.length ? 1 : 0) + (guides.length ? 1 : 0);
    const brand = `
      <div class="flex items-center gap-3">
        <img src="/brand_assets/bah-mark.svg" width="62" height="48" alt="" class="h-[48px] w-[62px]">
        <div class="leading-tight">
          <p class="font-display text-[1.25rem] font-extrabold tracking-[-0.03em]">Bah Transporters Ltd</p>
          <p class="text-[0.66rem] font-bold uppercase tracking-[0.24em] text-ember-dark">Air freight · UK ⇄ The Gambia</p>
        </div>
      </div>`;
    const top = (n) => n === 1 ? `
      <header class="inv-top flex flex-col gap-6 px-6 py-7 sm:flex-row sm:items-start sm:justify-between sm:px-10">
        <div class="min-w-0">
          ${brand}
          <p class="mt-4 text-[0.86rem] leading-relaxed text-ink-soft">
            77 Melbourne Avenue, Newtown, <span class="whitespace-nowrap">Birmingham B19 2HU</span><br>
            <span class="whitespace-nowrap">WhatsApp ${esc(S.whatsapp)}</span>${S.email ? ` · ${esc(S.email)}` : ''} · bahtransporters.com
            ${S.admin1 || S.admin2 ? `<br>${[S.admin1, S.admin2].filter(Boolean).map(esc).join(' · ')}` : ''}
            <br>Company no. 14556620
          </p>
        </div>
        <div class="sm:text-right">
          <p class="inv-label">Air freight</p>
          <h1 class="mt-1 text-[2.2rem] font-extrabold">Invoice</h1>
          <p class="font-display text-lg font-bold">${esc(inv.invoice_no)}</p>
          <p class="text-[0.86rem] text-ink-soft">${fmtDate(inv.date)}${c.no ? ` · Customer no. ${esc(c.no)}` : ''}</p>
          <span class="inv-status ${state} mt-2">${STATUS[state]}</span>
        </div>
      </header>` : `
      <header class="inv-top flex items-center justify-between gap-4 px-6 py-5 sm:px-10">
        ${brand}
        <div class="text-right"><p class="inv-label">Invoice</p><p class="font-display font-bold">${esc(inv.invoice_no)}</p></div>
      </header>`;
    const foot = (n) => `<footer class="flex justify-between gap-4 border-t border-ink-line px-6 py-4 text-[0.74rem] text-ink-faint sm:px-10"><span>Bah Transporters Ltd · bahtransporters.com · WhatsApp ${esc(S.whatsapp)}</span><span>Page ${n} of ${pageCount}</span></footer>`;
    const field = (label, value, wide) => value ? `<div class="${wide ? 'sm:col-span-2' : ''} rounded-2xl bg-sand px-4 py-3"><p class="inv-label">${label}</p><p class="mt-0.5 font-semibold text-ink">${esc(value)}</p></div>` : '';
    const page1 = `
      <section class="inv-page">
        ${top(1)}
        <div class="space-y-8 px-6 py-8 sm:px-10">
          <div class="grid grid-cols-3 gap-3">
            <div class="rounded-2xl border border-ink-line px-4 py-3"><p class="inv-label">Total</p><p class="mt-1 font-display text-xl font-extrabold tabular">${total > 0.004 ? money(total, cur) : '—'}</p></div>
            <div class="rounded-2xl border border-ink-line px-4 py-3"><p class="inv-label">Paid</p><p class="mt-1 font-display text-xl font-extrabold tabular">${money(paid, cur)}</p></div>
            <div class="inv-due ${state} rounded-2xl px-4 py-3"><p class="inv-label">${state === 'paid' ? 'Balance' : 'Balance due'}</p><p class="mt-1 font-display text-xl font-extrabold tabular">${state === 'tbc' ? '—' : money(Math.max(balance, 0), cur)}</p></div>
          </div>
          <div>
            <h2 class="text-[1.15rem]">Customer &amp; booking</h2>
            <div class="mt-3 grid gap-2.5 sm:grid-cols-2">
              ${field('Customer', c.name || '—')}
              ${field('Contact number', c.phone)}
              ${field('Route', route)}
              ${field('Flight', [sh.name, sh.departure ? 'departs ' + fmtDate(sh.departure) : null].filter(Boolean).join(' · '))}
              ${field(inbound ? 'Sender' : 'Receiver', [o.name, o.phone].filter(Boolean).join(' · '))}
              ${field('Handover', method)}
              ${inv.booking_ref ? field('Booking reference', inv.booking_ref) : ''}
              ${field(method === 'Delivery' || inbound ? 'Delivery address' : 'Address', address, true)}
            </div>
          </div>
          <div>
            <h2 class="text-[1.15rem]">Shipment</h2>
            <table class="mt-3 w-full text-left text-[0.94rem]">
              <thead><tr class="border-b border-ink-line"><th class="inv-label py-2 pr-3">Qty</th><th class="inv-label py-2">Description</th><th class="inv-label py-2 text-right">Weight</th></tr></thead>
              <tbody>${lines.map((l) => `<tr class="border-b border-ink-line/60"><td class="py-2.5 pr-3 font-semibold">${esc(l.qty)}</td><td class="py-2.5">${esc(l.what)}</td><td class="py-2.5 text-right">${lines.length === 1 ? esc(kg) : '—'}</td></tr>`).join('')}
                ${lines.length > 1 ? `<tr class="font-bold text-ink"><td class="py-2.5 pr-3">${esc(lines.reduce((s, l) => s + l.qty, 0))}</td><td class="py-2.5">Total</td><td class="py-2.5 text-right">${esc(kg)}</td></tr>` : ''}</tbody>
            </table>
          </div>
          <div>
            <h2 class="text-[1.15rem]">Payment summary</h2>
            <div class="mt-3 divide-y divide-ink-line/70 text-[0.95rem]">
              <div class="flex justify-between gap-4 py-2.5"><span>${esc(freight.label)}${freight.sub ? `<span class="block text-[0.82rem] text-ink-faint">${esc(freight.sub)}</span>` : ''}</span><span class="font-semibold tabular">${freight.amount === null ? '—' : money(freight.amount, cur)}</span></div>
              ${extras ? `<div class="flex justify-between gap-4 py-2.5"><span>Extras</span><span class="font-semibold tabular">${money(extras, cur)}</span></div>` : ''}
              ${discount ? `<div class="flex justify-between gap-4 py-2.5"><span>Discount</span><span class="font-semibold tabular text-ok-dark">−${money(discount, cur)}</span></div>` : ''}
              <div class="flex justify-between gap-4 py-2.5 font-bold"><span>Total</span><span class="tabular">${total > 0.004 ? money(total, cur) : '—'}</span></div>
              <div class="flex justify-between gap-4 py-2.5"><span>Paid${pays.length ? `<span class="block text-[0.82rem] text-ink-faint">${pays.map((p) => `${fmtDate(p.date)} · ${esc(PAY[p.method] || p.method || '')} · ${p.currency && p.currency !== cur ? `${money(p.amount, p.currency)} (${money(p.applied, cur)})` : money(p.applied ?? p.amount, cur)}`).join('<br>')}</span>` : ''}</span><span class="font-semibold tabular">${money(paid, cur)}</span></div>
            </div>
            <div class="inv-due ${state} mt-4 flex items-center justify-between gap-4 rounded-2xl px-5 py-4">
              <div><p class="inv-label">${STATUS[state]}</p><p class="font-display text-lg font-bold">${state === 'paid' ? 'Nothing to pay' : 'Balance due'}</p></div>
              <p class="font-display text-[1.7rem] font-extrabold tabular">${state === 'tbc' ? '—' : money(Math.max(balance, 0), cur)}</p>
            </div>
          </div>
          ${bank && (bank.account_no || bank.holder) ? `
          <div>
            <h2 class="text-[1.15rem]">Bank details for payment</h2>
            <div class="mt-3 grid gap-2.5 sm:grid-cols-2">${field('Account name', bank.holder)}${field('Bank', bank.bank)}${field('Sort code', bank.sort_code)}${field('Account number', bank.account_no)}</div>
            <p class="mt-2 text-[0.84rem] text-ink-soft">Please use your invoice number ${esc(inv.invoice_no)} as the payment reference.</p>
          </div>` : `<p class="rounded-2xl bg-sand px-5 py-4 text-[0.92rem] text-ink-soft">Pay by bank transfer or cash once your shipment is weighed. Message us on WhatsApp ${esc(S.whatsapp)} for the payment details, quoting ${esc(inv.invoice_no)}.</p>`}
          ${terms.length ? '<p class="text-[0.8rem] italic text-ink-faint">Booking a shipment or paying confirms acceptance of the terms on page 2.</p>' : ''}
        </div>
        ${foot(1)}
      </section>`;
    const page2 = terms.length ? `
      <section class="inv-page">
        ${top(2)}
        <div class="px-6 py-8 sm:px-10">
          <h2 class="text-[1.6rem]">Terms of service</h2>
          <ol class="mt-5 space-y-2.5 text-[0.92rem] text-ink-soft">${terms.map((t, i) => `<li class="flex gap-3"><span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-ember-light text-[0.72rem] font-bold text-ember-deep">${i + 1}</span><span>${esc(t)}</span></li>`).join('')}</ol>
          ${S.acknowledgement ? `<div class="mt-6 rounded-2xl bg-sand px-5 py-4"><p class="inv-label">Customer acknowledgement</p><p class="mt-1 text-[0.92rem] text-ink">${esc(S.acknowledgement)}</p></div>` : ''}
        </div>
        ${foot(2)}
      </section>` : '';
    const page3 = guides.length ? `
      <section class="inv-page">
        ${top(pageCount)}
        <div class="px-6 py-8 sm:px-10">
          <h2 class="text-[1.6rem]">Air freight booking rules</h2>
          <ol class="mt-5 space-y-2.5 text-[0.92rem] text-ink-soft">${guides.map((t, i) => `<li class="flex gap-3"><span class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-ink text-[0.72rem] font-bold text-white">${i + 1}</span><span>${esc(t)}</span></li>`).join('')}</ol>
          <div class="mt-7 rounded-2xl bg-ink px-5 py-5 text-white"><p class="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-ember-bright">Questions? WhatsApp us</p><p class="mt-1 font-display text-2xl font-extrabold">${esc(S.whatsapp)}</p></div>
        </div>
        ${foot(pageCount)}
      </section>` : '';
    $('doc').innerHTML = page1 + page2 + page3;
    $('doc').className = 'space-y-6';
    document.title = `Invoice ${inv.invoice_no} — BAH Transporters`;
    $('askBtn').href = wa(`Hello BAH Transporters, about my invoice ${inv.invoice_no}`);
  }

  const key = new URLSearchParams(location.search).get('k') || '';
  if (!/^[0-9a-f]{32}$/i.test(key)) { message('This invoice link isn’t complete', 'Please open the full link from our WhatsApp message, or ask us to send it again.'); return; }
  fetch(`${B.SUPABASE_URL}/rest/v1/rpc/get_invoice`, { method: 'POST', headers: { apikey: B.SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_key: key.toLowerCase() }) })
    .then((r) => { if (!r.ok) throw new Error('load'); return r.json(); })
    .then((inv) => { if (!inv || !inv.invoice_no) message('We couldn’t find this invoice', 'The link may be old. Message us and we’ll send you a new one.'); else render(inv); })
    .catch(() => message('We couldn’t load your invoice', 'Please check your connection and try again, or message us on WhatsApp.'));
})();
