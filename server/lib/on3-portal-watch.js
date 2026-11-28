/**
 * Best-effort On3 Florida portal WATCH lists (not already-signed UF commits).
 * 404 / Cloudflare / empty NEXT_DATA → [] — never invent names.
 */
const { fetchOn3Html, extractNextDataJson, hasNextData } = require('./on3-fetch');

const WATCH_URLS = [
  'https://www.on3.com/transfer-portal/college/florida-gators/football/',
  'https://www.on3.com/college/florida-gators/football/transfer-portal/',
  'https://www.on3.com/college/florida-gators/football/transfer-portal/in/',
];

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

function isFloridaName(raw) {
  return /\bflorida\b|\bgators\b/i.test(String(raw || ''));
}

function walkLists(node, out, seen) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    if (node.length && node.some((row) => row && typeof row === 'object' && (row.player || row.fullName || row.name))) {
      out.push(node);
    }
    for (const item of node) walkLists(item, out, seen);
    return;
  }
  if (seen.has(node)) return;
  seen.add(node);
  if (Array.isArray(node.list)) out.push(node.list);
  for (const value of Object.values(node)) walkLists(value, out, seen);
}

function normalizeWatchRow(row, sourceUrl) {
  const player = row.player || row;
  const name = pickString(
    player.fullName,
    [player.firstName, player.lastName].filter(Boolean).join(' '),
    row.fullName,
    row.name
  );
  if (!name) return null;
  const org = row.organization || row.previousTeam || player.college || {};
  const fromSchool = pickString(
    org.name,
    org.fullName,
    player.collegeName,
    row.college,
    row.previousSchool,
    row.fromSchool,
    row.school
  );
  const committedTo = pickString(row.committedTo, row.status?.committedTo, player.committedTo);
  const status = pickString(row.status?.type, row.status, player.status).toLowerCase();
  if (isFloridaName(committedTo) || (isFloridaName(fromSchool) && /enrolled|committed/.test(status))) {
    return null;
  }
  const pos = pickString(
    row.transferRating?.positionAbbr,
    player.position?.abbr,
    player.position?.name,
    row.position,
    row.pos,
    'ATH'
  );
  return {
    name,
    slug: pickString(player.slug, row.slug),
    on3Id: pickString(player.key, row.recKey, player.id) || null,
    position: pos.toUpperCase(),
    fromSchool,
    school: fromSchool,
    conference: pickString(org.conference, row.conference, player.conference),
    stars: pickNumber(row.transferRating?.consensusStars, row.stars, player.stars),
    natlRank: pickNumber(row.transferRating?.consensusNationalRank, row.natlRank, player.nationalRank),
    category: 'portal',
    status: status || 'portal_in',
    source: 'on3',
    sourceUrl,
  };
}

async function fetchOneWatch(url, { timeout = 8000 } = {}) {
  try {
    const res = await fetchOn3Html(url, { classYear: 2027, timeout, retries: 0 });
    if (!hasNextData(res.text)) return [];
    const next = extractNextDataJson(res.text);
    const lists = [];
    walkLists(next?.props?.pageProps || next, lists, new WeakSet());
    const out = [];
    const seen = new Set();
    for (const list of lists) {
      for (const row of list) {
        const norm = normalizeWatchRow(row, url);
        if (!norm) continue;
        const key = (norm.on3Id || norm.name).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(norm);
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchFloridaPortalWatch(opts = {}) {
  const urls = opts.urls || WATCH_URLS;
  const merged = [];
  const seen = new Set();
  for (const url of urls) {
    const rows = await fetchOneWatch(url, opts);
    for (const row of rows) {
      const key = (row.on3Id || row.name).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(row);
    }
  }
  return merged;
}

module.exports = {
  WATCH_URLS,
  fetchFloridaPortalWatch,
  normalizeWatchRow,
};
