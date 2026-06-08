const fetch = require('node-fetch');
const { buildOn3ProfileUrl } = require('./on3-urls');

const ORG = process.env.ON3_ORG_SLUG || 'florida-gators';
const SPORT = process.env.ON3_SPORT || 'football';
const SITE_BASE = process.env.ON3_SITE_BASE || 'https://www.on3.com';

function pageUrl(classYear) {
  return `${SITE_BASE}/college/${ORG}/${SPORT}/${classYear}/commits/`;
}

function defaultHeaders(classYear) {
  return {
    Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent':
      process.env.ON3_USER_AGENT ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Referer: pageUrl(classYear)
  };
}

async function fetchHtml(url, classYear) {
  const res = await fetch(url, { headers: defaultHeaders(classYear), timeout: 45000 });
  const text = await res.text();
  if (!res.ok) throw new Error(`On3 HTTP ${res.status} for ${url}`);
  return text;
}

function extractNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('On3 page missing __NEXT_DATA__');
  return JSON.parse(match[1]);
}

function pickString(...vals) {
  for (const v of vals) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
}

function pickNumber(...vals) {
  for (const v of vals) {
    if (v == null || v === '') continue;
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

function formatHtWt(height, weight) {
  const h = pickString(height);
  const w = pickNumber(weight);
  if (h && w != null) return `${h} / ${w}`;
  return h || (w != null ? String(w) : '');
}

function normalizeOn3Row(row, classYear) {
  const player = row.player || {};
  const rating = row.rating || {};
  const status = row.status || {};
  const name = pickString(
    player.fullName,
    [player.firstName, player.lastName].filter(Boolean).join(' ')
  );
  const school = pickString(player.hometown?.abbr, player.highSchoolName, player.highSchool?.name);
  const pos = pickString(
    rating.positionAbbr,
    player.position?.abbr,
    player.position?.name,
    'ATH'
  );
  const stars = pickNumber(rating.consensusStars, rating.stars) || 3;
  const playerRating = pickNumber(rating.consensusRating, rating.rating);
  const commitDate = pickString(status.date);
  const commitDateShort = commitDate ? commitDate.slice(0, 10) : '';

  return {
    on3Id: pickString(player.key, row.recKey) || null,
    name,
    pos: pos.toUpperCase(),
    classYear: pickNumber(player.classYear, rating.year, classYear) || classYear,
    school,
    htWt: formatHtWt(player.height, player.weight),
    stars,
    rating: playerRating,
    natlRank: pickNumber(rating.consensusNationalRank, rating.nationalRank),
    posRank: pickNumber(rating.consensusPositionRank, rating.positionRank),
    stateRank: pickNumber(rating.consensusStateRank, rating.stateRank),
    inState: /,\s*FL\b/i.test(school),
    status: pickString(status.type, 'Committed').toLowerCase(),
    commitDate: commitDateShort,
    committedTo: pickString(status.committedAsset?.name, 'Florida'),
    skinny: '',
    sourceStatus: pickString(status.type)
  };
}

function normalizeOn3Player(raw, classYear) {
  if (raw && raw.player) return normalizeOn3Row(raw, classYear);
  const person = raw.person || raw.player || raw.recruit || raw;
  const name = pickString(person.fullName, person.name, raw.name);
  return {
    on3Id: pickString(person.key, person.id, raw.key) || null,
    name,
    pos: pickString(person.position?.abbr, person.pos, raw.pos, 'ATH').toUpperCase(),
    classYear: pickNumber(person.classYear, raw.classYear, classYear) || classYear,
    school: pickString(person.hometown?.abbr, person.highSchoolName, raw.school),
    htWt: pickString(raw.htWt),
    stars: pickNumber(raw.stars) || 3,
    rating: pickNumber(raw.rating),
    natlRank: pickNumber(raw.natlRank),
    posRank: pickNumber(raw.posRank),
    stateRank: pickNumber(raw.stateRank),
    inState: !!(raw.inState ?? /,\s*FL\b/i.test(raw.school)),
    status: pickString(raw.status, 'committed').toLowerCase(),
    commitDate: pickString(raw.commitDate),
    committedTo: pickString(raw.committedTo, 'Florida'),
    skinny: pickString(raw.skinny),
    sourceStatus: pickString(raw.status)
  };
}

function normalizeTeamRank(teamRank, classYear) {
  if (!teamRank) return null;
  const nationalRank = pickNumber(teamRank.nationalRankCurrent, teamRank.nationalRank);
  const secRank = pickNumber(teamRank.conferenceRankCurrent, teamRank.secRank);
  const classScore = pickNumber(teamRank.classRatingCurrent, teamRank.classScore);
  if (nationalRank == null && secRank == null && classScore == null) return null;
  return {
    classYear,
    nationalRank: nationalRank != null ? Math.round(nationalRank) : null,
    secRank: secRank != null ? Math.round(secRank) : null,
    classScore: classScore != null ? Number(classScore) : null,
    source: 'on3'
  };
}

async function fetchTeamCommits(classYear) {
  const year = parseInt(classYear, 10);
  const url = pageUrl(year);
  const html = await fetchHtml(url, year);
  const next = extractNextData(html);
  const pageProps = next?.props?.pageProps || {};
  const list = pageProps.playerList?.list || [];
  const commits = list.map((row) => normalizeOn3Row(row, year)).filter((p) => p.name);
  return { classYear: year, url, commits };
}

async function fetchTeamRankings(classYear) {
  const year = parseInt(classYear, 10);
  const url = pageUrl(year);
  const html = await fetchHtml(url, year);
  const next = extractNextData(html);
  const teamRank = next?.props?.pageProps?.teamRank;
  return { classYear: year, url, rankings: normalizeTeamRank(teamRank, year) };
}

async function fetchFloridaSnapshot(classYears) {
  const years = (classYears || [2026, 2027]).map((y) => parseInt(y, 10));
  const boards = {};
  const rankings = {};
  const errors = [];

  for (const year of years) {
    try {
      const url = pageUrl(year);
      const html = await fetchHtml(url, year);
      const next = extractNextData(html);
      const pageProps = next?.props?.pageProps || {};
      const list = pageProps.playerList?.list || [];
      boards[year] = list.map((row) => normalizeOn3Row(row, year)).filter((p) => p.name);
      rankings[year] = normalizeTeamRank(pageProps.teamRank, year);
      if (!boards[year].length) {
        errors.push({ year, type: 'commits', error: 'No commits found in On3 page data' });
      }
    } catch (e) {
      errors.push({ year, type: 'commits', error: e.message });
      boards[year] = [];
    }
  }

  return { boards, rankings, errors };
}

/** Portal transfer row on the UF commits board (has transferRating, not HS recruit rating). */
function isPortalTransferRow(row) {
  if (!row || !row.player) return false;
  if (row.transferRating) return true;
  const status = row.status || {};
  return !!(status.transferredAsset || status.transferredAssetRes);
}

function normalizeOn3PortalRow(row, classYear) {
  const player = row.player || {};
  const transferRating = row.transferRating || {};
  const status = row.status || {};
  const org = row.organization || status.transferredAsset || {};
  const name = pickString(
    player.fullName,
    [player.firstName, player.lastName].filter(Boolean).join(' ')
  );
  const on3Id = pickString(player.key, row.recKey) || null;
  const on3Slug = pickString(player.slug) || null;
  const fromSchool = pickString(org.name, org.fullName);
  const pos = pickString(transferRating.positionAbbr, player.position?.abbr, player.position?.name, 'ATH');
  const stars = pickNumber(transferRating.consensusStars, transferRating.stars) || 3;
  const statusType = pickString(status.type).toLowerCase();
  const enrolled = /enrolled/i.test(statusType);

  const normalized = {
    on3Id,
    on3Slug,
    name,
    pos: pos.toUpperCase(),
    classYear: pickNumber(transferRating.year, player.classYear, classYear) || classYear,
    fromSchool,
    school: fromSchool,
    htWt: formatHtWt(player.height, player.weight),
    stars,
    rating: pickNumber(transferRating.consensusRating, transferRating.rating),
    natlRank: pickNumber(transferRating.consensusNationalRank, transferRating.nationalRank),
    posRank: pickNumber(transferRating.consensusPositionRank, transferRating.positionRank),
    stateRank: pickNumber(transferRating.consensusStateRank, transferRating.stateRank),
    inState: false,
    status: enrolled ? 'enrolled' : statusType || 'committed',
    commitDate: status.date ? String(status.date).slice(0, 10) : '',
    committedTo: 'Florida',
    sourceStatus: pickString(status.type),
    on3Source: pageUrl(classYear)
  };
  normalized.on3ProfileUrl = buildOn3ProfileUrl(normalized);
  return normalized;
}

async function fetchFloridaPortalTransfers(classYear) {
  const year = parseInt(classYear, 10);
  const url = pageUrl(year);
  const html = await fetchHtml(url, year);
  const next = extractNextData(html);
  const list = next?.props?.pageProps?.playerList?.list || [];
  const transfers = list
    .filter(isPortalTransferRow)
    .map((row) => normalizeOn3PortalRow(row, year))
    .filter((p) => p.name);
  return { classYear: year, url, transfers };
}

module.exports = {
  fetchFloridaSnapshot,
  fetchTeamCommits,
  fetchTeamRankings,
  fetchFloridaPortalTransfers,
  normalizeOn3Player,
  normalizeOn3Row,
  normalizeOn3PortalRow,
  isPortalTransferRow,
  pageUrl,
  buildOn3ProfileUrl,
  playerKey(player) {
    if (player.on3Id) return `on3:${player.on3Id}`;
    if (player.name) return `name:${player.name.toLowerCase()}`;
    return null;
  }
};
