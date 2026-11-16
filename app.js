'use strict';
/* Bugetul Meu — buget personal. Toate datele stau local, pe telefon (localStorage). */

const APP_VERSION = '1.0';
const KEY = 'bugetul-meu-v1';
const MONTHS = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
const MONTHS_SHORT = ['ian','feb','mar','apr','mai','iun','iul','aug','sep','oct','noi','dec'];
const CATS = {
  expense: ['Market','Restaurant','Transport','Locuință','Utilități','Abonamente','Sănătate','Haine','Distracție','Cadouri','Altele'],
  income: ['Salariu','Freelance','Cadouri','Vânzări','Altele'],
};
const ICON = {Market:'🛒',Restaurant:'🍽️',Transport:'🚗','Locuință':'🏠','Utilități':'💡',Abonamente:'🔁','Sănătate':'💊',
  Haine:'👕','Distracție':'🎉',Cadouri:'🎁',Altele:'📦',Salariu:'💼',Freelance:'💻','Vânzări':'🏷️'};
const COLORS = ['#A2CB8B','#E8F5BD','#D9A55B','#6FA8A0','#7E9F52','#E0896A','#9DB4C0','#B79CD6','#F2CC8F','#C44545','#5B7E3C'];
const CYCLE = {monthly:'lună', yearly:'an', weekly:'săpt.'};

/* ---------- utilitare ---------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const money = new Intl.NumberFormat('ro-RO', {style:'currency', currency:'RON'});
const fmt = n => money.format(n || 0);
const pad = n => String(n).padStart(2, '0');
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayISO = () => toISO(new Date());
const monthKey = iso => iso.slice(0, 7);
const monthLabel = k => `${MONTHS[+k.slice(5) - 1]} ${k.slice(0, 4)}`;
const fmtDate = iso => { const d = fromISO(iso); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`; };
const daysUntil = iso => Math.round((fromISO(iso) - fromISO(todayISO())) / 86400000);
const byDateDesc = (a, b) => (b.date + (b.created || '')).localeCompare(a.date + (a.created || ''));
const strip = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const num = s => {
  s = String(s ?? '').replace(/\s/g, '').replace(/lei|ron/ig, '');
  if (/^-?\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) s = s.replace(/\./g, '');
  const v = parseFloat(s.replace(',', '.'));
  return isFinite(v) ? Math.round(v * 100) / 100 : NaN;
};
const decStr = v => typeof v === 'string' ? v : (v == null || isNaN(v)) ? '' : String(v).replace('.', ',');
function shiftMonth(k, delta) {
  let y = +k.slice(0, 4), m = +k.slice(5) + delta;
  while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; }
  return `${y}-${pad(m)}`;
}
function addCycle(iso, cycle, day) {
  const d = fromISO(iso);
  if (cycle === 'weekly') { d.setDate(d.getDate() + 7); return toISO(d); }
  const months = cycle === 'yearly' ? 12 : 1;
  const t = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return toISO(new Date(t.getFullYear(), t.getMonth(), Math.min(day || d.getDate(), last)));
}
const catColor = c => COLORS[Math.max(0, CATS.expense.indexOf(c)) % COLORS.length];
const empty = t => `<div class="empty">${t}</div>`;

/* ---------- date ---------- */
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1) return {transactions: [], subscriptions: [], receipts: [], rules: {}, bankSeen: [], ...s};
  } catch {}
  return {v: 1, transactions: [], subscriptions: [], receipts: [], rules: {}, bankSeen: []};
}
let state = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { toast('Nu am putut salva datele (memorie plină?)'); }
}

let ui = {tab: 'home', month: monthKey(todayISO()), txFilter: 'all', statsRange: '3', ocr: null, review: null, detail: null};

/* ---------- randare ---------- */
const TITLES = {home:'Acasă', tx:'Tranzacții', subs:'Abonamente', scan:'Scanează bon', stats:'Statistici'};
function render() {
  const det = ui.detail && ui.detail.tab === ui.tab;
  $('#title').textContent = det ? ui.detail.cat : TITLES[ui.tab];
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === ui.tab));
  const imp = ui.imp && ui.tab === 'tx';
  if (imp) $('#title').textContent = 'Import extras';
  $('#fab').hidden = imp || (!det && (ui.tab === 'stats' || ui.tab === 'scan'));
  $('#view').innerHTML = imp ? viewImport() : det ? viewDetail() : VIEWS[ui.tab]();
  if (ui.tab === 'scan' && ui.review) updateReviewSum();
}

const txInMonth = m => state.transactions.filter(t => monthKey(t.date) === m);
function sums(list) {
  let inc = 0, exp = 0;
  for (const t of list) t.type === 'income' ? inc += t.amount : exp += t.amount;
  return {inc, exp, bal: inc - exp};
}
const monthSwitcher = () => `<div class="month"><button data-action="month" data-d="-1" aria-label="Luna anterioară">‹</button>
  <b>${monthLabel(ui.month)}</b><button data-action="month" data-d="1" aria-label="Luna următoare">›</button></div>`;

function txRow(t) {
  return `<button class="row" data-action="edit-tx" data-id="${t.id}">
    <span class="ic">${ICON[t.category] || '•'}</span>
    <span class="grow"><b>${esc(t.note || t.category)}</b><small>${esc(t.category)} · ${fmtDate(t.date)}${t.receiptId ? ' · 🧾 bon' : ''}${t.bank ? ' · <span class="ok">✓ bancă</span>' : ''}${t.method === 'cash' ? ' · 💵 cash' : ''}</small></span>
    <span class="amt ${t.type}">${t.type === 'income' ? '+' : '−'}${fmt(t.amount)}</span></button>`;
}

function chart6() {
  const ms = [...Array(6)].map((_, i) => shiftMonth(ui.month, i - 5));
  const data = ms.map(m => sums(txInMonth(m)));
  const max = Math.max(1, ...data.map(d => Math.max(d.inc, d.exp)));
  const W = 320, H = 150, top = 8, bottom = 22, ch = H - top - bottom, gw = W / 6, bw = gw * 0.3;
  let bars = '';
  data.forEach((d, i) => {
    const x = i * gw + gw / 2, hi = d.inc / max * ch, he = d.exp / max * ch;
    bars += `<rect x="${x - bw - 1}" y="${top + ch - hi}" width="${bw}" height="${hi}" rx="3" class="b-inc"><title>Venituri: ${fmt(d.inc)}</title></rect>
      <rect x="${x + 1}" y="${top + ch - he}" width="${bw}" height="${he}" rx="3" class="b-exp"><title>Cheltuieli: ${fmt(d.exp)}</title></rect>
      <text x="${x}" y="${H - 5}" text-anchor="middle" class="axis">${MONTHS_SHORT[+ms[i].slice(5) - 1]}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Venituri și cheltuieli, ultimele 6 luni">
    <line x1="0" x2="${W}" y1="${top + ch}" y2="${top + ch}" class="baseline"/>${bars}</svg>
    <div class="legend"><span><i class="dot inc"></i>Venituri</span><span><i class="dot exp"></i>Cheltuieli</span></div>`;
}

function barList(entries, colorFn) {
  const max = entries[0]?.[1] || 1;
  return entries.map(([label, v, extra]) => `<div class="bar-row"><div class="lbl"><span>${label}</span><b>${fmt(v)}</b></div>
    <div class="bar"><div style="width:${Math.max(2, v / max * 100)}%;${colorFn ? 'background:' + colorFn(extra ?? label) : ''}"></div></div></div>`).join('');
}

function donut(cats, total) {
  const R = 80, C = 2 * Math.PI * R, gap = cats.length > 1 ? 3 : 0;
  let off = 0, arcs = '';
  for (const [c, v] of cats) {
    const len = Math.max(0, v / total * C - gap);
    arcs += `<circle r="${R}" cx="100" cy="100" fill="none" stroke="${catColor(c)}" stroke-width="22" stroke-linecap="butt"
      stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 100 100)" data-action="open-cat" data-cat="${esc(c)}" style="cursor:pointer"><title>${esc(c)}: ${fmt(v)}</title></circle>`;
    off += v / total * C;
  }
  return `<div class="donut-wrap"><svg viewBox="0 0 200 200" class="donut" role="img" aria-label="Cheltuieli pe categorii">
      <circle r="${R}" cx="100" cy="100" fill="none" stroke="var(--card2)" stroke-width="22"/>${arcs}
      <text x="100" y="96" text-anchor="middle" class="donut-sub">Cheltuieli</text>
      <text x="100" y="120" text-anchor="middle" class="donut-center">${fmt(total).replace(/,\d+/, '')}</text></svg>
    <div class="legend-list">${cats.map(([c, v]) => `<button class="leg" data-action="open-cat" data-cat="${esc(c)}"><i class="sw" style="background:${catColor(c)}"></i>
      <span class="grow">${ICON[c] || ''} ${esc(c)}</span><b>${fmt(v)}</b><span class="pct">${Math.round(v / total * 100)}%</span><span class="chev">›</span></button>`).join('')}</div></div>`;
}

const subsSorted = () => [...state.subscriptions].sort((a, b) => a.next.localeCompare(b.next));
const monthlyCost = s => s.cycle === 'yearly' ? s.amount / 12 : s.cycle === 'weekly' ? s.amount * 52 / 12 : s.amount;
function subRow(s) {
  const d = daysUntil(s.next);
  const when = d < 0 ? `<span class="warn">restant de ${-d} ${-d === 1 ? 'zi' : 'zile'}</span>` : d === 0 ? '<span class="warn">azi</span>' : d === 1 ? 'mâine' : `în ${d} zile`;
  return `<div class="row"><button class="row-btn grow" data-action="edit-sub" data-id="${s.id}">
      <span class="ic">${ICON[s.category] || '🔁'}</span>
      <span class="grow"><b>${esc(s.name)}</b><small>${fmt(s.amount)}/${CYCLE[s.cycle]} · ${fmtDate(s.next)} · ${when}</small></span></button>
    <button class="btn small" data-action="pay-sub" data-id="${s.id}">Plătit</button></div>`;
}

const VIEWS = {
  home() {
    const list = txInMonth(ui.month), s = sums(list);
    const byCat = {};
    list.filter(t => t.type === 'expense').forEach(t => byCat[t.category] = (byCat[t.category] || 0) + t.amount);
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const upcoming = subsSorted().filter(x => daysUntil(x.next) <= 10);
    const recent = [...state.transactions].sort(byDateDesc).slice(0, 5);
    const [bigInt, bigDec] = fmt(s.bal).replace(/\s?RON/, '').split(',');
    return `<section class="hero">${monthSwitcher()}
        <div class="label">Rămas luna asta</div>
        <div class="big">${bigInt}<small>,${bigDec || '00'} lei</small></div>
        <div class="pair"><div class="pill inc"><small>↑ Venituri</small><b>${fmt(s.inc)}</b></div>
          <div class="pill exp"><small>↓ Cheltuieli</small><b>${fmt(s.exp)}</b></div></div></section>
      ${upcoming.length ? `<section class="card"><h2>Plăți care urmează <small>${upcoming.length}</small></h2>${upcoming.map(subRow).join('')}</section>` : ''}
      <section class="card"><h2>Unde s-au dus banii <small>apasă o categorie</small></h2>${cats.length ? donut(cats, s.exp) : empty('Nicio cheltuială în luna asta.')}</section>
      <section class="card"><h2>Ultimele 6 luni</h2>${chart6()}</section>
      <section class="card"><h2>Ultimele tranzacții</h2>${recent.length ? recent.map(txRow).join('') : empty('Apasă + ca să adaugi prima tranzacție.')}</section>`;
  },

  tx() {
    let list = txInMonth(ui.month);
    if (ui.txFilter !== 'all') list = list.filter(t => t.type === ui.txFilter);
    list.sort(byDateDesc);
    const chip = (v, l) => `<button class="chip ${ui.txFilter === v ? 'on' : ''}" data-action="tx-filter" data-v="${v}">${l}</button>`;
    let html = '', day = '';
    for (const t of list) {
      if (t.date !== day) { if (day) html += '</section>'; day = t.date; html += `<div class="day-h">${fmtDate(day)}</div><section class="card">`; }
      html += txRow(t);
    }
    if (day) html += '</section>';
    return `<button class="btn block import-btn" data-action="bank-pick">📄 Importă extras Revolut</button>
      ${monthSwitcher()}<div class="chips">${chip('all', 'Toate')}${chip('expense', 'Cheltuieli')}${chip('income', 'Venituri')}</div>
      ${html || `<section class="card">${empty('Nicio tranzacție în luna asta.')}</section>`}`;
  },

  subs() {
    const list = subsSorted(), tot = list.reduce((a, s) => a + monthlyCost(s), 0);
    return `<div class="cards2"><div class="stat"><small>Pe lună</small><b>${fmt(tot)}</b></div>
      <div class="stat"><small>Pe an</small><b>${fmt(tot * 12)}</b></div></div>
      <section class="card">${list.length ? list.map(subRow).join('') : empty('Niciun abonament. Apasă + ca să adaugi (ex: Netflix, Spotify, abonament telefon, sală).')}</section>
      ${list.length ? '<p class="hint muted">Apasă „Plătit” când se ia banii: se adaugă automat la cheltuieli și trece la următoarea dată.</p>' : ''}`;
  },

  scan() {
    if (ui.ocr) return `<section class="card center"><img src="${ui.ocr.preview}" class="preview" alt="">
      <p id="ocr-status">${esc(ui.ocr.status)}</p><div class="progress"><div id="ocr-bar" style="width:${Math.round(ui.ocr.progress * 100)}%"></div></div></section>`;
    if (ui.review) return reviewView();
    const recent = [...state.receipts].sort(byDateDesc).slice(0, 15);
    return `<section class="card center scan-hero"><div class="big-ic">🧾</div>
        <p>Pune bonul pe o suprafață plată, cu lumină bună, și încadrează-l cât mai drept.</p>
        <button class="btn primary block" data-action="scan-camera">📷 Fă poză la bon</button>
        <button class="btn block" data-action="scan-gallery">🖼️ Alege din galerie</button>
        <button class="btn ghost block" data-action="manual-receipt">✍️ Introdu bonul manual</button></section>
      <section class="card"><h2>Bonuri salvate</h2>${recent.length ? recent.map(r => `<button class="row" data-action="view-receipt" data-id="${r.id}">
        <span class="ic">🧾</span><span class="grow"><b>${esc(r.store || 'Magazin')}</b><small>${fmtDate(r.date)} · ${r.items.length} ${r.items.length === 1 ? "produs" : "produse"}</small></span>
        <span class="amt expense">−${fmt(r.total)}</span></button>`).join('') : empty('Niciun bon salvat încă.')}</section>`;
  },

  stats() {
    const ranges = {m: 'Luna asta', 3: '3 luni', 12: '12 luni', all: 'Tot'};
    let from = '0000';
    if (ui.statsRange === 'm') from = monthKey(todayISO()) + '-01';
    else if (ui.statsRange !== 'all') from = shiftMonth(monthKey(todayISO()), -(+ui.statsRange - 1)) + '-01';
    const recs = state.receipts.filter(r => r.date >= from);
    const chips = `<div class="chips">${Object.entries(ranges).map(([k, l]) => `<button class="chip ${ui.statsRange === k ? 'on' : ''}" data-action="stats-range" data-v="${k}">${l}</button>`).join('')}</div>`;
    if (!recs.length) return chips + `<section class="card">${empty('Nu ai bonuri salvate în perioada asta. Scanează câteva bonuri și aici vezi ce cumperi des, cât dai pe produse și la ce magazin.')}</section>`;

    const total = recs.reduce((a, r) => a + r.total, 0);
    const prods = {}, stores = {};
    for (const r of [...recs].sort((a, b) => a.date.localeCompare(b.date))) {
      const st = r.store || 'Necunoscut';
      stores[st] = (stores[st] || 0) + r.total;
      for (const it of r.items) {
        const k = productKey(it.name); if (!k) continue;
        const p = prods[k] ||= {name: it.name, count: 0, spent: 0, min: Infinity, max: 0, last: 0, stores: new Set()};
        p.name = it.name; p.count++; p.spent += it.price; p.last = it.price;
        p.min = Math.min(p.min, it.price); p.max = Math.max(p.max, it.price); p.stores.add(st);
      }
    }
    const P = Object.values(prods);
    const bySpend = [...P].sort((a, b) => b.spent - a.spent).slice(0, 10);
    const byCount = [...P].filter(p => p.count > 1).sort((a, b) => b.count - a.count || b.spent - a.spent).slice(0, 10);
    const storeList = Object.entries(stores).sort((a, b) => b[1] - a[1]).map(([s, v]) => [esc(s), v]);
    return `${chips}
      <div class="cards2"><div class="stat"><small>Total la market</small><b>${fmt(total)}</b></div>
        <div class="stat"><small>${recs.length} bonuri · media</small><b>${fmt(total / recs.length)}</b></div></div>
      <section class="card"><h2>Pe ce dai cei mai mulți bani</h2>${barList(bySpend.map(p => [`${esc(p.name)} <span class="muted">×${p.count}</span>`, p.spent]))}</section>
      <section class="card"><h2>Ce cumperi des</h2>${byCount.length ? byCount.map(p => `<div class="row"><span class="ic">${p.count}×</span>
        <span class="grow"><b>${esc(p.name)}</b><small>${p.min === p.max ? fmt(p.last) : `${fmt(p.min)} – ${fmt(p.max)}, ultima dată ${fmt(p.last)}`} · ${esc([...p.stores].join(', '))}</small></span></div>`).join('')
        : empty('Încă nu ai produse cumpărate de mai multe ori.')}</section>
      <section class="card"><h2>Pe magazine</h2>${barList(storeList)}</section>`;
  },
};

/* ---------- detaliu categorie ---------- */
const PRESETS = {
  Transport: ['Benzină','Abonament STB','Metrou','Bolt / Uber','Taxi','Parcare','Rovinietă','Service auto','Tren'],
  'Utilități': ['Curent','Gaz','Apă','Internet','Telefon','Întreținere','Gunoi','Cablu TV'],
  'Locuință': ['Chirie','Rată','Reparații','Mobilier','Curățenie'],
  'Sănătate': ['Farmacie','Medic','Stomatolog','Analize','Sală'],
  Market: ['Lidl','Kaufland','Mega Image','Carrefour','Profi','Auchan','Penny'],
  Haine: ['Haine','Încălțăminte','Accesorii'],
  'Distracție': ['Cinema','Concert','Ieșit cu prietenii','Jocuri','Vacanță'],
  Abonamente: ['Netflix','Spotify','HBO Max','YouTube Premium','iCloud'],
  Salariu: ['Salariu','Bonus','Prime'],
};
const FAVORITE_LABEL = {Restaurant: 'Restaurantul tău preferat', Market: 'Magazinul tău preferat', 'Distracție': 'Ce faci cel mai des'};
const groupKey = t => productKey(t.note || '') || '—';
function noteSuggestions(cat) {
  const freq = {};
  for (const t of state.transactions) if (t.category === cat && t.note) {
    const k = groupKey(t); (freq[k] ||= {name: t.note, n: 0}).n++;
  }
  const hist = Object.values(freq).sort((a, b) => b.n - a.n).map(x => x.name);
  const seen = new Set(), out = [];
  for (const n of [...hist, ...(PRESETS[cat] || [])]) { const k = productKey(n); if (!seen.has(k)) { seen.add(k); out.push(n); } }
  return out.slice(0, 10);
}
function rangeTest(range) {
  if (range === 'm') return t => monthKey(t.date) === ui.month;
  const from = range === 'all' ? '0000' : shiftMonth(ui.month, -(+range - 1)) + '-01', to = ui.month + '-31';
  return t => t.date >= from && t.date <= to;
}
const RANGE_LABEL = {m: 'Luna', 3: '3 luni', 6: '6 luni', 12: '12 luni', all: 'Tot'};
const RANGE_ORDER = ['m', '3', '6', '12', 'all'];

function viewDetail() {
  const {cat, range, group} = ui.detail;
  const all = state.transactions.filter(t => t.category === cat);
  const list = all.filter(rangeTest(range)).sort(byDateDesc);
  const type = list[0]?.type || (CATS.income.includes(cat) && !CATS.expense.includes(cat) ? 'income' : 'expense');
  const total = list.reduce((a, t) => a + t.amount, 0);
  const chips = `<div class="chips">${RANGE_ORDER.map(k => `<button class="chip ${range === k ? 'on' : ''}" data-action="detail-range" data-v="${k}">${RANGE_LABEL[k]}</button>`).join('')}</div>`;

  // comparație cu luna trecută
  let cmp = '';
  if (range === 'm') {
    const prev = all.filter(t => monthKey(t.date) === shiftMonth(ui.month, -1)).reduce((a, t) => a + t.amount, 0);
    if (prev > 0) {
      const d = (total - prev) / prev * 100, up = d > 0;
      cmp = `<div class="cmp ${up === (type === 'expense') ? 'bad' : 'good'}">${up ? '▲' : '▼'} ${Math.abs(Math.round(d))}% față de ${MONTHS[+shiftMonth(ui.month, -1).slice(5) - 1].toLowerCase()} (${fmt(prev)})</div>`;
    }
  }
  const monthExp = sums(txInMonth(ui.month)).exp;
  const share = range === 'm' && type === 'expense' && monthExp > 0 ? ` · ${Math.round(total / monthExp * 100)}% din cheltuielile lunii` : '';

  // grupare pe detaliu
  const groups = {};
  for (const t of [...list].reverse()) {
    const k = groupKey(t), g = groups[k] ||= {key: k, name: t.note || 'Fără detaliu', n: 0, sum: 0, last: t.date, items: []};
    g.name = t.note || 'Fără detaliu'; g.n++; g.sum += t.amount; g.last = t.date; g.items.push(t);
  }
  const G = Object.values(groups).sort((a, b) => b.sum - a.sum);
  const maxG = G[0]?.sum || 1;

  // preferatul (după nr. de vizite, apoi bani)
  let fav = '';
  const favPool = G.filter(g => g.key !== '—');
  if (favPool.length && (FAVORITE_LABEL[cat] || cat === 'Restaurant')) {
    const f = [...favPool].sort((a, b) => b.n - a.n || b.sum - a.sum)[0];
    fav = `<section class="card fav"><div class="fav-star">★</div><div class="grow"><small>${FAVORITE_LABEL[cat]}</small>
      <b class="fav-name">${esc(f.name)}</b>
      <div class="fav-stats"><span><b>${f.n}</b> ${f.n === 1 ? 'vizită' : 'vizite'}</span><span><b>${fmt(f.sum)}</b> total</span>
      <span><b>${fmt(f.sum / f.n)}</b> / vizită</span></div><small>Ultima dată: ${fmtDate(f.last)}</small></div></section>`;
  }

  // evoluție pe 6 luni
  const ms = [...Array(6)].map((_, i) => shiftMonth(ui.month, i - 5));
  const mv = ms.map(m => all.filter(t => monthKey(t.date) === m).reduce((a, t) => a + t.amount, 0));
  const mx = Math.max(1, ...mv);
  const trend = `<div class="mini-bars">${mv.map((v, i) => `<div class="mb"><span class="mb-v">${v ? Math.round(v) : ''}</span>
    <div class="mb-bar ${ms[i] === ui.month ? 'cur' : ''}" style="height:${Math.max(3, v / mx * 70)}px"></div><small>${MONTHS_SHORT[+ms[i].slice(5) - 1]}</small></div>`).join('')}</div>`;

  // produse de la market (din bonuri)
  let prodHtml = '';
  if (cat === 'Market') {
    const rids = new Set(list.map(t => t.receiptId).filter(Boolean));
    const P = {};
    for (const r of state.receipts) if (rids.has(r.id)) for (const it of r.items) {
      const k = productKey(it.name); const p = P[k] ||= {name: it.name, n: 0, sum: 0}; p.n++; p.sum += it.price;
    }
    const top = Object.values(P).sort((a, b) => b.sum - a.sum).slice(0, 8);
    if (top.length) prodHtml = `<section class="card"><h2>Ce produse cumperi <small>din bonuri</small></h2>${barList(top.map(p => [`${esc(p.name)} <span class="muted">×${p.n}</span>`, p.sum]))}</section>`;
  }

  const groupRows = G.map(g => {
    const open = group === g.key;
    return `<button class="grp ${open ? 'open' : ''}" data-action="detail-group" data-k="${esc(g.key)}">
        <div class="lbl"><span class="grow"><b>${esc(g.name)}</b><small>${g.n} ${g.n === 1 ? 'plată' : 'plăți'} · ${Math.round(g.sum / (total || 1) * 100)}%</small></span>
        <b>${fmt(g.sum)}</b><span class="chev">${open ? '▾' : '▸'}</span></div>
        <div class="bar"><div style="width:${Math.max(2, g.sum / maxG * 100)}%;background:${catColor(cat)}"></div></div></button>
      ${open ? `<div class="grp-items">${g.items.slice().reverse().map(txRow).join('')}</div>` : ''}`;
  }).join('');

  return `<button class="back" data-action="detail-back">‹ Înapoi</button>
    <section class="hero detail-hero">${range === 'm' ? monthSwitcher() : ''}<div class="d-ic">${ICON[cat] || '•'}</div>
      <div class="label">Total ${esc(cat).toLowerCase()} · ${range === 'm' ? 'luna asta' : (range === 'all' ? 'de la început' : 'ultimele ' + RANGE_LABEL[range])}</div>
      <div class="big">${fmt(total)}</div>
      <div class="d-sub">${list.length} ${list.length === 1 ? 'tranzacție' : 'tranzacții'}${list.length ? ` · medie ${fmt(total / list.length)}` : ''}${share}</div>${cmp}</section>
    ${chips}${fav}
    <section class="card"><h2>Pe ce s-au dus <small>apasă pentru detalii</small></h2>${G.length ? groupRows : empty('Nimic în perioada asta.')}</section>
    ${prodHtml}
    <section class="card"><h2>Ultimele 6 luni</h2>${trend}</section>
    <section class="card"><h2>Toate tranzacțiile</h2>${list.length ? list.map(txRow).join('') : empty('Nicio tranzacție.')}</section>`;
}

const productKey = n => strip(n).replace(/[^A-Z0-9% ]/g, ' ').replace(/\s+/g, ' ').trim();

/* ---------- foi (formulare) ---------- */
function sheet(html) { $('#sheet-body').innerHTML = html; $('#sheet').hidden = false; }
function closeSheet() { $('#sheet').hidden = true; $('#sheet-body').innerHTML = ''; }
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2600); }

const catOptions = (type, sel) => CATS[type].map(c => `<option ${c === sel ? 'selected' : ''}>${c}</option>`).join('');

const suggChips = cat => noteSuggestions(cat).map(n => `<button type="button" class="chip sm" data-action="pick-note" data-v="${esc(n)}">${esc(n)}</button>`).join('');
function openTx(t, presetCat) {
  const isNew = !t;
  t = t || {type: CATS.income.includes(presetCat) && !CATS.expense.includes(presetCat) ? 'income' : 'expense', amount: '', category: presetCat || 'Market', note: '',
    date: ui.month === monthKey(todayISO()) ? todayISO() : ui.month + '-01'};
  sheet(`<form id="tx-form" data-id="${isNew ? '' : t.id}"><h2>${isNew ? 'Tranzacție nouă' : 'Editează tranzacția'}</h2>
    <div class="seg"><label><input type="radio" name="type" value="expense" ${t.type === 'expense' ? 'checked' : ''}><span>Cheltuială</span></label>
      <label><input type="radio" name="type" value="income" ${t.type === 'income' ? 'checked' : ''}><span>Venit</span></label></div>
    <label>Sumă (lei)<input name="amount" inputmode="decimal" required autocomplete="off" placeholder="0,00" value="${decStr(t.amount)}"></label>
    <label>Plătit cu</label><div class="seg pay"><label><input type="radio" name="method" value="card" ${t.method !== 'cash' ? 'checked' : ''}><span>💳 Card</span></label>
      <label><input type="radio" name="method" value="cash" ${t.method === 'cash' ? 'checked' : ''}><span>💵 Cash</span></label></div>
    ${t.bank ? `<p class="hint ok">✓ Confirmată de bancă: ${esc(t.bank.desc)}</p>` : ''}
    <label>Categorie<select name="category">${catOptions(t.type, t.category)}</select></label>
    <label>Data<input type="date" name="date" required value="${t.date}"></label>
    <label>Detaliu<input name="note" placeholder="ex: Benzină, Abonament STB, Curent, numele restaurantului" value="${esc(t.note)}" autocomplete="off"></label>
    <div class="sugg" id="sugg">${suggChips(t.category)}</div>
    ${t.receiptId ? '<p class="hint muted">Tranzacția vine de la un bon scanat. Produsele le editezi din „Scanează”.</p>' : ''}
    <div class="actions">${isNew ? '' : `<button type="button" class="btn danger" data-action="del-tx" data-id="${t.id}">Șterge</button>`}
      <button type="button" class="btn" data-action="close-sheet">Anulează</button><button class="btn primary">Salvează</button></div></form>`);
}

function openSub(s) {
  const isNew = !s;
  s = s || {name: '', amount: '', cycle: 'monthly', next: todayISO(), category: 'Abonamente'};
  sheet(`<form id="sub-form" data-id="${isNew ? '' : s.id}"><h2>${isNew ? 'Abonament nou' : 'Editează abonamentul'}</h2>
    <label>Nume<input name="name" required placeholder="ex: Netflix, Spotify, Digi" value="${esc(s.name)}"></label>
    <label>Cost (lei)<input name="amount" inputmode="decimal" required placeholder="0,00" value="${decStr(s.amount)}"></label>
    <label>Se plătește<select name="cycle">${Object.entries({monthly: 'Lunar', yearly: 'Anual', weekly: 'Săptămânal'})
      .map(([k, l]) => `<option value="${k}" ${s.cycle === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label>Următoarea plată<input type="date" name="next" required value="${s.next}"></label>
    <label>Categorie<select name="category">${catOptions('expense', s.category)}</select></label>
    <div class="actions">${isNew ? '' : `<button type="button" class="btn danger" data-action="del-sub" data-id="${s.id}">Șterge</button>`}
      <button type="button" class="btn" data-action="close-sheet">Anulează</button><button class="btn primary">Salvează</button></div></form>`);
}

function openSettings() {
  const n = state.transactions.length, r = state.receipts.length, s = state.subscriptions.length;
  sheet(`<h2>Setări</h2>
    <p class="muted" style="margin-top:0">Ai ${n} tranzacții, ${r} bonuri și ${s} abonamente. Toate stau doar pe acest telefon.</p>
    <button class="btn primary block" data-action="export">⬆️ Fă backup (export)</button>
    <button class="btn block" data-action="import">⬇️ Restaurează din backup</button>
    <button class="btn block" data-action="bank-pick">📄 Importă extras Revolut</button>
    <p class="hint muted">Fă backup din când în când și salvează fișierul în iCloud Drive / Fișiere, ca să nu pierzi datele dacă schimbi telefonul.</p>
    <details><summary>Cum o pun pe ecranul telefonului</summary><ol class="small-list">
      <li>Deschide aplicația în <b>Safari</b>.</li><li>Apasă butonul <b>Partajează</b> (pătratul cu săgeată).</li>
      <li>Alege <b>Adaugă pe ecranul principal</b>.</li></ol></details>
    <button class="btn danger block" data-action="reset">Șterge toate datele</button>
    <p class="hint muted center">Bugetul Meu · versiunea ${APP_VERSION}</p>
    <div class="actions"><button class="btn" data-action="close-sheet">Închide</button></div>`);
}

/* ---------- bonuri: OCR + interpretare ---------- */
let tessP = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve();
  return tessP ||= new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    sc.onload = res;
    sc.onerror = () => { tessP = null; sc.remove(); rej(new Error('Nu am putut încărca cititorul de bonuri. Prima dată ai nevoie de internet.')); };
    document.head.appendChild(sc);
  });
}
const loadImage = file => new Promise((res, rej) => {
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => { URL.revokeObjectURL(url); res(img); };
  img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Nu am putut deschide poza.')); };
  img.src = url;
});
function drawScaled(img, maxW) {
  const k = Math.min(1, maxW / img.naturalWidth);
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}
function prepForOcr(img) {
  // gri + contrast mai mare, ajută la bonurile termice decolorate
  const c = drawScaled(img, 1800), ctx = c.getContext('2d');
  const d = ctx.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    let v = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    v = Math.max(0, Math.min(255, (v - 128) * 1.5 + 140));
    p[i] = p[i + 1] = p[i + 2] = v;
  }
  ctx.putImageData(d, 0, 0);
  return c;
}
function setOcr(status, progress) {
  if (!ui.ocr) return;
  ui.ocr.status = status; ui.ocr.progress = progress;
  const s = $('#ocr-status'), b = $('#ocr-bar');
  if (s) s.textContent = status; if (b) b.style.width = Math.round(progress * 100) + '%';
}

async function handleImage(file) {
  if (!file) return;
  ui.tab = 'scan';
  try {
    const img = await loadImage(file);
    const preview = drawScaled(img, 900).toDataURL('image/jpeg', 0.75);
    ui.ocr = {preview, status: 'Pregătesc poza…', progress: 0}; render();
    const canvas = prepForOcr(img);
    await loadTesseract();
    setOcr('Pornesc cititorul (prima dată durează mai mult)…', 0);
    const worker = await Tesseract.createWorker('ron', 1, {
      logger: m => m.status === 'recognizing text' ? setOcr('Citesc bonul…', m.progress) : setOcr('Pornesc cititorul (prima dată durează mai mult)…', m.progress || 0),
    });
    const {data} = await worker.recognize(canvas);
    await worker.terminate();
    const parsed = parseReceipt(data.text);
    ui.ocr = null;
    ui.review = {...parsed, preview, raw: data.text};
    if (!ui.review.items.length) { ui.review.items = [{name: '', price: ''}]; toast('Nu am găsit produse. Le poți scrie de mână.'); }
    else toast(`Am găsit ${parsed.items.length} produse. Verifică-le.`);
  } catch (e) {
    ui.ocr = null; toast(e.message || 'A apărut o eroare la citire.');
  }
  render();
}

const STORES = [['MEGA IMAGE','Mega Image'],['LIDL','Lidl'],['KAUFLAND','Kaufland'],['CARREFOUR','Carrefour'],['PROFI','Profi'],
  ['AUCHAN','Auchan'],['PENNY','Penny'],['SELGROS','Selgros'],['METRO CASH','Metro'],['CORA','Cora'],['ANNABELLA','Annabella'],
  ['LA DOI PASI','La doi pași'],['DM DROGERIE','dm'],['DEDEMAN','Dedeman'],['ALTEX','Altex'],['CATENA','Catena'],['DR. MAX','Dr. Max'],
  ['DR MAX','Dr. Max'],['HELP NET','Help Net'],['SENSIBLU','Sensiblu'],['PETROM','Petrom'],['OMV','OMV'],['ROMPETROL','Rompetrol'],
  ['LUKOIL','Lukoil'],['MOL ROMANIA','MOL'],['MCDONALD','McDonald\'s'],['KFC','KFC'],['JUMBO','Jumbo'],['PEPCO','Pepco'],['ACTION','Action']];
const SKIP = /(SUB\s*TOTAL|TOTAL|T\s?\.?V\s?\.?A|C\s?\.?I\s?\.?F|COD FISCAL|COD IDENTIFICARE|NUMERAR|\bCARD\b|\bREST\b|BON FISCAL|NR\.?\s*BON|\bCASA\b|CASIER|ARTICOL|PLATA CU|MOD PLATA|PLATA CARD|PLATA NUMERAR|PLATIT|BANCA|ID UNIC|REG\.?\s*COM|NR\.?\s*REG|\bSTR\b|STRADA|\bJUD\b|\bTEL\b|MULTUMIM|CHITANTA|TRANZACT|AUTORIZ|\bVISA\b|MASTERCARD|\bS\.?R\.?L\b|\bS\.\s?A\b|ROMANIA|ADRESA|PUNCT DE LUCRU|SECTOR|\bBL\.|BUCURESTI|\bORA\b|\bDATA\b|CLIENT|FIDELITATE|PUNCTE|SOLD|\bEUR\b|\bBANI\b)/;
const DISCOUNT = /(REDUCERE|DISCOUNT|PROMO|STORNO|\bRED\b|ANULARE)/;
const PRICE_END = /(-?\d{1,4}[.,]\d{2})\s*[A-Z]?\s*$/i;
const QTY_UNIT = /(\d+(?:[.,]\d{1,3})?)\s*(?:BUC\.?|KG|BU|L)?\s*[xX*]\s*(\d{1,4}[.,]\d{2})\s*$/;
const letterCount = s => (strip(s).replace(/\b(BUC|KG|BU|RON|LEI|X|L|G|ML|BUCATI)\b/g, '').match(/[A-Z]/g) || []).length;
function cleanName(s) {
  return s.replace(/^\s*\d{4,}\s+/, '')                                   // cod produs la început
    .replace(/\s+\d+(?:[.,]\d+)?\s*(?:BUC\.?|KG|L)?\s*[xX*]\s*\d+[.,]\d{2}.*$/i, '') // "2 x 3,50" la final
    .replace(/[|_*#=~]+/g, ' ').replace(/\s+/g, ' ').replace(/^[\s.,:;-]+|[\s.,:;-]+$/g, '').slice(0, 60);
}

function parseReceipt(text) {
  const lines = text.split(/\r?\n/)
    .map(l => l.replace(/(\d)\s*([.,])\s*(\d{2})(?!\d)/g, '$1$2$3').replace(/\s+/g, ' ').trim())
    .filter(l => l.length > 1);
  const out = {store: '', date: todayISO(), total: null, items: []};
  const U = strip(text);
  for (const [k, v] of STORES) if (U.includes(k)) { out.store = v; break; }

  let m = text.match(/\b(\d{2})[./-](\d{2})[./-](\d{4})\b/);
  if (m && +m[2] >= 1 && +m[2] <= 12 && +m[1] <= 31) out.date = `${m[3]}-${m[2]}-${m[1]}`;
  else if ((m = text.match(/\b(20\d{2})[./-](\d{2})[./-](\d{2})\b/))) out.date = `${m[1]}-${m[2]}-${m[3]}`;
  if (out.date > todayISO() || out.date < '2000') out.date = todayISO();

  let pending = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], L = strip(raw), pm = raw.match(PRICE_END), nl = letterCount(raw);
    if (/\bTOTAL\b/.test(L) && !/SUB\s*TOTAL/.test(L) && !/TVA/.test(L)) {
      const all = L.match(/\d{1,5}[.,]\d{2}/g);
      if (all && out.total == null) { out.total = num(all[all.length - 1]); break; } // după TOTAL nu mai sunt produse
      continue;
    }
    if (pm && num(pm[1]) < 0) {                       // reducere pe produsul anterior
      const last = out.items[out.items.length - 1];
      if (last && (DISCOUNT.test(L) || nl < 3)) last.price = Math.round((last.price + num(pm[1])) * 100) / 100;
      pending = null; continue;
    }
    if (nl >= 3) {
      if (SKIP.test(L) || DISCOUNT.test(L)) { pending = null; continue; }
      if (pm) {
        const name = cleanName(raw.slice(0, pm.index)) || pending;
        if (name && letterCount(name) >= 2) out.items.push({name, price: num(pm[1])});
        pending = null;
      } else pending = cleanName(raw);
    } else if (pm) {                                  // rând doar cu cantitate/preț
      const next = lines[i + 1];
      const nextIsItem = next && letterCount(next) >= 3 && PRICE_END.test(next) && !SKIP.test(strip(next));
      const q = raw.match(QTY_UNIT);           // se termină cu prețul unitar (format „2 BUC x 3,50”)
      if (pending && (!q || !nextIsItem)) {
        const price = q ? Math.round(num(q[1]) * num(q[2]) * 100) / 100 : num(pm[1]);
        out.items.push({name: pending, price});
        pending = null;
      }
    }
  }
  out.items = out.items.filter(it => it.price > 0 && it.price < 10000);
  return out;
}

function reviewView() {
  const r = ui.review;
  const sum = r.items.reduce((a, i) => a + (num(i.price) || 0), 0);
  return `<form id="receipt-form" class="card"><h2>${r.id ? 'Editează bonul' : 'Verifică bonul'}</h2>
    ${r.preview ? `<details><summary>Vezi poza</summary><img src="${r.preview}" class="preview" alt=""></details>` : ''}
    <label>Magazin<input name="store" list="stores" placeholder="ex: Lidl" value="${esc(r.store)}"></label>
    <datalist id="stores">${[...new Set([...state.receipts.map(x => x.store).filter(Boolean), ...STORES.map(s => s[1])])].map(s => `<option value="${esc(s)}">`).join('')}</datalist>
    <label>Data<input type="date" name="date" required value="${r.date}"></label>
    <h3>Produse</h3>
    <div id="items">${r.items.map((it, i) => `<div class="item"><input class="it-name" placeholder="Produs" value="${esc(it.name)}">
      <input class="it-price" inputmode="decimal" placeholder="0,00" value="${decStr(it.price)}">
      <button type="button" class="x" data-action="rc-del" data-i="${i}" aria-label="Șterge produsul">×</button></div>`).join('')}</div>
    <button type="button" class="btn small" data-action="rc-add">+ Adaugă produs</button>
    <div class="totals">Suma produselor: <b id="rc-sum">${fmt(sum)}</b>
      <label>Total pe bon (lei)<input name="total" inputmode="decimal" placeholder="${decStr(sum.toFixed(2))}" value="${decStr(r.total)}"></label>
      <p class="hint warn" id="rc-diff"></p></div>
    ${r.raw ? `<details><summary>Textul citit din poză</summary><pre>${esc(r.raw)}</pre></details>` : ''}
    <div class="actions">${r.id ? `<button type="button" class="btn danger" data-action="del-receipt" data-id="${r.id}">Șterge bonul</button>` : ''}
      <button type="button" class="btn" data-action="rc-cancel">Renunță</button><button class="btn primary">Salvează</button></div></form>`;
}
function syncReview() {
  const f = $('#receipt-form'); if (!f || !ui.review) return;
  ui.review.store = f.store.value.trim();
  ui.review.date = f.date.value || todayISO();
  ui.review.total = f.total.value.trim() === '' ? null : num(f.total.value);
  ui.review.items = [...f.querySelectorAll('.item')].map(row => ({name: $('.it-name', row).value, price: $('.it-price', row).value}));
}
function updateReviewSum() {
  syncReview();
  const r = ui.review, sum = r.items.reduce((a, i) => a + (num(i.price) || 0), 0);
  $('#rc-sum').textContent = fmt(sum);
  $('#rc-diff').textContent = r.total != null && !isNaN(r.total) && Math.abs(sum - r.total) > 0.05
    ? `Suma produselor diferă de total cu ${fmt(Math.abs(sum - r.total))}. Verifică prețurile.` : '';
}
function saveReceipt() {
  syncReview();
  const r = ui.review;
  const items = r.items.map(i => ({name: i.name.trim(), price: num(i.price)})).filter(i => i.name && i.price > 0);
  if (!items.length) return toast('Adaugă cel puțin un produs cu preț.');
  const sum = Math.round(items.reduce((a, i) => a + i.price, 0) * 100) / 100;
  const total = r.total > 0 ? r.total : sum;
  const note = r.store || 'Cumpărături';
  if (r.id) {
    const rec = state.receipts.find(x => x.id === r.id);
    Object.assign(rec, {store: r.store, date: r.date, items, total});
    const tx = state.transactions.find(t => t.id === rec.txId);
    if (tx) Object.assign(tx, {amount: total, date: r.date, note});
  } else {
    const rid = uid(), tid = uid(), created = new Date().toISOString();
    state.receipts.push({id: rid, txId: tid, store: r.store, date: r.date, items, total, created});
    state.transactions.push({id: tid, type: 'expense', amount: total, category: 'Market', date: r.date, note, receiptId: rid, created});
  }
  save(); ui.review = null; toast('Bon salvat ✓'); render();
}

/* ---------- backup ---------- */
async function exportData() {
  const name = `bugetul-meu-backup-${todayISO()}.json`;
  const blob = new Blob([JSON.stringify(state)], {type: 'application/json'});
  const file = new File([blob], name, {type: 'application/json'});
  if (navigator.canShare && navigator.canShare({files: [file]})) {
    try { await navigator.share({files: [file], title: name}); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function importData(file) {
  try {
    const d = JSON.parse(await file.text());
    if (d.v !== 1 || !Array.isArray(d.transactions) || !Array.isArray(d.receipts) || !Array.isArray(d.subscriptions)) throw 0;
    if (!confirm(`Backup cu ${d.transactions.length} tranzacții, ${d.receipts.length} bonuri, ${d.subscriptions.length} abonamente. Înlocuiesc datele de acum?`)) return;
    state = d; save(); closeSheet(); render(); toast('Date restaurate ✓');
  } catch { toast('Fișierul nu e un backup valid.'); }
}

/* ---------- evenimente ---------- */
const findTx = id => state.transactions.find(t => t.id === id);
const ACTIONS = {
  tab: el => { ui.tab = el.dataset.tab; ui.detail = null; render(); scrollTo(0, 0); },
  'open-cat': el => { ui.detail = {tab: ui.tab, cat: el.dataset.cat, range: 'm', group: null}; render(); scrollTo(0, 0); },
  'detail-back': () => { ui.detail = null; render(); scrollTo(0, 0); },
  'detail-range': el => { ui.detail.range = el.dataset.v; ui.detail.group = null; render(); },
  'detail-group': el => { ui.detail.group = ui.detail.group === el.dataset.k ? null : el.dataset.k; render(); },
  'pick-note': el => { const f = $('#tx-form'); f.note.value = el.dataset.v; f.amount.value || f.amount.focus(); },
  month: el => { ui.month = shiftMonth(ui.month, +el.dataset.d); render(); },
  'tx-filter': el => { ui.txFilter = el.dataset.v; render(); },
  'stats-range': el => { ui.statsRange = el.dataset.v; render(); },
  fab: () => ui.detail && ui.detail.tab === ui.tab ? openTx(null, ui.detail.cat) : ui.tab === 'subs' ? openSub() : openTx(),
  'edit-tx': el => {
    const t = findTx(el.dataset.id);
    if (t.receiptId && state.receipts.some(r => r.id === t.receiptId)) return ACTIONS['view-receipt']({dataset: {id: t.receiptId}});
    openTx(t);
  },
  'del-tx': el => {
    const t = findTx(el.dataset.id);
    if (!confirm('Ștergi tranzacția?')) return;
    state.transactions = state.transactions.filter(x => x.id !== t.id);
    if (t.receiptId) state.receipts = state.receipts.filter(r => r.id !== t.receiptId);
    save(); closeSheet(); render();
  },
  'edit-sub': el => openSub(state.subscriptions.find(s => s.id === el.dataset.id)),
  'del-sub': el => {
    if (!confirm('Ștergi abonamentul? Plățile deja înregistrate rămân.')) return;
    state.subscriptions = state.subscriptions.filter(s => s.id !== el.dataset.id);
    save(); closeSheet(); render();
  },
  'pay-sub': el => {
    const s = state.subscriptions.find(x => x.id === el.dataset.id);
    state.transactions.push({id: uid(), type: 'expense', amount: s.amount, category: s.category, date: todayISO(),
      note: s.name, subId: s.id, created: new Date().toISOString()});
    s.next = addCycle(s.next, s.cycle, s.day);
    save(); render(); toast(`${s.name}: plată înregistrată. Următoarea pe ${fmtDate(s.next)}.`);
  },
  'scan-camera': () => $('#in-camera').click(),
  'scan-gallery': () => $('#in-gallery').click(),
  'manual-receipt': () => { ui.review = {store: '', date: todayISO(), total: null, items: [{name: '', price: ''}]}; render(); },
  'view-receipt': el => {
    const r = state.receipts.find(x => x.id === el.dataset.id);
    closeSheet(); ui.tab = 'scan';
    ui.review = {id: r.id, store: r.store, date: r.date, total: r.total, items: r.items.map(i => ({...i}))};
    render(); scrollTo(0, 0);
  },
  'rc-add': () => { syncReview(); ui.review.items.push({name: '', price: ''}); render(); const n = document.querySelectorAll('.it-name'); n[n.length - 1]?.focus(); },
  'rc-del': el => { syncReview(); ui.review.items.splice(+el.dataset.i, 1); render(); updateReviewSum(); },
  'rc-cancel': () => { ui.review = null; render(); },
  'del-receipt': el => {
    if (!confirm('Ștergi bonul și cheltuiala lui?')) return;
    const r = state.receipts.find(x => x.id === el.dataset.id);
    state.receipts = state.receipts.filter(x => x.id !== r.id);
    state.transactions = state.transactions.filter(t => t.id !== r.txId);
    save(); ui.review = null; render();
  },
  settings: openSettings,
  'close-sheet': closeSheet,
  export: exportData,
  import: () => $('#in-import').click(),
  reset: () => {
    if (!confirm('Ștergi TOATE datele? Nu se poate anula. (Fă întâi un backup.)')) return;
    state = {v: 1, transactions: [], subscriptions: [], receipts: []}; save(); closeSheet(); render();
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (el) { e.preventDefault(); ACTIONS[el.dataset.action]?.(el, e); return; }
  if (e.target.id === 'sheet') closeSheet();
});

document.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, id = f.dataset.id;
  if (f.id === 'tx-form') {
    const amount = num(f.amount.value);
    if (!(amount > 0)) return toast('Scrie o sumă validă.');
    const data = {type: f.type.value, amount, category: f.category.value, date: f.date.value, note: f.note.value.trim(), method: f.method.value};
    if (id) Object.assign(findTx(id), data);
    else state.transactions.push({id: uid(), created: new Date().toISOString(), ...data});
    ui.month = monthKey(data.date);
    save(); closeSheet(); render(); toast('Salvat ✓');
  } else if (f.id === 'sub-form') {
    const amount = num(f.amount.value);
    if (!(amount > 0)) return toast('Scrie un cost valid.');
    const data = {name: f.name.value.trim(), amount, cycle: f.cycle.value, next: f.next.value, category: f.category.value, day: fromISO(f.next.value).getDate()};
    if (id) Object.assign(state.subscriptions.find(s => s.id === id), data);
    else state.subscriptions.push({id: uid(), ...data});
    save(); closeSheet(); render(); toast('Salvat ✓');
  } else if (f.id === 'receipt-form') saveReceipt();
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.name === 'type' && t.form?.id === 'tx-form') { t.form.category.innerHTML = catOptions(t.value, t.value === 'income' ? 'Salariu' : 'Market'); $('#sugg').innerHTML = suggChips(t.form.category.value); }
  if (t.name === 'category' && t.form?.id === 'tx-form') $('#sugg').innerHTML = suggChips(t.value);
  if (t.id === 'in-camera' || t.id === 'in-gallery') { handleImage(t.files[0]); t.value = ''; }
  if (t.id === 'in-import') { if (t.files[0]) importData(t.files[0]); t.value = ''; }
});
document.addEventListener('input', e => {
  if (e.target.closest('#receipt-form') && (e.target.classList.contains('it-price') || e.target.name === 'total')) updateReviewSum();
});

/* ---------- pornire ---------- */
render();
try {
  const prev = localStorage.getItem('bm-version');
  if (prev && prev !== APP_VERSION) setTimeout(() => toast(`Aplicația s-a actualizat la versiunea ${APP_VERSION} ✓`), 600);
  localStorage.setItem('bm-version', APP_VERSION);
} catch {}
navigator.storage?.persist?.().catch(() => {});
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
