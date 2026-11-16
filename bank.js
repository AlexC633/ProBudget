'use strict';
/* Import extras Revolut (CSV sau Excel): potrivire cu ce ai pus manual + încadrare automată pe categorii. */

/* ---------- comercianți cunoscuți: [regex, categorie, detaliu (null = numele comerciantului)] ---------- */
const MERCHANTS = [
  [/KAUFLAND/, 'Market', 'Kaufland'], [/\bLIDL\b/, 'Market', 'Lidl'], [/MEGA ?IMAGE/, 'Market', 'Mega Image'],
  [/CARREFOUR/, 'Market', 'Carrefour'], [/\bPROFI\b/, 'Market', 'Profi'], [/AUCHAN/, 'Market', 'Auchan'],
  [/\bPENNY\b/, 'Market', 'Penny'], [/SELGROS/, 'Market', 'Selgros'], [/METRO CASH|\bMETRO\b(?!REX)/, 'Market', 'Metro'],
  [/\bCORA\b/, 'Market', 'Cora'], [/LA DOI PASI/, 'Market', 'La doi pași'], [/ANNABELLA/, 'Market', 'Annabella'],
  [/FRESHFUL/, 'Market', 'Freshful'], [/\bSPAR\b/, 'Market', 'Spar'],
  [/BOLT ?FOOD/, 'Restaurant', 'Bolt Food'], [/GLOVO/, 'Restaurant', 'Glovo'], [/\bTAZZ\b/, 'Restaurant', 'Tazz'],
  [/FOODPANDA/, 'Restaurant', 'Foodpanda'], [/UBER ?EATS/, 'Restaurant', 'Uber Eats'],
  [/\bOMV\b/, 'Transport', 'Benzină'], [/PETROM/, 'Transport', 'Benzină'], [/ROMPETROL/, 'Transport', 'Benzină'],
  [/LUKOIL/, 'Transport', 'Benzină'], [/\bMOL\b/, 'Transport', 'Benzină'], [/\bSOCAR\b/, 'Transport', 'Benzină'],
  [/GAZPROM/, 'Transport', 'Benzină'], [/METROREX/, 'Transport', 'Metrou'], [/\bSTB\b|SOC.*TRANSPORT.*BUC/, 'Transport', 'Abonament STB'],
  [/24PAY/, 'Transport', 'Bilete transport'], [/\bBOLT\b/, 'Transport', 'Bolt / Uber'], [/\bUBER\b/, 'Transport', 'Bolt / Uber'],
  [/\bCFR\b|REGIO ?CALATORI|ASTRA TRANS/, 'Transport', 'Tren'], [/PARKING|PARCARE|PARKOPEDIA/, 'Transport', 'Parcare'],
  [/ROVINIET|CNAIR/, 'Transport', 'Rovinietă'], [/WIZZ|RYANAIR|TAROM|BLUE AIR/, 'Transport', 'Avion'],
  [/HIDROELECTRICA/, 'Utilități', 'Curent'], [/\bENEL\b/, 'Utilități', 'Curent'], [/ELECTRICA/, 'Utilități', 'Curent'],
  [/\bPPC\b/, 'Utilități', 'Curent'], [/ENGIE/, 'Utilități', 'Gaz'], [/\bE\.?ON\b/, 'Utilități', 'Gaz'],
  [/APA ?NOVA|APAVITAL|COMPANIA DE APA/, 'Utilități', 'Apă'], [/\bDIGI\b|\bRCS/, 'Utilități', 'Internet'],
  [/ORANGE/, 'Utilități', 'Telefon'], [/VODAFONE/, 'Utilități', 'Telefon'], [/TELEKOM/, 'Utilități', 'Telefon'],
  [/NETFLIX/, 'Abonamente', 'Netflix'], [/SPOTIFY/, 'Abonamente', 'Spotify'], [/\bHBO|\bMAX\.COM/, 'Abonamente', 'HBO Max'],
  [/DISNEY/, 'Abonamente', 'Disney+'], [/YOUTUBE/, 'Abonamente', 'YouTube Premium'], [/APPLE\.COM|ICLOUD/, 'Abonamente', 'Apple / iCloud'],
  [/GOOGLE ?ONE|GOOGLE \*?STORAGE/, 'Abonamente', 'Google One'], [/OPENAI|CHATGPT/, 'Abonamente', 'ChatGPT'],
  [/ANTHROPIC|CLAUDE\.AI/, 'Abonamente', 'Claude'], [/AMAZON PRIME|PRIME VIDEO/, 'Abonamente', 'Amazon Prime'],
  [/VOYO/, 'Abonamente', 'Voyo'], [/ANTENA ?PLAY|AP\.RO/, 'Abonamente', 'AntenaPlay'],
  [/DR\.? ?MAX|CATENA|HELP ?NET|SENSIBLU|FARMACI|\bTEI\b|BENU|DONA/, 'Sănătate', 'Farmacie'],
  [/REGINA MARIA|MEDLIFE|SANADOR|MEDICOVER|SYNEVO|BIOCLINICA/, 'Sănătate', 'Medic'],
  [/WORLD ?CLASS|STAY ?FIT|18 ?GYM|SMART ?FIT/, 'Sănătate', 'Sală'],
  [/H ?& ?M\b|\bZARA\b|BERSHKA|PULL ?& ?BEAR|RESERVED|DECATHLON|DEICHMANN|ABOUT ?YOU|ANSWEAR|FASHION ?DAYS|SINSAY|C ?& ?A\b|NEW YORKER/, 'Haine', null],
  [/IKEA|DEDEMAN|LEROY|HORNBACH|JYSK|MOBEXPERT|BRICO/, 'Locuință', null],
  [/CINEMA ?CITY|HOLLYWOOD|IABILET|ENTERTIX|EVENTIM|STEAM|PLAYSTATION|XBOX|NINTENDO/, 'Distracție', null],
  [/MCDONALD|\bKFC\b|STARBUCKS|5 ?TO ?GO|TUCANO|SALAD ?BOX|SUBWAY|BURGER ?KING|PIZZA ?HUT|SPARTAN|PAUL\b|ARTISAN|RESTAURANT|BISTRO|\bPUB\b|TRATTORIA|PIZZERI|CAFE|COFFEE|CAFENEA|\bBAR\b|BERARIA|GRILL|SHAORMA|KEBAB|SUSHI/, 'Restaurant', null],
];

/* ---------- utilitare ---------- */
function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
function parseAmount(v) {
  let s = String(v ?? '').replace(/[\s ]/g, '').replace(/[^\d,.\-+]/g, '');
  if (!s) return NaN;
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc > -1 && ld > -1) s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (lc > -1) s = s.replace(',', '.');
  const n = parseFloat(s);
  return isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}
function parseDate(v) {
  const s = String(v ?? '').trim();
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return '';
}
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/)[0] || '';
  const delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : first.includes('\t') && !first.includes(',') ? '\t' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
const COLS = {
  type: /^(TYPE|TIP)$/, product: /^(PRODUCT|PRODUS)$/, started: /STARTED|INCEPUT|INCEPERE|INITIER/,
  completed: /COMPLETED|FINALIZ|COMPLET/, desc: /DESCRIPTION|DESCRIERE|DETALII/, amount: /^(AMOUNT|SUMA|SUMĂ|VALOARE)$/,
  fee: /^(FEE|COMISION|TAXA)$/, currency: /CURRENCY|MONEDA|VALUTA/, state: /^(STATE|STARE|STATUS)$/, balance: /BALANCE|SOLD/,
};
function mapColumns(header) {
  const H = header.map(h => strip(h).trim()), idx = {};
  for (const [k, re] of Object.entries(COLS)) idx[k] = H.findIndex(h => re.test(h));
  if (idx.started < 0) idx.started = H.findIndex(h => /DATA|DATE/.test(h));
  return idx;
}
function merchantKey(desc) {
  const w = strip(desc).replace(/[^A-Z0-9& ]/g, ' ').split(/\s+/).filter(x => x.length > 1 && !/^\d+$/.test(x)
    && !/^(TO|FROM|CATRE|LTD|SRL|SA|SC|RO|BUCURESTI|ROMANIA|ROU|ROM|PAYMENT|PLATA)$/.test(x));
  return w.slice(0, 2).join(' ');
}
const prettyName = d => d.replace(/\s+\d{3,}.*$/, '').replace(/\*/g, ' ').replace(/\s+/g, ' ').trim()
  .toLowerCase().replace(/(^|[\s&.-])\S/g, c => c.toUpperCase()).slice(0, 40);

function classify(desc, type, rtype) {
  const U = strip(desc), key = merchantKey(desc), rules = state.rules || {};
  const rule = rules[key] || rules[key.split(' ')[0]];
  if (rule && (rule.category === '__ignore' || CATS[type].includes(rule.category))) return {...rule, known: true};
  if (type === 'income') {
    if (/SALARI|SALARY|PAYROLL|WAGE/.test(U)) return {category: 'Salariu', note: 'Salariu', known: true};
    if (/REFUND/.test(rtype) || /RAMBURS|REFUND/.test(U)) return {category: 'Altele', note: 'Rambursare ' + prettyName(desc), known: true};
    return {category: 'Altele', note: prettyName(desc), known: false};
  }
  for (const [re, cat, note] of MERCHANTS) if (re.test(U)) return {category: cat, note: note || prettyName(desc), known: true};
  return {category: 'Altele', note: prettyName(desc), known: false};
}
function isInternal(rtype, product, desc) {
  const U = strip(desc), T = strip(rtype), P = strip(product);
  return /EXCHANGE|SCHIMB/.test(T) || /SAVINGS|ECONOMII|DEPOSIT|POCKET/.test(P)
    || /POCKET|VAULT|SAVINGS|PUSCULITA|SEIF|^TO RON|^TO EUR|^TO USD|EXCHANGED TO|SCHIMBAT IN/.test(U)
    || /TOPUP|TOP-UP|ALIMENTARE/.test(T);
}

/* ---------- citire fișier ---------- */
let xlsxP = null;
function loadXLSX() {
  if (window.XLSX) return Promise.resolve();
  return xlsxP ||= new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    sc.onload = res; sc.onerror = () => { xlsxP = null; sc.remove(); rej(new Error('Nu am putut încărca cititorul de Excel. Încearcă exportul în CSV.')); };
    document.head.appendChild(sc);
  });
}
async function readStatement(file) {
  let rows;
  if (/\.xlsx?$/i.test(file.name)) {
    await loadXLSX();
    const wb = XLSX.read(await file.arrayBuffer(), {type: 'array', cellDates: false});
    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header: 1, raw: false, defval: ''}).map(r => r.map(String));
  } else rows = parseCSV(await file.text());
  const hi = rows.findIndex(r => { const m = mapColumns(r); return m.amount >= 0 && m.desc >= 0; });
  if (hi < 0) throw new Error('Nu recunosc formatul. Exportă extrasul din Revolut ca Excel/CSV.');
  const c = mapColumns(rows[hi]), out = [];
  for (const r of rows.slice(hi + 1)) {
    const get = k => c[k] >= 0 ? (r[c[k]] ?? '').trim() : '';
    const st = strip(get('state'));
    if (/REVERT|DECLIN|FAIL|ANULAT|REFUZ|RESPINS|CANCEL/.test(st)) continue;
    const amt = parseAmount(get('amount')), fee = parseAmount(get('fee')) || 0, date = parseDate(get('started') || get('completed'));
    if (!date || !isFinite(amt) || amt === 0) continue;
    const desc = get('desc') || '(fără descriere)', rtype = get('type'), cur = (get('currency') || 'RON').toUpperCase();
    const total = Math.round((Math.abs(amt) + (amt < 0 ? Math.abs(fee) : -Math.abs(fee))) * 100) / 100;
    out.push({hash: fnv([get('started'), get('amount'), desc, get('balance'), cur].join('|')), date, amount: total,
      type: amt < 0 ? 'expense' : 'income', desc, rtype, cur, pending: /PENDING|ASTEPT/.test(st), internal: isInternal(rtype, get('product'), desc)});
  }
  if (!out.length) throw new Error('N-am găsit tranzacții în fișier.');
  return out;
}

/* ---------- potrivire cu tranzacțiile tale ---------- */
const dayDiff = (a, b) => Math.abs(Math.round((fromISO(a) - fromISO(b)) / 86400000));
function buildImport(rows) {
  const seen = new Set(state.bankSeen || []);
  const linked = state.transactions.filter(t => t.bank && t.bank.amount != null);
  const already = r => linked.some(t => t.bank.date === r.date && Math.abs(t.bank.amount - r.amount) < 0.011 && merchantKey(t.bank.desc) === merchantKey(r.desc));
  const fresh = rows.filter(r => !seen.has(r.hash) && !already(r)).sort((a, b) => a.date.localeCompare(b.date));
  const dups = rows.length - fresh.length;
  const pool = state.transactions.filter(t => !t.bank && t.method !== 'cash');
  const used = new Set();
  for (const r of fresh) {
    r.include = !r.internal;
    Object.assign(r, classify(r.desc, r.type, strip(r.rtype)));
    if (r.category === '__ignore') { r.include = false; r.internal = true; r.category = 'Altele'; }
    if (r.internal) { r.status = 'ignored'; continue; }
    const cands = pool.filter(t => !used.has(t.id) && t.type === r.type && Math.abs(t.amount - r.amount) < 0.011 && dayDiff(t.date, r.date) <= 3);
    if (cands.length) {
      const best = Math.min(...cands.map(t => dayDiff(t.date, r.date)));
      const top = cands.filter(t => dayDiff(t.date, r.date) === best);
      if (top.length === 1) { r.status = 'match'; r.matchIds = [top[0].id]; used.add(top[0].id); continue; }
      r.status = 'amb'; r.cands = top.map(t => [t.id]); r.choice = '0'; top.forEach(t => used.add(t.id)); continue;
    }
    // plată împărțită de tine în mai multe tranzacții (aceeași zi ±1)
    const near = pool.filter(t => !used.has(t.id) && t.type === r.type && dayDiff(t.date, r.date) <= 1 && t.amount < r.amount).slice(0, 12);
    const combo = findCombo(near, r.amount);
    if (combo) { r.status = 'match'; r.matchIds = combo.map(t => t.id); combo.forEach(t => used.add(t.id)); continue; }
    r.status = 'new';
  }
  const dates = fresh.map(r => r.date);
  const from = dates[0], to = dates[dates.length - 1];
  const missing = from ? state.transactions.filter(t => !t.bank && t.method !== 'cash' && t.type === 'expense' && !used.has(t.id) && t.date >= from && t.date <= to) : [];
  return {rows: fresh, dups, from, to, missing};
}
function findCombo(items, target) {
  const n = items.length;
  const rec = (start, left, acc) => {
    if (Math.abs(left) < 0.011 && acc.length >= 2) return acc;
    if (acc.length >= 4 || left < -0.011) return null;
    for (let i = start; i < n; i++) { const r = rec(i + 1, left - items[i].amount, [...acc, items[i]]); if (r) return r; }
    return null;
  };
  return rec(0, target, []);
}

/* ---------- ecranul de import ---------- */
const txById = id => state.transactions.find(t => t.id === id);
const descOf = ids => ids.map(id => { const t = txById(id); return t ? `${esc(t.note || t.category)} ${fmt(t.amount)} (${fmtDate(t.date)})` : ''; }).join(' + ');
function impRow(r, i) {
  const opts = CATS[r.type].map(c => `<option ${c === r.category ? 'selected' : ''}>${c}</option>`).join('');
  return `<div class="imp-row ${r.include ? '' : 'off'}" data-i="${i}">
    <div class="imp-top"><label class="chk"><input type="checkbox" class="imp-inc" ${r.include ? 'checked' : ''}></label>
      <span class="grow"><b>${esc(r.desc)}</b><small>${fmtDate(r.date)}${r.cur !== 'RON' ? ` · ${r.cur}` : ''}${r.pending ? ' · în așteptare' : ''}${!r.known ? ' · <span class="warn">nerecunoscut, alege tu</span>' : ''}</small></span>
      <span class="amt ${r.type}">${r.type === 'income' ? '+' : '−'}${fmt(r.amount)}</span></div>
    <div class="imp-edit"><select class="imp-cat">${opts}</select><input class="imp-note" value="${esc(r.note)}" placeholder="Detaliu"></div></div>`;
}
function viewImport() {
  const I = ui.imp, R = I.rows;
  const by = st => R.map((r, i) => [r, i]).filter(([r]) => r.status === st);
  const nw = by('new'), mt = by('match'), am = by('amb'), ig = by('ignored');
  const toAdd = R.filter(r => (r.status === 'new' || r.status === 'ignored' || (r.status === 'amb' && r.choice === 'new')) && r.include);
  return `<section class="hero"><div class="label">Extras ${I.from ? `${fmtDate(I.from)} – ${fmtDate(I.to)}` : ''}</div>
      <div class="big" style="font-size:26px">${R.length} tranzacții noi în extras</div>
      <div class="imp-sum"><span>✓ <b>${mt.length}</b> le aveai deja</span><span>＋ <b>${nw.length}</b> noi</span>
        ${am.length ? `<span>⚠ <b>${am.length}</b> de ales</span>` : ''}<span>↔ <b>${ig.length}</b> transferuri</span></div>
      ${I.dups ? `<div class="d-sub" style="margin-top:8px">${I.dups} erau deja importate și le-am sărit.</div>` : ''}</section>
    ${am.length ? `<section class="card"><h2>De ales <small>aceeași sumă, mai multe variante</small></h2>${am.map(([r, i]) => `<div class="imp-row" data-i="${i}">
      <div class="imp-top"><span class="grow"><b>${esc(r.desc)}</b><small>${fmtDate(r.date)}</small></span><span class="amt">${fmt(r.amount)}</span></div>
      ${r.cands.map((c, k) => `<label class="radio"><input type="radio" name="amb-${i}" value="${k}" ${r.choice === String(k) ? 'checked' : ''}> E aceeași cu: ${descOf(c)}</label>`).join('')}
      <label class="radio"><input type="radio" name="amb-${i}" value="new" ${r.choice === 'new' ? 'checked' : ''}> E o plată nouă</label>
      ${r.choice === 'new' ? impRow(r, i).replace('class="imp-row', 'class="imp-row nested') : ''}</div>`).join('')}</section>` : ''}
    <section class="card"><h2>Noi <small>verifică categoriile</small></h2>${nw.length ? nw.map(([r, i]) => impRow(r, i)).join('') : empty('Nimic nou: le aveai pe toate. 👌')}</section>
    ${mt.length ? `<section class="card"><details><summary>✓ ${mt.length} confirmate (le aveai deja, nu le dublez)</summary>
      ${mt.map(([r]) => `<div class="match"><small>Bancă</small><b>${esc(r.desc)} · ${fmt(r.amount)} · ${fmtDate(r.date)}</b><small>Ale tale</small><span>${descOf(r.matchIds)}</span></div>`).join('')}</details></section>` : ''}
    ${ig.length ? `<section class="card"><details><summary>↔ ${ig.length} transferuri / schimburi valutare (ignorate)</summary>
      <p class="hint muted">Bifează dacă vreuna e de fapt o cheltuială sau un venit.</p>${ig.map(([r, i]) => impRow(r, i)).join('')}</details></section>` : ''}
    ${I.missing.length ? `<section class="card warn-card"><h2>Plătite cu cardul, dar nu apar în extras</h2>
      <p class="hint muted">Poate au fost de fapt cash, sau suma e greșită. Apasă pe ele ca să le corectezi după import.</p>
      ${I.missing.map(t => `<div class="row"><span class="ic">${ICON[t.category] || '•'}</span><span class="grow"><b>${esc(t.note || t.category)}</b><small>${fmtDate(t.date)}</small></span><span class="amt">${fmt(t.amount)}</span></div>`).join('')}</section>` : ''}
    <div class="actions sticky-actions"><button class="btn" data-action="bank-cancel">Renunță</button>
      <button class="btn primary" data-action="bank-confirm">Confirmă (${toAdd.length} adăugate, ${mt.length + am.filter(([r]) => r.choice !== 'new').length} confirmate)</button></div>`;
}
function syncImport() {
  if (!ui.imp) return;
  document.querySelectorAll('.imp-row[data-i]').forEach(el => {
    const r = ui.imp.rows[+el.dataset.i], inc = el.querySelector(':scope > .imp-top .imp-inc'), cat = el.querySelector(':scope > .imp-edit .imp-cat'), note = el.querySelector(':scope > .imp-edit .imp-note');
    if (inc) r.include = inc.checked;
    if (cat) { if (cat.value !== r.category) r.known = true; r.category = cat.value; }
    if (note) r.note = note.value.trim();
  });
  document.querySelectorAll('.imp-row.nested').forEach(el => {
    const r = ui.imp.rows[+el.dataset.i];
    r.include = el.querySelector('.imp-inc').checked; r.category = el.querySelector('.imp-cat').value; r.note = el.querySelector('.imp-note').value.trim();
  });
}
function confirmImport() {
  syncImport();
  const I = ui.imp, now = new Date().toISOString();
  state.rules ||= {}; state.bankSeen ||= [];
  let added = 0, confirmed = 0;
  for (const r of I.rows) {
    const bank = {hash: r.hash, desc: r.desc, date: r.date, amount: r.amount};
    let ids = r.status === 'match' ? r.matchIds : r.status === 'amb' && r.choice !== 'new' ? r.cands[+r.choice] : null;
    if (ids) { ids.forEach(id => { const t = txById(id); if (t) { t.bank = bank; t.method = 'card'; } }); confirmed++; }
    else if (r.include) {
      state.transactions.push({id: uid(), type: r.type, amount: r.amount, category: r.category, date: r.date,
        note: r.note || r.category, method: 'card', bank, created: now});
      added++;
    }
    const key = merchantKey(r.desc);
    if (key && r.status !== 'match') {
      if (r.include && (r.status !== 'amb' || r.choice === 'new')) state.rules[key] = {category: r.category, note: r.note};
      else if (r.status === 'ignored' && !r.include && !/EXCHANGE|SCHIMB|TOPUP|ALIMENTARE/.test(strip(r.rtype))) state.rules[key] = {category: '__ignore', note: ''};
    }
    state.bankSeen.push(r.hash);
  }
  save(); ui.imp = null; render(); scrollTo(0, 0);
  toast(`Import gata: ${added} adăugate, ${confirmed} confirmate.`);
}

Object.assign(ACTIONS, {
  'bank-pick': () => { closeSheet(); $('#in-bank').click(); },
  'bank-cancel': () => { ui.imp = null; render(); },
  'bank-confirm': confirmImport,
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.id === 'in-bank' && t.files[0]) {
    const file = t.files[0]; t.value = '';
    try {
      const rows = await readStatement(file);
      ui.imp = buildImport(rows); ui.tab = 'tx'; ui.detail = null; render(); scrollTo(0, 0);
      if (!ui.imp.rows.length) { ui.imp = null; render(); toast('Extrasul ăsta era deja importat complet.'); }
    } catch (err) { toast(err.message || 'Nu am putut citi extrasul.'); }
    return;
  }
  if (!ui.imp) return;
  if (t.name?.startsWith('amb-')) { syncImport(); ui.imp.rows[+t.name.slice(4)].choice = t.value; render(); return; }
  if (t.classList.contains('imp-inc') || t.classList.contains('imp-cat')) { syncImport(); render(); }
});
