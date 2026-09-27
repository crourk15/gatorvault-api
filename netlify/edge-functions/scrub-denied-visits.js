/**
 * Last-mile scrub for iOS Home NOW / recruiting hub / player plates.
 * Capacitor hits gatorvaultinsider.com/api/* (Netlify → Render). Even when
 * Render is clean, WKWebView URLCache / stale CDN can replay
 * Tranard × Auburn stones. Scrub visits, ticker, battle/heat, offers here.
 */
const DENIED = [{ slug: 'tranard-roberts', nameRe: /tranard\s+roberts/i, schoolRe: /auburn/i }];

const APP_STORE_UPDATE_RE = /1\.0\.29|update in the App Store/i;
const SEASON_STANDING = '3-0 · first SEC home Saturday';
const TICKER_FALLBACK = {
  ok: true,
  status: 'ready',
  items: [
    'Game — Ole Miss Saturday — 3:30 PM · ABC',
    'Visitors — Easton Royal',
    `Season — ${SEASON_STANDING}`,
  ],
  nowWeek: [
    { key: 'game', label: 'Game', items: ['Ole Miss Saturday — 3:30 PM · ABC'] },
    { key: 'visitors', label: 'Visitors', items: ['Easton Royal'] },
    { key: 'season', label: 'Season', items: [SEASON_STANDING] },
  ],
  meta: { endpoint: 'ticker', cacheReason: 'now-edge-fallback' },
};

function isTickerPath(pathname) {
  return String(pathname || '').startsWith('/api/recruiting/hub/ticker');
}

function isHubBundlePath(pathname) {
  return String(pathname || '').startsWith('/api/recruiting/hub/bundle');
}

function isHubCommitsPath(pathname) {
  return String(pathname || '').startsWith('/api/recruiting/hub/commits');
}

function isHubHeroPath(pathname) {
  return String(pathname || '').startsWith('/api/recruiting/hub/hero');
}

const OV_2028 = {
  classRank: '—',
  blueChip: '100%',
  commits: '2',
  commitLabel: 'Commits',
  avgRating: '89.8',
};

function pin2028Overview(ov) {
  const base = ov && typeof ov === 'object' ? ov : {};
  const count = Number.parseInt(String(base.commits ?? ''), 10) || 0;
  if (count >= 2 && String(base.avgRating || '') === OV_2028.avgRating) return base;
  return { ...base, ...OV_2028 };
}

/** iOS last-good / URLCache can keep the Armani-only 2028 plate. Pin Cyion on the wire. */
const CYION_2028_COMMIT = {
  id: 'cyion-smith',
  name: 'Cyion Smith',
  position: 'S',
  rating: '89.5',
  rankNote: '4★ S · Blountstown, FL · #250 natl · #25 S · #29 FL',
  metaLine: '4★ S · Blountstown, FL · #250 natl · #25 S · #29 FL',
  skinny:
    'Cyion Smith committed to Florida as a 4-star S out of Blountstown, FL. Listed at 6-2 / 175 · #250 nationally · #25 among Ss · In-state get.',
  commitDate: 'Sep 26, 2026',
  statusBadge: 'Committed',
  profileUrl: '/vault/recruiting/player/cyion-smith',
  inState: true,
  stars: 4,
};

function commitListHasSlug(items, slug) {
  if (!Array.isArray(items)) return false;
  const key = String(slug || '').toLowerCase();
  return items.some((row) => String(row?.id || row?.slug || '').toLowerCase() === key);
}

function yearFromRequest(url) {
  const raw = url?.searchParams?.get('year') || url?.searchParams?.get('class_year');
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function heal2028CommitPayload(data, year) {
  if (!data || typeof data !== 'object') return { data, changed: false };
  if (Number(year) !== 2028) return { data, changed: false };
  let changed = false;
  const out = { ...data };
  if (Array.isArray(out.items) && !commitListHasSlug(out.items, 'cyion-smith')) {
    out.items = [...out.items, CYION_2028_COMMIT];
    changed = true;
  }
  if (Array.isArray(out.commits) && !commitListHasSlug(out.commits, 'cyion-smith')) {
    out.commits = [...out.commits, CYION_2028_COMMIT];
    changed = true;
    if (out.classOverview && typeof out.classOverview === 'object') {
      out.classOverview = { ...out.classOverview, commits: String(out.commits.length) };
    }
  }
  if (Array.isArray(out.players)) {
    const next = out.players.filter((row) => String(row?.slug || row?.id || '').toLowerCase() !== 'cyion-smith');
    if (next.length !== out.players.length) {
      out.players = next;
      out.count = next.length;
      changed = true;
    }
  }
  if (Number(year) === 2028 && out.classOverview) {
    const pinned = pin2028Overview(out.classOverview);
    if (pinned !== out.classOverview) {
      out.classOverview = pinned;
      changed = true;
    }
  }
  if (out.classOverviewAll && typeof out.classOverviewAll === 'object') {
    const key = out.classOverviewAll[2028] != null ? 2028 : '2028';
    if (out.classOverviewAll[key]) {
      const pinned = pin2028Overview(out.classOverviewAll[key]);
      if (pinned !== out.classOverviewAll[key]) {
        out.classOverviewAll = { ...out.classOverviewAll, [key]: pinned };
        changed = true;
      }
    }
  }
  if (Array.isArray(out.ticker)) {
    const next = out.ticker.map((line) =>
      typeof line === 'string' ? line.replace(/\d+ commits locked for 2028/, '2 commits locked for 2028') : line
    );
    if (next.some((line, i) => line !== out.ticker[i])) {
      out.ticker = next;
      changed = true;
    }
  }
  return { data: out, changed };
}

function isAppStoreUpdateLine(text) {
  return APP_STORE_UPDATE_RE.test(String(text || ''));
}

function stripAppStoreUpdateLines(lines) {
  if (!Array.isArray(lines)) return lines;
  return lines.filter((line) => !isAppStoreUpdateLine(typeof line === 'string' ? line : ''));
}

function stripAppStoreUpdateFromNowWeek(nowWeek) {
  if (!Array.isArray(nowWeek)) return { nowWeek, changed: false };
  let changed = false;
  const next = nowWeek
    .map((row) => {
      if (!row || typeof row !== 'object') return row;
      const items = Array.isArray(row.items) ? row.items.filter((s) => !isAppStoreUpdateLine(s)) : [];
      if (JSON.stringify(items) !== JSON.stringify(row.items || [])) changed = true;
      return { ...row, items };
    })
    .filter((row) => row && row.label && Array.isArray(row.items) && row.items.length);
  const hasSeason = next.some((row) => String(row.key || '').toLowerCase() === 'season' || row.label === 'Season');
  if (!hasSeason) {
    next.push({ key: 'season', label: 'Season', items: [SEASON_STANDING] });
    changed = true;
  }
  return { nowWeek: next, changed };
}

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
    const next = stripAppStoreUpdateLines(scrubTickerLines(out.items));
    if (next.length !== out.items.length) changed = true;
    out.items = next;
  }
  if (Array.isArray(out.items) && out.items.length && out.items[0] && typeof out.items[0] === 'object') {
    const next = scrubMovementItems(out.items);
    if (next.length !== out.items.length) changed = true;
    out.items = next;
  }
  if (Array.isArray(out.ticker)) {
    const next = stripAppStoreUpdateLines(scrubTickerLines(out.ticker));
    if (next.length !== out.ticker.length) changed = true;
    out.ticker = next;
  }
  if (Array.isArray(out.nowWeek)) {
    const stripped = stripAppStoreUpdateFromNowWeek(out.nowWeek);
    if (stripped.changed) changed = true;
    out.nowWeek = stripped.nowWeek;
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
  // FutureCast / Lab soft plates
  for (const key of ['targets', 'players', 'highPriority', 'closing', 'chase', 'items']) {
    if (!Array.isArray(out[key])) continue;
    const next = out[key].map((row) => {
      if (!row || typeof row !== 'object') return row;
      const id = String(row.id || row.slug || '');
      const name = String(row.name || row.fullName || '');
      if (!/tranard/i.test(id + name)) return row;
      const copy = { ...row };
      if (Array.isArray(copy.competingSchools)) {
        copy.competingSchools = scrubSchoolArray(copy.competingSchools, 'tranard-roberts');
      }
      if (Array.isArray(copy.competitors)) {
        copy.competitors = scrubSchoolArray(copy.competitors, 'tranard-roberts');
      }
      if (copy.battle && typeof copy.battle === 'object' && /auburn/i.test(String(copy.battle.competitorName || ''))) {
        copy.battle = { ...copy.battle, competitorName: null, competitor: null };
      }
      return scrubHeatOrBattleRow(copy);
    });
    if (JSON.stringify(next) !== JSON.stringify(out[key])) changed = true;
    out[key] = next;
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

function tickerFallbackResponse() {
  const headers = new Headers();
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store, must-revalidate');
  headers.set('pragma', 'no-cache');
  headers.set('x-gv-visit-scrub', 'now-edge-fallback');
  return new Response(JSON.stringify(TICKER_FALLBACK), { status: 200, headers });
}

export default async (request, context) => {
  const url = new URL(request.url);
  const origin = new URL(`https://gatorvault-api.onrender.com${url.pathname}${url.search}`);
  origin.searchParams.set('gvScrub', 't11');

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
    if (isTickerPath(url.pathname)) return tickerFallbackResponse();
    return context.next();
  }

  const contentType = upstream.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (isTickerPath(url.pathname)) return tickerFallbackResponse();
    return upstream;
  }
  if (isTickerPath(url.pathname) && !upstream.ok) {
    return tickerFallbackResponse();
  }

  let payload;
  try {
    payload = await upstream.json();
  } catch {
    if (isTickerPath(url.pathname)) return tickerFallbackResponse();
    return upstream;
  }

  let { data, changed } = scrubPayload(payload, url.pathname);
  if (isHubBundlePath(url.pathname) || isHubCommitsPath(url.pathname) || isHubHeroPath(url.pathname)) {
    const healed = heal2028CommitPayload(data, yearFromRequest(url));
    if (healed.changed) {
      data = healed.data;
      changed = true;
    }
  }
  const body = JSON.stringify(data);
  const headers = new Headers(upstream.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store, must-revalidate');
  headers.set('pragma', 'no-cache');
  headers.set('x-gv-visit-scrub', changed ? '1' : '0');
  // Do not Clear-Site-Data on every hub hit — thrashing WKWebView cache contributed
  // to flaky post-reinstall sign-in ("Load failed") while API was also 502-flapping.
  if (changed) headers.set('clear-site-data', '"cache"');
  headers.delete('content-length');
  headers.delete('etag');
  headers.delete('age');

  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
};
