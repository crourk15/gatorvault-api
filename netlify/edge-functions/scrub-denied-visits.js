/**
 * Last-mile scrub for iOS Home NOW / recruiting hub / player plates.
 * Capacitor hits gatorvaultinsider.com/api/* (Netlify → Render). Even when
 * Render is clean, WKWebView URLCache / stale CDN can replay
 * Tranard × Auburn stones. Scrub visits, ticker, battle/heat, offers here.
 */
const DENIED = [{ slug: 'tranard-roberts', nameRe: /tranard\s+roberts/i, schoolRe: /auburn/i }];

function isDeniedPair(nameOrSlug, schoolOrText) {
  const name = String(nameOrSlug || '');
  const school = String(schoolOrText || '');
  return DENIED.some(
    (r) => (r.slug === name.toLowerCase() || r.nameRe.test(name)) && r.schoolRe.test(school)
  );
}

function isDeniedText(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  return DENIED.some((r) => r.nameRe.test(t) && r.schoolRe.test(t));
}

function schoolOf(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v !== 'object') return String(v || '');
  const nested =
    v.team && typeof v.team === 'object' ? v.team.name || v.team.fullName || '' : '';
  return String(v.school || v.schoolName || v.visitSchool || v.host || nested || v.name || v.fullName || '');
}

function scrubTickerLines(lines) {
  if (!Array.isArray(lines)) return lines;
  return lines.filter((line) => !isDeniedText(line));
}

function scrubMovementItems(items) {
  if (!Array.isArray(items)) return items;
  return items.filter((item) => {
    if (!item || typeof item !== 'object') return true;
    const blob = `${item.name || ''} ${item.summary || ''} ${item.detail || ''} ${item.school || ''}`;
    return !isDeniedText(blob);
  });
}

function scrubSchoolArray(arr, slug) {
  if (!Array.isArray(arr)) return arr;
  return arr.filter((v) => !isDeniedPair(slug || 'tranard-roberts', schoolOf(v)));
}

function scrubHeatOrBattleRow(row) {
  if (!row || typeof row !== 'object') return row;
  const id = String(row.id || row.slug || '');
  const name = String(row.name || '');
  if (!DENIED.some((r) => r.slug === id.toLowerCase() || r.nameRe.test(name))) return row;
  const out = { ...row };
  if (Array.isArray(out.competitors)) {
    out.competitors = out.competitors.filter((c) => !/auburn/i.test(schoolOf(c)));
  }
  if (out.battle && typeof out.battle === 'object') {
    const battle = { ...out.battle };
    if (/auburn/i.test(String(battle.competitorName || ''))) {
      const next = out.competitors && out.competitors[0] ? out.competitors[0] : null;
      battle.competitorName = next ? schoolOf(next) || null : null;
      battle.competitor = next && next.score != null ? next.score : null;
    }
    out.battle = battle;
  }
  return out;
}

function scrubPlayerObj(player) {
  if (!player || typeof player !== 'object') return player;
  const slug = String(player.slug || player.id || 'tranard-roberts');
  if (!/tranard-roberts/i.test(slug) && !/tranard\s+roberts/i.test(String(player.name || player.fullName || ''))) {
    return player;
  }
  const out = { ...player };
  if (Array.isArray(out.visits)) out.visits = scrubSchoolArray(out.visits, slug);
  if (Array.isArray(out.visitHistory)) out.visitHistory = scrubSchoolArray(out.visitHistory, slug);
  if (Array.isArray(out.competitors)) out.competitors = scrubSchoolArray(out.competitors, slug);
  if (Array.isArray(out.offers)) out.offers = scrubSchoolArray(out.offers, slug);
  if (Array.isArray(out.offerList)) out.offerList = scrubSchoolArray(out.offerList, slug);
  if (Array.isArray(out.topTeams)) out.topTeams = scrubSchoolArray(out.topTeams, slug);
  if (Array.isArray(out.on3TopTeams)) out.on3TopTeams = scrubSchoolArray(out.on3TopTeams, slug);
  if (Array.isArray(out.competingSchools)) out.competingSchools = scrubSchoolArray(out.competingSchools, slug);
  return out;
}

function scrubPayload(data, pathname) {
  if (!data || typeof data !== 'object') return { data, changed: false };
  let changed = false;
  const out = Array.isArray(data) ? data.slice() : { ...data };

  if (Array.isArray(out.items) && out.items.length && typeof out.items[0] === 'string') {
    const next = scrubTickerLines(out.items);
    if (next.length !== out.items.length) changed = true;
    out.items = next;
  }
  if (Array.isArray(out.items) && out.items.length && out.items[0] && typeof out.items[0] === 'object') {
    const next = scrubMovementItems(out.items);
    if (next.length !== out.items.length) changed = true;
    out.items = next;
  }
  if (Array.isArray(out.ticker)) {
    const next = scrubTickerLines(out.ticker);
    if (next.length !== out.ticker.length) changed = true;
    out.ticker = next;
  }
  if (Array.isArray(out.movementFeed)) {
    const next = scrubMovementItems(out.movementFeed);
    if (next.length !== out.movementFeed.length) changed = true;
    out.movementFeed = next;
  }
  if (Array.isArray(out.heatIndex)) {
    const next = out.heatIndex.map(scrubHeatOrBattleRow);
    if (JSON.stringify(next) !== JSON.stringify(out.heatIndex)) changed = true;
    out.heatIndex = next;
  }
  if (Array.isArray(out.battleBoard)) {
    const next = out.battleBoard.map(scrubHeatOrBattleRow);
    if (JSON.stringify(next) !== JSON.stringify(out.battleBoard)) changed = true;
    out.battleBoard = next;
  }
  if (Array.isArray(out.battles)) {
    const next = out.battles.map(scrubHeatOrBattleRow);
    if (JSON.stringify(next) !== JSON.stringify(out.battles)) changed = true;
    out.battles = next;
  }

  const slugMatch = String(pathname || '').match(/\/(?:players|player|intelligence)\/([^/]+)/i);
  const slug = slugMatch ? decodeURIComponent(slugMatch[1]) : '';
  const playerBlob = out.player || out.intelligence || out;
  if (/tranard-roberts/i.test(slug) || /tranard-roberts/i.test(JSON.stringify(playerBlob))) {
    if (out.player) {
      const next = scrubPlayerObj(out.player);
      if (JSON.stringify(next) !== JSON.stringify(out.player)) changed = true;
      out.player = next;
    }
    if (out.intelligence) {
      const next = scrubPlayerObj(out.intelligence);
      if (JSON.stringify(next) !== JSON.stringify(out.intelligence)) changed = true;
      out.intelligence = next;
    }
    if (out.visits) {
      const next = scrubSchoolArray(out.visits, 'tranard-roberts');
      if (next.length !== out.visits.length) changed = true;
      out.visits = next;
    }
    if (out.competitors) {
      const next = scrubSchoolArray(out.competitors, 'tranard-roberts');
      if (next.length !== out.competitors.length) changed = true;
      out.competitors = next;
    }
    if (out.offers) {
      const next = scrubSchoolArray(out.offers, 'tranard-roberts');
      if (next.length !== out.offers.length) changed = true;
      out.offers = next;
    }
    if (out.highSchoolProfile) {
      const hsp = { ...out.highSchoolProfile };
      let hChanged = false;
      if (Array.isArray(hsp.visitHistory)) {
        const next = scrubSchoolArray(hsp.visitHistory, 'tranard-roberts');
        if (next.length !== hsp.visitHistory.length) hChanged = true;
        hsp.visitHistory = next;
      }
      if (Array.isArray(hsp.offers)) {
        const next = scrubSchoolArray(hsp.offers, 'tranard-roberts');
        if (next.length !== hsp.offers.length) hChanged = true;
        hsp.offers = next;
      }
      if (hChanged) {
        changed = true;
        out.highSchoolProfile = hsp;
      }
    }
  }

  return { data: out, changed };
}

export default async (request, context) => {
  const url = new URL(request.url);
  const origin = new URL(`https://gatorvault-api.onrender.com${url.pathname}${url.search}`);
  origin.searchParams.set('gvScrub', 't10');

  let upstream;
  try {
    upstream = await fetch(origin.toString(), {
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });
  } catch {
    return context.next();
  }

  const contentType = upstream.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return upstream;
  }

  let payload;
  try {
    payload = await upstream.json();
  } catch {
    return upstream;
  }

  const { data, changed } = scrubPayload(payload, url.pathname);
  const body = JSON.stringify(data);
  const headers = new Headers(upstream.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store, must-revalidate');
  headers.set('pragma', 'no-cache');
  headers.set('x-gv-visit-scrub', changed ? '1' : '0');
  headers.set('clear-site-data', '"cache"');
  headers.delete('content-length');
  headers.delete('etag');
  headers.delete('age');

  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
};
