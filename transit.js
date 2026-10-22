/* City Metro: home-page Trip Planner + Service Status, and the /trip results page.
   Edit the settings below. Nothing here touches the Workers' own code. */
(() => {
  'use strict';
  const CFG = {
    TRIP_API: 'https://api.trip-planner.citymetro.xyz',
    ALERTS_API: 'https://ride-metro.felixfeger46.workers.dev',
    ALERTS_SITE: 'https://alerts.citymetro.xyz',
    LINE_URL: 'https://alerts.citymetro.xyz/line?id=',   // + the line's id
    // Which field on each alerts line says "rail", "bus" or "accessibility". Tried in this order.
    KIND_FIELDS: ['type', 'category', 'kind', 'mode', 'group'],
    REFRESH_MS: 60000
  };
  const MODES = ['fastest', 'fewest_transfers', 'fewest_walking'];
  const MODE_LABEL = { fastest: 'Fastest', fewest_transfers: 'Fewest transfers', fewest_walking: 'Least walking' };
  const ICON = {
    walk: 'M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z'
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
  function badge(l, { small = false, href = null, title = null } = {}) {
    const bg = l.color || '#64748b';
    const node = el(href ? 'a' : 'span', { class: 'lb' + (small ? ' sm' : ''), href, title: title || l.name || null, 'aria-label': title || l.name || null });
    node.style.background = bg; node.style.color = l.text_color || textOn(bg);
    const letter = () => node.replaceChildren(shortName(l));
    if (l.iconUrl) {
      const img = el('img', { src: l.iconUrl, alt: '', loading: 'lazy' });
      img.addEventListener('error', letter, { once: true });
      node.append(img);
    } else letter();
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
  async function initPlanForm() {
    const form = $('#plan-form'); if (!form) return;
    $('#plan-swap')?.addEventListener('click', () => { const { from, to } = form.elements; [from.value, to.value] = [to.value, from.value]; });
    form.addEventListener('submit', e => {
      const { from, to } = form.elements;
      if (from.value.trim().toLowerCase() === to.value.trim().toLowerCase()) {
        e.preventDefault(); to.setCustomValidity('Choose a different destination.'); to.reportValidity();
        to.addEventListener('input', () => to.setCustomValidity(''), { once: true });
      }
    });
    try {
      const list = $('#station-list');
      (await getStations()).slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(s => list.append(el('option', { value: s.name })));
    } catch { /* typing still works; the results page explains any problem */ }
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
  const lineUrl = l => CFG.LINE_URL + encodeURIComponent(l.id);
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
      const all = data.lines, mine = all.filter(l => kindOf(l) === kind);
      const known = new Set(GROUPS.map(g => g[0]));
      const groups = GROUPS.map(([key, label]) => {
        const ls = mine.filter(l => (known.has(l.status) ? l.status : 'operational') === key);
        return ls.length ? el('section', { class: 'st-group' }, el('h3', { text: label }),
          el('div', { class: 'lbs' }, ls.map(l => badge(l, { href: lineUrl(l), title: `${l.name}: ${label}` })))) : null;
      });
      body.replaceChildren(
        ...(mine.length ? groups.filter(Boolean) : [el('p', { class: 'st-msg', text: `No ${kind} lines to show yet.` })]),
        preview(all),
        el('p', { class: 'st-foot' }, el('a', { class: 'btn ghost', href: CFG.ALERTS_SITE, text: 'View all alerts' })));
    }

    async function load() {
      try {
        const [st, inc, mnt] = await Promise.all([
          fetchJson(CFG.ALERTS_API + '/api/status'),
          fetchJson(CFG.ALERTS_API + '/api/incidents').catch(() => []),
          fetchJson(CFG.ALERTS_API + '/api/maintenance').catch(() => [])]);
        data = { lines: st.lineStatuses || [], inc: Array.isArray(inc) ? inc : [], mnt: Array.isArray(mnt) ? mnt : [] };
        render();
      } catch {
        if (!data) body.replaceChildren(el('p', { class: 'st-msg' }, 'Service status is unavailable right now. ', el('a', { href: CFG.ALERTS_SITE, text: 'Check alerts.citymetro.xyz' })));
      }
    }
    load();
    setInterval(() => { if (!document.hidden) load(); }, CFG.REFRESH_MS);
  }

  /* ---------- /trip results ---------- */
  const fmtDur = s => { const m = Math.max(1, Math.round(s / 60)); return m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m} min`; };
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  function routeView(plan, mode) {
    const r = plan.routes && plan.routes[mode];
    if (!r || !r.found) return el('p', { class: 'st-msg', text: 'No route found for this option.' });
    const chips = [plural(r.transfers, 'transfer'), `${fmtDur(r.rideSeconds)} riding`];
    if (r.walkSeconds > 0) chips.push(`${fmtDur(r.walkSeconds)} walking (${r.walkMiles} mi)`);
    if (r.waitSeconds > 0) chips.push(`${fmtDur(r.waitSeconds)} allowed for transfers`);
    const legs = (r.legs || []).map(leg => {
      if (leg.type === 'walk') {
        return el('li', { class: 'leg' }, el('div', { class: 'leg-ic' }, svgIcon(ICON.walk)),
          el('div', {}, el('h3', { text: `Walk ${fmtDur(leg.seconds)}` }), el('p', { text: `${leg.miles} mi from ${leg.from.name} to ${leg.to.name}` })));
      }
      const line = (plan.lines && plan.lines[leg.line_id]) || { id: leg.line_id, name: leg.line_id };
      const stops = leg.stops || [];
      return el('li', { class: 'leg' }, badge(line),
        el('div', {}, el('h3', { text: `Take ${line.name || line.id}${leg.headsign ? ' toward ' + leg.headsign : ''}` }),
          el('p', { text: `${leg.from.name} to ${leg.to.name} · ${plural(Math.max(1, stops.length - 1), 'stop')} · ${fmtDur(leg.seconds)}` }),
          stops.length > 2 ? el('details', {}, el('summary', { text: 'Show all stops' }), el('ol', { class: 'stops' }, stops.map(s => el('li', { text: s.name })))) : null));
    });
    return el('div', {},
      el('div', { class: 'trip-sum' }, el('span', { class: 'trip-time', text: fmtDur(r.totalSeconds) }), el('span', { class: 'chips' }, chips.map(c => el('span', { class: 'chip', text: c })))),
      r.same_as ? el('p', { class: 'st-msg', text: `This is the same route as “${MODE_LABEL[r.same_as] || r.same_as}”.` }) : null,
      el('ol', { class: 'legs' }, legs));
  }

  async function initTrip() {
    const out = $('#trip-results'); if (!out) return;
    const q = new URLSearchParams(location.search), form = $('#plan-form');
    ['from', 'to'].forEach(k => { if (q.get(k)) form.elements[k].value = q.get(k); });
    const wanted = MODES.includes(q.get('mode')) ? q.get('mode') : 'fastest';
    form.elements.mode.value = wanted;
    if (!q.get('from') || !q.get('to')) { out.replaceChildren(el('p', { class: 'st-msg', text: 'Choose where you are starting and where you are going to see your journey.' })); return; }
    out.replaceChildren(el('p', { class: 'st-msg', text: 'Finding your best routes…' }));
    try {
      const stations = await getStations();
      const a = findStation(stations, q.get('from')), b = findStation(stations, q.get('to'));
      if (!a || !b) {
        out.replaceChildren(el('p', { class: 'st-msg', text: `We couldn’t find ${!a ? '“' + q.get('from') + '”' : '“' + q.get('to') + '”'}. Pick a station from the suggestions and try again.` })); return;
      }
      form.elements.from.value = a.name; form.elements.to.value = b.name;
      document.title = `${a.name} to ${b.name} | City Metro Transit`;
      const plan = await fetchJson(`${CFG.TRIP_API}/api/plan?from_station=${a.id}&to_station=${b.id}`);
      if (plan.reason === 'same_station') { out.replaceChildren(el('p', { class: 'st-msg', text: 'Your start and destination are the same station.' })); return; }
      if (!plan.found) { out.replaceChildren(el('p', { class: 'st-msg', text: 'We couldn’t find a route between those stations.' })); return; }
      let active = wanted;
      const panel = el('div', { class: 'trip-card', role: 'tabpanel' });
      const tabs = MODES.map(m => el('button', { type: 'button', role: 'tab', class: 'mode-tab', 'data-mode': m, text: MODE_LABEL[m] }));
      const show = m => {
        active = m; tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.mode === m)));
        panel.replaceChildren(routeView(plan, m));
        q.set('mode', m); history.replaceState(null, '', '?' + q.toString());
      };
      tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.mode)));
      out.replaceChildren(
        el('h2', { class: 'trip-route', text: `${a.name} → ${b.name}` }),
        el('div', { class: 'mode-tabs', role: 'tablist', 'aria-label': 'Route options' }, tabs), panel);
      show(active);
    } catch (e) {
      out.replaceChildren(el('p', { class: 'st-msg' }, `We couldn’t plan that trip right now (${e.message}). `, el('a', { href: 'https://trip-planner.citymetro.xyz', text: 'Try the full Trip Planner' })));
    }
  }

  const start = () => { initPlanForm(); initStatus(); initTrip(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
