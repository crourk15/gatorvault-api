/**
 * Weekly betting lines — The Odds API when keyed, static schedule fallback.
 */
const fs = require('fs');
const path = require('path');
const { POSTGAME_HOURS, pickNextGame, pickLastCompleted } = require('./betting-next-game');

const LINES_PATH = path.join(__dirname, '..', 'data', 'betting', 'lines.json');
const FINALS_PATH = path.join(__dirname, '..', 'data', 'betting', 'finals.json');

/** Native fetch on Node 18+ (Codemagic). Lazy node-fetch only on older runtimes. */
async function httpFetch(url, opts = {}) {
  const impl = typeof fetch === 'function' ? fetch : require('node-fetch');
  if (typeof fetch === 'function' && opts.timeout && !opts.signal) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), opts.timeout);
    try {
      return await impl(url, { ...opts, signal: ac.signal });
    } finally {
      clearTimeout(timer);
    }
  }
  return impl(url, opts);
}

const FANDUEL_AFFILIATE = process.env.FANDUEL_AFFILIATE_URL || 'https://sportsbook.fanduel.com/navigation/ncaaf';
const HARD_ROCK_BET_URL =
  process.env.HARD_ROCK_BET_URL || 'https://www.hardrock.bet/sportsbook/football/ncaaf/';
const ODDS_API_KEY = process.env.ODDS_API_KEY || process.env.THE_ODDS_API_KEY || '';

const SPORTSBOOKS = [
  { id: 'fanduel', name: 'FanDuel', url: FANDUEL_AFFILIATE },
  { id: 'hardrock', name: 'Hard Rock Bet', url: HARD_ROCK_BET_URL }
];

const STATIC_LINES = [
  {
    id: 'uf-fau-2026-w1',
    week: 1,
    game: 'Florida vs FAU',
    opponent: 'FAU',
    date: '2026-09-05T23:45:00.000Z',
    venue: 'Ben Hill Griffin Stadium',
    // Market consensus ~Sep 1–2 2026 (BetMGM / USA Today / Athletic): UF -26.5 to -27.5, O/U 59.5
    spread: { line: 'UF -27.5', uf: -27.5 },
    total: 59.5,
    moneyline: { uf: -4500, opp: +1600 },
    sportsbookUrl: FANDUEL_AFFILIATE,
    sportsbookLinks: SPORTSBOOKS,
    source: 'schedule',
    completed: true,
    homeScore: 66,
    awayScore: 21,
    status: 'Final',
    live: false,
    scoreSource: 'official'
  },
  {
    id: 'uf-campbell-2026-w2',
    week: 2,
    game: 'Florida vs Campbell',
    opponent: 'Campbell',
    date: '2026-09-12T21:30:00.000Z',
    venue: 'Ben Hill Griffin Stadium',
    spread: null,
    total: null,
    moneyline: null,
    sportsbookUrl: FANDUEL_AFFILIATE,
    sportsbookLinks: SPORTSBOOKS,
    source: 'schedule'
  },
  {
    id: 'uf-lsu-2026',
    week: null,
    game: 'Florida vs LSU',
    opponent: 'LSU',
    date: '2026-10-10T23:30:00.000Z',
    venue: 'Ben Hill Griffin Stadium',
    spread: { line: 'UF -2.5', uf: -2.5 },
    total: 51.5,
    moneyline: { uf: -135, opp: +115 },
    sportsbookUrl: FANDUEL_AFFILIATE,
    sportsbookLinks: SPORTSBOOKS,
    source: 'schedule'
  },
  {
    id: 'uf-fsu-2026',
    week: null,
    game: 'Florida vs Florida State',
    opponent: 'Florida State',
    date: '2026-11-29T20:00:00.000Z',
    venue: 'Doak Campbell Stadium',
    spread: { line: 'UF +3.5', uf: 3.5 },
    total: 54.5,
    moneyline: { uf: +145, opp: -170 },
    sportsbookUrl: FANDUEL_AFFILIATE,
    sportsbookLinks: SPORTSBOOKS,
    source: 'schedule'
  }
];

async function fetchLiveOdds() {
  if (!ODDS_API_KEY) return null;
  try {
    const url =
      'https://api.the-odds-api.com/v4/sports/americanfootball_ncaaf/odds' +
      `?apiKey=${encodeURIComponent(ODDS_API_KEY)}&regions=us&markets=spreads,totals,h2h&oddsFormat=american`;
    const res = await httpFetch(url, { timeout: 15000 });
    if (!res.ok) return null;
    const data = await res.json();
    const ufGames = (data || []).filter((g) =>
      /florida gators/i.test(`${g.home_team} ${g.away_team}`)
    );
    if (!ufGames.length) return null;
    return ufGames.map(mapOddsApiGame);
  } catch (e) {
    console.warn('[betting-lines] Odds API failed:', e.message);
    return null;
  }
}

function mapOddsApiGame(g) {
  const book = (g.bookmakers || [])[0];
  const spreadM = book?.markets?.find((m) => m.key === 'spreads');
  const totalM = book?.markets?.find((m) => m.key === 'totals');
  const h2hM = book?.markets?.find((m) => m.key === 'h2h');
  const ufIsHome = /florida gators/i.test(g.home_team);
  const opponent = ufIsHome ? g.away_team : g.home_team;
  const spreadOut = spreadM?.outcomes?.find((o) => /florida/i.test(o.name));
  const totalOut = totalM?.outcomes?.[0];
  const ufMl = h2hM?.outcomes?.find((o) => /florida/i.test(o.name));
  const oppMl = h2hM?.outcomes?.find((o) => !/florida/i.test(o.name));
  return {
    id: `odds-${g.id}`,
    game: `Florida vs ${opponent}`,
    opponent,
    date: g.commence_time,
    spread: spreadOut
      ? { line: `UF ${spreadOut.point > 0 ? '+' : ''}${spreadOut.point}`, uf: spreadOut.point }
      : null,
    total: totalOut?.point ?? null,
    moneyline: {
      uf: ufMl?.price ?? null,
      opp: oppMl?.price ?? null
    },
    sportsbookUrl: book?.url || FANDUEL_AFFILIATE,
    sportsbookLinks: SPORTSBOOKS,
    source: 'the-odds-api',
    bookmaker: book?.title || null
  };
}

function loadPersistedFinals() {
  try {
    const raw = JSON.parse(fs.readFileSync(FINALS_PATH, 'utf8'));
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

function persistFinal(game, overlay) {
  if (!game?.id || !overlay?.completed) return;
  const uf = Number(overlay.homeScore);
  const opp = Number(overlay.awayScore);
  if (!Number.isFinite(uf) || !Number.isFinite(opp)) return;
  const finals = loadPersistedFinals();
  const prev = finals[game.id];
  if (prev && prev.uf === uf && prev.opp === opp) return;
  finals[game.id] = {
    gameKey: game.id,
    opponent: game.opponent || null,
    uf,
    opp,
    source: overlay.scoreSource || 'espn',
    completedAt: new Date().toISOString(),
  };
  try {
    fs.mkdirSync(path.dirname(FINALS_PATH), { recursive: true });
    fs.writeFileSync(FINALS_PATH, JSON.stringify(finals, null, 2) + '\n');
  } catch (e) {
    console.warn('[betting-lines] persist final failed:', e.message);
  }
}

function applyFinal(game, finals) {
  if (!game) return null;
  const row = finals?.[game.id];
  if (!row || !Number.isFinite(Number(row.uf)) || !Number.isFinite(Number(row.opp))) {
    return game;
  }
  return {
    ...game,
    homeScore: Number(row.uf),
    awayScore: Number(row.opp),
    status: 'Final',
    completed: true,
    live: false,
    scoreSource: row.source || game.scoreSource || 'official',
  };
}

function featuredMatches(bettingGame, board) {
  if (!bettingGame || !board?.featured) return false;
  const blob = `${bettingGame.id || ''} ${bettingGame.opponent || ''} ${bettingGame.game || ''}`.toLowerCase();
  const feat = `${board.featured.id || ''} ${board.featured.opp || ''}`.toLowerCase();
  return feat
    .split(/[^a-z0-9]+/i)
    .filter((w) => w.length > 2)
    .some((w) => blob.includes(w));
}

function mergeLiveOdds(staticLines, liveGames) {
  if (!Array.isArray(liveGames) || !liveGames.length) return staticLines.slice();
  return staticLines.map((g) => {
    const hit = liveGames.find((l) => {
      const a = String(g.opponent || '').toLowerCase();
      const b = String(l.opponent || '').toLowerCase();
      return a && b && (b.includes(a) || a.includes(b.split(/\s+/)[0] || ''));
    });
    if (!hit) return g;
    return {
      ...g,
      spread: hit.spread != null ? hit.spread : g.spread,
      total: hit.total != null ? hit.total : g.total,
      moneyline: hit.moneyline != null ? hit.moneyline : g.moneyline,
      date: hit.date || g.date,
      source: hit.source || g.source,
      bookmaker: hit.bookmaker || g.bookmaker,
    };
  });
}

async function getBettingLines(now = new Date()) {
  const live = await fetchLiveOdds();
  const finals = loadPersistedFinals();
  const schedule = mergeLiveOdds(STATIC_LINES, live).map((g) => applyFinal(g, finals));
  const next = pickNextGame(schedule, now);
  const last = pickLastCompleted(schedule, now);
  let overlay = null;
  let board = null;
  try {
    const { getUfLiveBoard } = require('./uf-live-score');
    board = await getUfLiveBoard({ asOf: now });
    overlay = board?.overlay || null;
  } catch (e) {
    console.warn('[betting-lines] UF live score overlay failed:', e.message);
  }
  if (overlay?.completed && next && featuredMatches(next, board)) {
    persistFinal(next, overlay);
  }
  const nextGame =
    overlay && featuredMatches(next, board) ? { ...next, ...overlay } : next;
  const lastGame = last ? applyFinal(last, loadPersistedFinals()) : null;
  return {
    ok: true,
    liveOddsEnabled: !!ODDS_API_KEY,
    affiliateUrl: FANDUEL_AFFILIATE,
    hardRockBetUrl: HARD_ROCK_BET_URL,
    sportsbooks: SPORTSBOOKS,
    nextGame,
    lastGame,
    finals: loadPersistedFinals(),
    schedule: schedule.map((g) => (nextGame && g.id === nextGame.id ? { ...g, ...nextGame } : g)),
  };
}

function isGameZoneEnabled() {
  const v = process.env.GAME_ZONE_ENABLED;
  if (v == null || v === '') return true;
  return v === 'true' || v === '1';
}

async function refreshLines() {
  if (!isGameZoneEnabled()) {
    return { ok: false, skipped: true, reason: 'GAME_ZONE_ENABLED=false' };
  }

  let prev = null;
  try {
    prev = JSON.parse(fs.readFileSync(LINES_PATH, 'utf8'));
  } catch {
    /* first run */
  }

  const payload = await getBettingLines();
  const updatedAt = new Date().toISOString();
  const pendingTeamEvents = [];
  const announcedKickoffs = { ...(prev?.announcedKickoffs || {}) };

  for (const game of payload.schedule || []) {
    if (!game?.id || !game?.date || !prev) continue;
    const prevGame = (prev.schedule || []).find((g) => g.id === game.id);
    if (!prevGame || prevGame.date === game.date) continue;
    if (announcedKickoffs[game.id] === game.date) continue;
    pendingTeamEvents.push({
      teamEventType: 'kickoff',
      game,
      at: updatedAt,
      previousDate: prevGame.date
    });
    announcedKickoffs[game.id] = game.date;
  }

  const doc = {
    ...payload,
    updatedAt,
    refreshedAt: updatedAt,
    pendingTeamEvents,
    announcedKickoffs
  };

  fs.mkdirSync(path.dirname(LINES_PATH), { recursive: true });
  fs.writeFileSync(LINES_PATH, JSON.stringify(doc, null, 2));

  return {
    ok: true,
    processedCount: (doc.schedule || []).length,
    updatedAt,
    nextGame: doc.nextGame?.game || null,
    liveOddsEnabled: doc.liveOddsEnabled,
    pendingTeamEvents: pendingTeamEvents.length
  };
}

function consumePendingTeamEvents() {
  try {
    const doc = JSON.parse(fs.readFileSync(LINES_PATH, 'utf8'));
    const pending = Array.isArray(doc.pendingTeamEvents) ? doc.pendingTeamEvents : [];
    if (!pending.length) return [];
    doc.pendingTeamEvents = [];
    fs.writeFileSync(LINES_PATH, JSON.stringify(doc, null, 2));
    return pending;
  } catch {
    return [];
  }
}

function getLinesMeta() {
  try {
    return JSON.parse(fs.readFileSync(LINES_PATH, 'utf8'));
  } catch {
    return null;
  }
}

module.exports = {
  getBettingLines,
  refreshLines,
  getLinesMeta,
  consumePendingTeamEvents,
  pickNextGame,
  pickLastCompleted,
  applyFinal,
  LINES_PATH,
  FINALS_PATH,
  POSTGAME_HOURS,
  STATIC_LINES,
  FANDUEL_AFFILIATE,
  HARD_ROCK_BET_URL,
  SPORTSBOOKS,
  isGameZoneEnabled
};
