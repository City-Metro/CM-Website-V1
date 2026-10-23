/* City Metro: home-page Trip Planner + Service Status, and the /trip results page.
   Edit the settings below. Nothing here touches the Workers' own code. */
(() => {
  'use strict';
  const CFG = {
    TRIP_API: 'https://api.trip-planner.citymetro.xyz',
    ALERTS_API: 'https://ride-metro.felixfeger46.workers.dev',
    ALERTS_SITE: 'https://alerts.citymetro.xyz',
    LINE_URL: 'https://alerts.citymetro.xyz/lines/line?id=',   // + the line's slug (a, b, 76 ...)
    TRIP_SITE: 'https://trip-planner.citymetro.xyz',
    // Optional: put your own copies of the rail line images on this site (e.g. /img/lines/a.svg or a.png, named by the line's slug)
    // and set this to '/img/lines/'. They are tried first, then the image from the database. Leave '' to use the database images only.
    LOCAL_IMG_DIR: '',
    PLANNER_URL: 'https://trip-planner.citymetro.xyz/planner',   // opened as ?from=<station id>&to=<station id>
    PLANNER_HOME: 'https://trip-planner.citymetro.xyz',
    // Which field on each alerts line says "rail", "bus" or "accessibility". Tried in this order.
    KIND_FIELDS: ['type', 'category', 'kind', 'mode', 'group'],
    REFRESH_MS: 60000
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return n;
  }
  function svgIcon(d) {
    const NS = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); s.append(p); return s;
  }
  async function fetchJson(url) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
    try {
      const res = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      return data;
    } finally { clearTimeout(t); }
  }

  /* ---------- badges ---------- */
  function textOn(bg) {
    const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(String(bg || '').trim());
    if (!m) return '#fff';
    let h = m[1]; if (h.length === 3) h = [...h].map(c => c + c).join('');
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#000' : '#fff';
  }
  function shortName(l) {
    const s = String(l.name || l.id || '?').trim().replace(/^(line|route)\s+/i, '').replace(/\s+(line|route)$/i, '').trim();
    return s.length <= 3 ? s : s.charAt(0).toUpperCase();
  }
  // Line images load quietly in the background: the letter/number shows straight away, the picture replaces it
  // once it has really loaded, and a failed load is retried (a busy image host sometimes refuses a burst of
  // requests right after a page reload). If it never loads, the letter simply stays.
  const bust = u => u + (u.includes('?') ? '&' : '?') + 'r=' + Date.now();
  function loadImage(urls, onOk) {
    const list = urls.filter(Boolean); if (!list.length) return;
    // Try each address once, then once more (slightly later, with a fresh address) in case the host was briefly busy.
    const seq = [...list.map(u => ({ u, d: 0 })), ...list.map(u => ({ u, d: 1500, retry: true }))];
    let i = 0;
    const next = () => {
      if (i >= seq.length) { console.warn('City Metro: line image did not load:', list.join(' | ')); return; }
      const { u, d, retry } = seq[i++];
      setTimeout(() => {
        const im = new Image(); im.alt = '';
        im.onload = () => onOk(im); im.onerror = next;
        im.src = retry ? bust(u) : u;
      }, d);
    };
    next();
  }
  function badge(l, { small = false, href = null, title = null } = {}) {
    const bg = l.color || '#64748b';
    const node = el(href ? 'a' : 'span', { class: 'lb' + (small ? ' sm' : ''), href, title: title || l.name || null, 'aria-label': title || l.name || null }, shortName(l));
    node.style.background = bg; node.style.color = l.text_color || textOn(bg);
    if (l.iconUrl) loadImage(l.iconUrls || [l.iconUrl], im => node.replaceChildren(im));
    return node;
  }

  /* ---------- stations + plan form (home and /trip) ---------- */
  let stationsP = null;
  const getStations = () => (stationsP ||= fetchJson(CFG.TRIP_API + '/api/stations').catch(e => { stationsP = null; throw e; }));
  function findStation(list, q) {
    q = String(q || '').trim().toLowerCase(); if (!q) return null;
    if (/^\d+$/.test(q)) { const s = list.find(x => String(x.id) === q); if (s) return s; }
    const exact = list.find(s => s.name.toLowerCase() === q); if (exact) return exact;
    for (const test of [s => s.name.toLowerCase().startsWith(q), s => s.name.toLowerCase().includes(q)]) {
      const hits = list.filter(test); if (hits.length === 1) return hits[0];
    }
    return null;
  }
  // ---- "similar name" matching for the suggestion list ----
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  function lev(a, b) {
    if (!a.length) return b.length; if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  function scoreStation(name, q) {
    const n = norm(name); if (!n || !q) return 0;
    if (n === q) return 100;
    if (n.startsWith(q)) return 90;
    const words = n.split(' ');
    if (words.some(w => w.startsWith(q))) return 80;
    if (n.includes(q)) return 70;
    if (q.split(' ').every(t => n.includes(t))) return 60;
    const qc = q.replace(/ /g, ''); let i = 0;
    for (const ch of n) if (ch === qc[i]) i++;
    if (qc.length >= 3 && i === qc.length) return 40;                       // letters in order, e.g. "dtlc"
    const d = Math.min(lev(n, q), ...words.map(w => lev(w, q)));            // typos, e.g. "unoin station"
    const lim = q.length <= 4 ? 1 : Math.min(4, Math.round(q.length * 0.25));
    return d <= lim ? 30 - d : 0;
  }
  function suggest(list, q, max = 8) {
    const nq = norm(q);
    const byName = (x, y) => x.name.localeCompare(y.name);
    if (!nq) return list.slice().sort(byName).slice(0, max);
    return list.map(s => ({ s, sc: scoreStation(s.name, nq) })).filter(x => x.sc > 0)
      .sort((x, y) => y.sc - x.sc || byName(x.s, y.s)).slice(0, max).map(x => x.s);
  }
  function attachSuggest(input) {
    const ul = el('ul', { class: 'sugg', role: 'listbox', id: 'sugg-' + input.name, hidden: true });
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false'); input.setAttribute('aria-controls', ul.id);
    input.closest('.field').append(ul);
    let items = [], active = -1;
    const hide = () => { ul.hidden = true; active = -1; input.setAttribute('aria-expanded', 'false'); };
    const choose = s => { input.value = s.name; input.dataset.id = s.id; hide(); };
    const paint = () => [...ul.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
    async function show() {
      let list; try { list = await getStations(); } catch { return hide(); }
      const count = {}; list.forEach(s => { count[s.name] = (count[s.name] || 0) + 1; });
      items = suggest(list, input.value);
      ul.replaceChildren(...items.map(s => {
        const sub = s.street || (count[s.name] > 1 ? `Station ${s.id}` : '');
        const li = el('li', { role: 'option', 'aria-selected': 'false' }, el('span', { class: 'sg-name', text: s.name }), sub ? el('span', { class: 'sg-sub', text: sub }) : null);
        li.addEventListener('mousedown', e => { e.preventDefault(); choose(s); });   // keep the field focused until chosen
        return li;
      }));
      active = -1; ul.hidden = !items.length; input.setAttribute('aria-expanded', String(items.length > 0));
    }
    input.addEventListener('input', () => { delete input.dataset.id; show(); });
    input.addEventListener('focus', show);
    input.addEventListener('blur', hide);
    input.addEventListener('keydown', e => {
      if (ul.hidden) { if (e.key === 'ArrowDown') show(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % items.length; paint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % items.length; paint(); }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(items[active]); }
      else if (e.key === 'Escape') hide();
    });
  }
  async function initPlanForm() {
    const form = $('#plan-form'); if (!form) return;
    const msg = $('#plan-msg');
    const say = (...nodes) => { if (msg) msg.replaceChildren(...nodes.filter(Boolean)); };
    const { from, to } = form.elements;
    attachSuggest(from); attachSuggest(to);
    $('#plan-swap')?.addEventListener('click', () => {
      [from.value, to.value] = [to.value, from.value];
      const f = from.dataset.id, t = to.dataset.id;
      delete from.dataset.id; delete to.dataset.id;
      if (t) from.dataset.id = t; if (f) to.dataset.id = f;
    });
    // Look both stations up in the trip planner's database (by id), then open the planner on that journey.
    form.addEventListener('submit', async e => {
      e.preventDefault(); say();
      let stations;
      try { stations = await getStations(); } catch { location.href = CFG.PLANNER_HOME; return; }
      const resolve = input => {
        const byId = input.dataset.id && stations.find(s => String(s.id) === input.dataset.id);
        return byId && byId.name === input.value ? byId : findStation(stations, input.value);
      };
      const a = resolve(from), b = resolve(to);
      const bad = !a ? from : !b ? to : null;
      if (bad) {
        const alts = suggest(stations, bad.value, 4);
        say(`We couldn’t find “${bad.value.trim()}”.${alts.length ? ' Did you mean:' : ' Pick a station from the suggestions.'}`,
          ...alts.map(s => el('button', { type: 'button', class: 'sugg-btn', text: s.name, onclick: () => { bad.value = s.name; bad.dataset.id = s.id; say(); } })));
        return;
      }
      if (a.id === b.id) return say('Choose a different destination.');
      location.href = `${CFG.PLANNER_URL}?from=${encodeURIComponent(a.id)}&to=${encodeURIComponent(b.id)}`;
    });
  }

  /* ---------- Service Status (home) ---------- */
  const GROUPS = [['emergency', 'Emergency'], ['critical', 'Critical Disruptions'], ['major_outage', 'Major Disruptions'],
                  ['degraded', 'Delays'], ['maintenance', 'Planned Work'], ['operational', 'No Active Alerts']];
  function kindOf(l) {
    for (const f of CFG.KIND_FIELDS) {
      const v = l[f];
      if (typeof v === 'string' && v.trim()) {
        const s = v.toLowerCase();
        if (/bus/.test(s)) return 'bus';
        if (/access|elevator|escalator|ada/.test(s)) return 'accessibility';
        if (/rail|train|metro|subway|light|tram|rapid/.test(s)) return 'rail';
      }
    }
    const name = String(l.name || '').toLowerCase().trim();
    if (/access|elevator|escalator/.test(name + ' ' + String(l.id || '').toLowerCase())) return 'accessibility';
    if (/\bbus\b/.test(name) || /^(line|route)?\s*\d+[a-z]?\b/.test(name)) return 'bus';
    return 'rail';
  }
  // The line page uses a short slug, not the database id: "A Line" -> a, "Line 76" -> 76.
  function slugOf(l) {
    if (l.slug) return String(l.slug);
    const n = String(l.name || l.id || '').trim().toLowerCase().replace(/\s*\(.*\)\s*$/, '').replace(/^(line|route)\s+/, '').replace(/\s+(line|route)\b.*$/, '').trim();
    return n.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || String(l.id);
  }
  const lineUrl = l => CFG.LINE_URL + encodeURIComponent(slugOf(l));
  const IMG_FIELDS = ['iconUrl', 'icon', 'iconURL', 'imageUrl', 'image_url', 'image', 'logoUrl', 'logo'];
  function pickImage(l, base) {
    for (const f of IMG_FIELDS) {
      const v = l[f];
      if (typeof v === 'string' && v.trim()) { try { return new URL(v.trim(), base).href; } catch { /* try the next field */ } }
    }
    return null;
  }
  const fmtWhen = iso => iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }) + ' PT' : '';
  const cap = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
  const trim = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };

  function initStatus() {
    const body = $('#status-body'); if (!body) return;
    let kind = 'rail', data = null;
    const tabs = $$('.status-panel [role="tab"]');
    const pick = t => { kind = t.dataset.kind; tabs.forEach(x => { x.setAttribute('aria-selected', String(x === t)); x.tabIndex = x === t ? 0 : -1; }); render(); };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => pick(t));
      t.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]; pick(n); n.focus();
      });
    });

    // If the alerts list has the same line twice (same name/slug), show it once, using the more serious status.
    const RANK = { emergency: 5, critical: 4, major_outage: 3, degraded: 2, maintenance: 1, operational: 0 };
    function dedupe(list) {
      const out = [], at = new Map(), dup = [];
      for (const l of list) {
        const k = slugOf(l);
        if (!at.has(k)) { at.set(k, out.length); out.push(l); continue; }
        dup.push(l.id); const j = at.get(k);
        if ((RANK[l.status] || 0) > (RANK[out[j].status] || 0)) out[j] = l;
      }
      if (dup.length) console.info('City Metro: duplicate line entries hidden (ids):', dup.join(', '));
      return out;
    }

    function preview(all) {
      const ids = new Set(all.filter(l => kindOf(l) === kind).map(l => l.id));
      const sysWide = i => (!(i.affectedLines || []).length && !(i.affectedWaypoints || []).length) ||
        (all.length > 0 && all.every(l => (i.affectedLines || []).includes(l.id)));
      const touches = i => sysWide(i) || (i.affectedLines || []).some(id => ids.has(id));
      const sev = { emergency: 4, critical: 3, major: 2, minor: 1 };
      const inc = (data.inc || []).filter(i => i.status !== 'resolved' && touches(i))
        .sort((a, b) => (sev[b.level] || 0) - (sev[a.level] || 0) || new Date(b.updatedAt) - new Date(a.updatedAt))
        .map(i => ({ ...i, _level: i.level || 'minor', _tag: cap(i.level || 'minor') + ' incident', _when: 'Updated ' + fmtWhen(i.updatedAt) }));
      const mnt = (data.mnt || []).filter(m => (m.status === 'in_progress' || m.status === 'scheduled') && touches(m))
        .sort((a, b) => a.status === b.status ? new Date(a.startTime) - new Date(b.startTime) : a.status === 'in_progress' ? -1 : 1)
        .map(m => ({ ...m, _level: 'maintenance', _tag: m.status === 'in_progress' ? 'Maintenance in progress' : 'Scheduled maintenance',
          _when: m.status === 'in_progress' ? 'Ends ' + fmtWhen(m.endTime) : 'Starts ' + fmtWhen(m.startTime) }));
      const items = [...inc, ...mnt]; if (!items.length) return null;
      const cards = items.slice(0, 3).map(i => {
        const affected = (i.affectedLines || []).map(id => all.find(l => l.id === id)).filter(Boolean);
        const href = affected[0] ? lineUrl(affected[0]) : CFG.ALERTS_SITE;
        return el('article', { class: 'pv' },
          el('div', { class: 'pv-top' }, el('span', { class: 'pill', 'data-level': i._level, text: i._tag }), el('span', { class: 'pv-when', text: i._when })),
          el('h4', {}, el('a', { href, text: i.title || 'Service alert' })),
          i.description ? el('p', { text: trim(i.description, 140) }) : null,
          affected.length ? el('div', { class: 'lbs' }, affected.slice(0, 8).map(l => badge(l, { small: true, href: lineUrl(l), title: l.name }))) : null);
      });
      return el('section', { class: 'st-preview' }, el('h3', { text: 'Alerts preview' }), cards,
        items.length > 3 ? el('p', { class: 'st-more' }, el('a', { href: CFG.ALERTS_SITE, text: `+${items.length - 3} more alert${items.length - 3 > 1 ? 's' : ''}` })) : null);
    }

    function render() {
      if (!data) return;
      const all = data.lines, mine = dedupe(all.filter(l => kindOf(l) === kind));
      const known = new Set(GROUPS.map(g => g[0]));
      const groups = GROUPS.map(([key, label]) => {
        const ls = mine.filter(l => (known.has(l.status) ? l.status : 'operational') === key);
        return ls.length ? el('section', { class: 'st-group' }, el('h3', { text: label }),
          el('div', { class: 'lbs' }, ls.map(l => badge(l, { href: lineUrl(l), title: `${l.name}: ${label}` })))) : null;
      });
      body.replaceChildren(...[
        ...(mine.length ? groups : [el('p', { class: 'st-msg', text: `No ${kind} lines to show yet.` })]),
        preview(all),
        el('p', { class: 'st-foot' }, el('a', { class: 'btn ghost', href: CFG.ALERTS_SITE, text: 'View all alerts' }))
      ].filter(Boolean));
    }

    async function load() {
      try {
        const [st, inc, mnt, trip] = await Promise.all([
          fetchJson(CFG.ALERTS_API + '/api/status'),
          fetchJson(CFG.ALERTS_API + '/api/incidents').catch(() => []),
          fetchJson(CFG.ALERTS_API + '/api/maintenance').catch(() => []),
          fetchJson(CFG.TRIP_API + '/api/lines').catch(() => [])]);
        // Line images: the alerts line's own image first, otherwise the same line's image from the trip planner database.
        const tripImg = {};
        (Array.isArray(trip) ? trip : []).forEach(x => { const u = pickImage(x, CFG.TRIP_SITE); if (u) { tripImg[slugOf(x)] = u; tripImg[String(x.id).toLowerCase()] = u; } });
        const lines = st.lineStatuses || [];
        // Rail lines use their picture; bus lines always show their number.
        lines.forEach(l => {
          l.iconUrl = kindOf(l) === 'bus' ? null : (pickImage(l, CFG.ALERTS_SITE) || tripImg[slugOf(l)] || tripImg[String(l.id).toLowerCase()] || null);
          const s = encodeURIComponent(slugOf(l));
          l.iconUrls = l.iconUrl ? [...(CFG.LOCAL_IMG_DIR ? [CFG.LOCAL_IMG_DIR + s + '.svg', CFG.LOCAL_IMG_DIR + s + '.png'] : []), l.iconUrl] : null;
        });
        data = { lines, inc: Array.isArray(inc) ? inc : [], mnt: Array.isArray(mnt) ? mnt : [] };
        render();
      } catch {
        if (!data) body.replaceChildren(el('p', { class: 'st-msg' }, 'Service status is unavailable right now. ', el('a', { href: CFG.ALERTS_SITE, text: 'Check alerts.citymetro.xyz' })));
      }
    }
    load();
    setInterval(() => { if (!document.hidden) load(); }, CFG.REFRESH_MS);
  }

  const start = () => { initPlanForm(); initStatus(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
