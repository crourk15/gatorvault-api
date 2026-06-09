/**
 * Weekly betting lines — The Odds API when keyed, static schedule fallback.
 */
const fetch = require('node-fetch');

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
    spread: { line: 'UF -31.5', uf: -31.5 },
    total: 52.5,
    moneyline: { uf: -4500, opp: +1600 },
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
    const res = await fetch(url, { timeout: 15000 });
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

async function getBettingLines() {
  const live = await fetchLiveOdds();
  const next =
    (live && live[0]) ||
    STATIC_LINES.slice().sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  return {
    ok: true,
    liveOddsEnabled: !!ODDS_API_KEY,
    affiliateUrl: FANDUEL_AFFILIATE,
    hardRockBetUrl: HARD_ROCK_BET_URL,
    sportsbooks: SPORTSBOOKS,
    nextGame: next,
    schedule: live || STATIC_LINES
  };
}

module.exports = {
  getBettingLines,
  STATIC_LINES,
  FANDUEL_AFFILIATE,
  HARD_ROCK_BET_URL,
  SPORTSBOOKS
};
