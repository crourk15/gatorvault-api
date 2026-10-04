/**
 * Last-mile scrub for iOS Home NOW / recruiting hub / player plates.
 * Capacitor hits gatorvaultinsider.com/api/* (Netlify → Render). Even when
 * Render is clean, WKWebView URLCache / stale CDN can replay
 * Tranard × Auburn stones. Scrub visits, ticker, battle/heat, offers here.
 */
const DENIED = [{ slug: 'tranard-roberts', nameRe: /tranard\s+roberts/i, schoolRe: /auburn/i }];

const APP_STORE_UPDATE_RE = /1\.0\.29|update in the App Store/i;
const SEASON_STANDING = '4-1 · SEC home Saturday';
const BAILEY_NEWS_LINE = 'Samuel Bailey commits to Florida · No. 36';
const SC_NOW_GAME = 'South Carolina in the Swamp — 12:45 PM · SEC Network';
const STALE_NOW_NEWS_RE = /cyion\s+smith|lorenzo\s+mcmullen/i;
/** Posted Missouri final — last-good Faurot / 4-0 must not beat South Carolina week. */
const LEFTOVER_MISSOURI_NOW_RE = /missouri|faurot|4-0 heading into saturday|abc or sec network|12:00\s*[–-]\s*1:00/i;
/** Sep 21 was ABC-or-ESPN. SEC locked ABC Sep 27. Git ESPN overlay snapped NOW back. */
const MISSOURI_ESPN_NOW_RE = /missouri[\s\S]{0,80}espn|espn[\s\S]{0,80}missouri/i;

function pinMissouriAbcLine(line) {
  const text = String(line || '');
  if (!MISSOURI_ESPN_NOW_RE.test(text) && !(/3:30/i.test(text) && /espn/i.test(text) && /faurot|missouri/i.test(text))) {
    return text;
  }
  return text.replace(/\bESPN\b/g, 'ABC');
}

function leftoverMissouriBlob(data) {
  const parts = [];
  if (Array.isArray(data?.items)) parts.push(data.items.join(' '));
  if (Array.isArray(data?.ticker)) parts.push(data.ticker.join(' '));
  if (Array.isArray(data?.nowWeek)) {
    for (const row of data.nowWeek) {
      if (!row || typeof row !== 'object') continue;
      parts.push(`${row.key || ''} ${row.label || ''} ${(row.items || []).join(' ')}`);
    }
  }
  return parts.join(' ');
}

function pinLeftoverMissouriNow(data) {
  if (!data || typeof data !== 'object') return { data, changed: false };
  if (!LEFTOVER_MISSOURI_NOW_RE.test(leftoverMissouriBlob(data))) return { data, changed: false };
  const newsRow = Array.isArray(data.nowWeek)
    ? data.nowWeek.find((row) => row && (row.key === 'news' || row.label === 'News'))
    : null;
  const newsItems = Array.isArray(newsRow?.items)
    ? newsRow.items.map((s) => String(s || '').trim()).filter(Boolean)
    : [];
  const news = newsItems.some((s) => STALE_NOW_NEWS_RE.test(s)) || !newsItems.length
    ? [BAILEY_NEWS_LINE]
    : newsItems;
  return {
    data: {
      ...data,
      items: [`Game — ${SC_NOW_GAME}`, `News — ${news[0]}`, `Season — ${SEASON_STANDING}`],
      nowWeek: [
        { key: 'game', label: 'Game', items: [SC_NOW_GAME] },
        { key: 'news', label: 'News', items: news },
        { key: 'season', label: 'Season', items: [SEASON_STANDING] },
      ],
      ...(Array.isArray(data.ticker)
        ? { ticker: [`Game — ${SC_NOW_GAME}`, `News — ${news[0]}`, `Season — ${SEASON_STANDING}`] }
        : {}),
    },
    changed: true,
  };
}

function pinMissouriAbcNow(data) {
  if (!data || typeof data !== 'object') return { data, changed: false };
  const out = { ...data };
  let changed = false;

  if (Array.isArray(out.items)) {
    const next = out.items.map((line) => (typeof line === 'string' ? pinMissouriAbcLine(line) : line));
    if (next.some((line, i) => line !== out.items[i])) {
      out.items = next;
      changed = true;
    }
  }
  if (Array.isArray(out.nowWeek)) {
    const next = out.nowWeek.map((row) => {
      if (!row || typeof row !== 'object') return row;
      const items = Array.isArray(row.items) ? row.items.map((s) => pinMissouriAbcLine(String(s || ''))) : row.items;
      if (JSON.stringify(items) !== JSON.stringify(row.items)) return { ...row, items };
      return row;
    });
    if (JSON.stringify(next) !== JSON.stringify(out.nowWeek)) {
      out.nowWeek = next;
      changed = true;
    }
  }
  if (Array.isArray(out.ticker)) {
    const next = out.ticker.map((line) => (typeof line === 'string' ? pinMissouriAbcLine(line) : line));
    if (next.some((line, i) => line !== out.ticker[i])) {
      out.ticker = next;
      changed = true;
    }
  }
  return { data: out, changed };
}

const TICKER_FALLBACK = {
  ok: true,
  status: 'ready',
  items: [
    `Game — ${SC_NOW_GAME}`,
    `News — ${BAILEY_NEWS_LINE}`,
    `Season — ${SEASON_STANDING}`,
  ],
  nowWeek: [
    { key: 'game', label: 'Game', items: [SC_NOW_GAME] },
    { key: 'news', label: 'News', items: [BAILEY_NEWS_LINE] },
    { key: 'season', label: 'Season', items: [SEASON_STANDING] },
  ],
  meta: { endpoint: 'ticker', cacheReason: 'now-edge-fallback' },
};

function isTickerPath(pathname) {
  return String(pathname || '').startsWith('/api/recruiting/hub/ticker');
}

function isSchedulePath(pathname) {
  const p = String(pathname || '');
  return p === '/api/schedule' || p.startsWith('/api/schedule/');
}

function isPingPath(pathname) {
  return String(pathname || '') === '/api/ping';
}

const NOW_BUST_COOKIE = 'gv-now-bust';
const NOW_BUST_VALUE = 'scar-w6-secn';

function needsNowCacheBust(request) {
  const cookie = request?.headers?.get?.('cookie') || '';
  return !new RegExp(`(?:^|;\\s*)${NOW_BUST_COOKIE}=${NOW_BUST_VALUE}(?:;|$)`).test(cookie);
}

function applyNowCacheBust(request, headers) {
  if (!needsNowCacheBust(request)) return false;
  headers.set('clear-site-data', '"cache"');
  headers.append(
    'set-cookie',
    `${NOW_BUST_COOKIE}=${NOW_BUST_VALUE}; Max-Age=1209600; Path=/; Secure; SameSite=Lax`
  );
  headers.set('x-gv-now-bust', NOW_BUST_VALUE);
  return true;
}

function pinCurrentScarNow(data) {
  if (!data || typeof data !== 'object') return { data, changed: false };
  const next = {
    ...data,
    status: 'ready',
    items: TICKER_FALLBACK.items,
    nowWeek: TICKER_FALLBACK.nowWeek,
  };
  const changed =
    JSON.stringify(data.items || []) !== JSON.stringify(next.items) ||
    JSON.stringify(data.nowWeek || []) !== JSON.stringify(next.nowWeek);
  return { data: next, changed };
}

/** iOS last-good / URLCache can keep Cyion on NOW News after Bailey pledged. */
function pinBaileyNowNews(data) {
  if (!data || typeof data !== 'object') return { data, changed: false };
  const out = { ...data };
  let changed = false;

  if (Array.isArray(out.items)) {
    const next = out.items.map((line) => {
      if (typeof line !== 'string') return line;
      if (/^News — /i.test(line) && STALE_NOW_NEWS_RE.test(line)) {
        return `News — ${BAILEY_NEWS_LINE}`;
      }
      return line;
    });
    if (next.some((line, i) => line !== out.items[i])) {
      out.items = next;
      changed = true;
    }
  }

  if (Array.isArray(out.nowWeek)) {
    const next = out.nowWeek.map((row) => {
      if (!row || typeof row !== 'object') return row;
      const key = String(row.key || row.label || '').toLowerCase();
      const items = Array.isArray(row.items) ? row.items.map((s) => String(s || '')) : [];
      if ((key === 'news' || String(row.label || '') === 'News') && items.some((s) => STALE_NOW_NEWS_RE.test(s))) {
        return { ...row, key: 'news', label: 'News', items: [BAILEY_NEWS_LINE] };
      }
      return row;
    });
    if (JSON.stringify(next) !== JSON.stringify(out.nowWeek)) {
      out.nowWeek = next;
      changed = true;
    }
  }

  if (Array.isArray(out.ticker)) {
    const next = out.ticker.map((line) => {
      if (typeof line !== 'string') return line;
      if (/^News — /i.test(line) && STALE_NOW_NEWS_RE.test(line)) {
        return `News — ${BAILEY_NEWS_LINE}`;
      }
      return line;
    });
    if (next.some((line, i) => line !== out.ticker[i])) {
      out.ticker = next;
      changed = true;
    }
  }

  return { data: out, changed };
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
  commits: '3',
  commitLabel: 'Commits',
  avgRating: '90.8',
};

function pin2028Overview(ov) {
  const base = ov && typeof ov === 'object' ? ov : {};
  const count = Number.parseInt(String(base.commits ?? ''), 10) || 0;
  if (count >= 3) return base;
  return { ...base, ...OV_2028 };
}

/** iOS last-good / URLCache can keep the Armani-only 2028 plate. Pin Cyion + Bailey on the wire. */
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

const BAILEY_2028_COMMIT = {
  id: 'samuel-bailey',
  name: 'Samuel Bailey',
  position: 'OT',
  rating: '92.8',
  rankNote: '4★ OT · Huntsville, AL · #49 natl · #8 OT · #3 AL',
  metaLine: '4★ OT · Huntsville, AL · #49 natl · #8 OT · #3 AL',
  skinny:
    'Samuel Bailey committed to Florida as a 4-star OT out of Jemison (Huntsville, AL). Listed at 6-5.5 / 300 · #49 nationally · #8 among OTs.',
  commitDate: 'Sep 28, 2026',
  statusBadge: 'Committed',
  profileUrl: '/vault/recruiting/player/samuel-bailey',
  inState: false,
  stars: 4,
};

const VERIFIED_2028_BATTLE_SLUGS = new Set(['armani-strong', 'cyion-smith', 'samuel-bailey']);

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
  if (Array.isArray(out.items)) {
    if (!commitListHasSlug(out.items, 'cyion-smith')) {
      out.items = [...out.items, CYION_2028_COMMIT];
      changed = true;
    }
    if (!commitListHasSlug(out.items, 'samuel-bailey')) {
      out.items = [...out.items, BAILEY_2028_COMMIT];
      changed = true;
    }
  }
  if (Array.isArray(out.commits)) {
    if (!commitListHasSlug(out.commits, 'cyion-smith')) {
      out.commits = [...out.commits, CYION_2028_COMMIT];
      changed = true;
    }
    if (!commitListHasSlug(out.commits, 'samuel-bailey')) {
      out.commits = [...out.commits, BAILEY_2028_COMMIT];
      changed = true;
    }
    if (out.classOverview && typeof out.classOverview === 'object') {
      out.classOverview = { ...out.classOverview, commits: String(out.commits.length) };
    }
  }
  if (Array.isArray(out.players)) {
    const next = out.players.filter((row) => !VERIFIED_2028_BATTLE_SLUGS.has(String(row?.slug || row?.id || '').toLowerCase()));
    if (next.length !== out.players.length) {
      out.players = next;
      out.count = next.length;
      changed = true;
    }
  }
  for (const key of ['battleBoard', 'heatIndex', 'battles']) {
    if (!Array.isArray(out[key])) continue;
    const next = out[key].filter((row) => !VERIFIED_2028_BATTLE_SLUGS.has(String(row?.slug || row?.id || '').toLowerCase()));
    if (next.length !== out[key].length) {
      out[key] = next;
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
      typeof line === 'string' ? line.replace(/\d+ commits locked for 2028/, '3 commits locked for 2028') : line
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

const HERO_2028_FALLBACK = {
  ok: true,
  year: 2028,
  title: 'Florida Recruiting',
  subtitle: 'Who Florida is chasing — movement, board, and beat intel.',
  classYears: [2026, 2027, 2028],
  classOverview: { ...OV_2028 },
  classOverviewAll: { 2028: { ...OV_2028 } },
  ticker: ['3 commits locked for 2028'],
  meta: { endpoint: 'hero', cacheReason: 'hero-edge-fallback' },
};

function heroFallbackResponse() {
  const headers = new Headers();
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store, must-revalidate');
  headers.set('pragma', 'no-cache');
  headers.set('x-gv-visit-scrub', 'hero-edge-fallback');
  return new Response(JSON.stringify(HERO_2028_FALLBACK), { status: 200, headers });
}

function tickerFallbackResponse(request) {
  const headers = new Headers();
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store, must-revalidate');
  headers.set('pragma', 'no-cache');
  headers.set('x-gv-visit-scrub', 'now-edge-fallback');
  applyNowCacheBust(request, headers);
  return new Response(JSON.stringify(TICKER_FALLBACK), { status: 200, headers });
}

export default async (request, context) => {
  const url = new URL(request.url);
  const origin = new URL(`https://gatorvault-api.onrender.com${url.pathname}${url.search}`);
  origin.searchParams.set('gvScrub', 't13');

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
    if (isTickerPath(url.pathname)) return tickerFallbackResponse(request);
    if (isHubHeroPath(url.pathname) && yearFromRequest(url) === 2028) return heroFallbackResponse();
    return context.next();
  }

  const contentType = upstream.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (isTickerPath(url.pathname)) return tickerFallbackResponse(request);
    if (isHubHeroPath(url.pathname) && yearFromRequest(url) === 2028) return heroFallbackResponse();
    return upstream;
  }
  if (isTickerPath(url.pathname) && !upstream.ok) {
    return tickerFallbackResponse(request);
  }
  if (isHubHeroPath(url.pathname) && yearFromRequest(url) === 2028 && !upstream.ok) {
    return heroFallbackResponse();
  }

  let payload;
  try {
    payload = await upstream.json();
  } catch {
    if (isTickerPath(url.pathname)) return tickerFallbackResponse(request);
    if (isHubHeroPath(url.pathname) && yearFromRequest(url) === 2028) return heroFallbackResponse();
    return upstream;
  }

  if (isSchedulePath(url.pathname) || isPingPath(url.pathname)) {
    const headers = new Headers(upstream.headers);
    headers.set('content-type', 'application/json; charset=utf-8');
    headers.set('cache-control', 'no-store, must-revalidate');
    headers.set('pragma', 'no-cache');
    const busted = applyNowCacheBust(request, headers);
    headers.set('x-gv-visit-scrub', busted ? 'now-cache-bust' : '0');
    headers.delete('content-length');
    headers.delete('etag');
    headers.delete('age');
    return new Response(JSON.stringify(payload), {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  }

  let { data, changed } = scrubPayload(payload, url.pathname);
  if (isTickerPath(url.pathname) || isHubBundlePath(url.pathname) || isHubHeroPath(url.pathname)) {
    const news = pinBaileyNowNews(data);
    if (news.changed) {
      data = news.data;
      changed = true;
    }
    const week = pinLeftoverMissouriNow(data);
    if (week.changed) {
      data = week.data;
      changed = true;
    }
    if (isTickerPath(url.pathname)) {
      const scar = pinCurrentScarNow(data);
      if (scar.changed) {
        data = scar.data;
        changed = true;
      }
    }
    const abc = pinMissouriAbcNow(data);
    if (abc.changed) {
      data = abc.data;
      changed = true;
    }
  }
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
  // One-shot WKWebView URLCache bust so iOS 1.0.29 (no fetch no-store) drops last week's ticker.
  // Do not Clear-Site-Data on every hub hit — that thrashed sign-in.
  if (isTickerPath(url.pathname)) {
    applyNowCacheBust(request, headers);
  } else if (changed) {
    headers.set('clear-site-data', '"cache"');
  }
  headers.delete('content-length');
  headers.delete('etag');
  headers.delete('age');

  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
};
