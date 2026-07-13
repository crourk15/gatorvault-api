/**
 * CollegeFootballData (CFBD) HTTP client — Florida player season + game stats.
 * Auth: Authorization: Bearer ${CFBD_API_KEY}
 */

const CFBD_BASE = 'https://api.collegefootballdata.com';
const TEAM = 'Florida';

function getCfbdApiKey() {
  return String(process.env.CFBD_API_KEY || process.env.COLLEGE_FOOTBALL_DATA_API_KEY || '').trim();
}

function hasCfbdApiKey() {
  return Boolean(getCfbdApiKey());
}

function currentCfbdSeason(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  return m >= 8 ? y : y - 1;
}

function seasonsToFetch(now = new Date(), lookback = 4) {
  const current = currentCfbdSeason(now);
  const out = [];
  for (let i = 0; i < lookback; i += 1) out.push(current - i);
  return out;
}

async function cfbdGet(pathname, query = {}) {
  const key = getCfbdApiKey();
  if (!key) {
    const err = new Error('CFBD_API_KEY missing');
    err.code = 'CFBD_NO_KEY';
    throw err;
  }
  const url = new URL(pathname.startsWith('http') ? pathname : `${CFBD_BASE}${pathname}`);
  for (const [k, v] of Object.entries(query)) {
    if (v == null || v === '') continue;
    url.searchParams.set(k, String(v));
  }
  const resp = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${key}`,
    },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    const err = new Error(`CFBD ${resp.status} ${pathname}: ${body.slice(0, 200)}`);
    err.status = resp.status;
    throw err;
  }
  return resp.json();
}

async function fetchFloridaPlayerSeasonStats(year) {
  return cfbdGet('/stats/player/season', {
    year,
    team: TEAM,
    seasonType: 'both',
  });
}

async function fetchFloridaGamePlayerStats(year) {
  return cfbdGet('/games/players', {
    year,
    team: TEAM,
    seasonType: 'both',
  });
}

module.exports = {
  CFBD_BASE,
  TEAM,
  getCfbdApiKey,
  hasCfbdApiKey,
  currentCfbdSeason,
  seasonsToFetch,
  cfbdGet,
  fetchFloridaPlayerSeasonStats,
  fetchFloridaGamePlayerStats,
};
