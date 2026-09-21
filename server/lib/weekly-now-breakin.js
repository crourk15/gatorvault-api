/**
 * Middle NOW slot break-in — Game and Season stay.
 * Home + visitors: any Florida commit/flip this week beats the visitor list.
 * Road / empty visitors: the week's Florida commit or flip, if we have one.
 *
 * News is the commit day going forward — never rematerialized intel timestamps
 * on older board commits (Tommy Douglas April 16 must not paint as this week).
 */
'use strict';

const fs = require('fs');

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const TOP25 = 25;

function isFloridaSchool(value) {
  try {
    return require('./recruiting-hub-scoring').isFloridaSchool(value);
  } catch {
    return /\bflorida\b|\bgators\b/i.test(String(value || ''));
  }
}

function parseDateMs(value, nowMs) {
  if (value == null || value === '') return NaN;
  const raw = String(value).trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw + 'T18:00:00.000Z' : raw;
  const ts = Date.parse(iso);
  if (Number.isFinite(ts) && ts <= nowMs + DAY_MS) return ts;
  return NaN;
}

function isRematerialized(row) {
  const blob = [
    row.source,
    row.sourceType,
    row.sourceHandle,
    row.fingerprint,
    row.origin,
  ]
    .map((s) => String(s || '').toLowerCase())
    .join(' ');
  return /allowlist|board.?pulse|rematerial|rebuild|hub-runtime|board.?commit/.test(blob);
}

function rowCommitDate(row) {
  const payload = row.payload && row.payload.player && row.payload.player.commitDate;
  return row.commitDate || payload || null;
}

function playerSlugOf(row) {
  const payload = row.payload && row.payload.player && row.payload.player.slug;
  return String(row.playerSlug || row.slug || payload || '')
    .trim()
    .toLowerCase();
}

function loadCommitDateIndex() {
  try {
    const { PLAYERS_PATH } = require('./recruiting-store');
    const raw = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf8'));
    const map = Object.create(null);
    for (const p of Array.isArray(raw) ? raw : []) {
      const slug = String(p && p.slug ? p.slug : '')
        .trim()
        .toLowerCase();
      const date = p && (p.commitDate || p.commit_date);
      if (slug && date) map[slug] = date;
    }
    return map;
  } catch {
    return Object.create(null);
  }
}

function makeCommitDateLookup() {
  let index = null;
  return function commitDateFor(row) {
    const fromRow = rowCommitDate(row);
    if (fromRow) return fromRow;
    const slug = playerSlugOf(row);
    if (!slug) return null;
    if (!index) index = loadCommitDateIndex();
    return index[slug] || null;
  };
}

/**
 * When the player committed — not when intel was rematerialized.
 * Real commitDate (intel or players.json) wins. Rematerialized rows
 * without a this-week commitDate never paint as News.
 */
function commitWhenMs(row, nowMs, commitDateFor) {
  const real = commitDateFor ? commitDateFor(row) : rowCommitDate(row);
  const realMs = parseDateMs(real, nowMs);
  if (Number.isFinite(realMs)) return realMs;
  if (isRematerialized(row)) return NaN;
  for (const c of [row.timestamp, row.reportedAt, row.createdAt, row.date]) {
    const ts = parseDateMs(c, nowMs);
    if (Number.isFinite(ts)) return ts;
  }
  return NaN;
}

function natlRankOf(row) {
  const n = Number(
    row.natlRank ??
      row.nationalRank ??
      row.natl ??
      (row.payload && row.payload.player && row.payload.player.natlRank)
  );
  return Number.isFinite(n) && n > 0 ? n : NaN;
}

function starsOf(row) {
  const n = Number(row.stars ?? (row.payload && row.payload.player && row.payload.player.stars));
  return Number.isFinite(n) && n > 0 ? n : NaN;
}

function playerNameOf(row) {
  const payloadName = row.payload && row.payload.player && row.payload.player.name;
  return String(row.playerName || row.name || payloadName || '').trim();
}

function committedSchoolOf(row) {
  const payloadSchool = row.payload && row.payload.player && row.payload.player.committedTo;
  return String(row.committedTo || payloadSchool || row.status || '').trim();
}

function eventKind(row) {
  const et = String(row.eventType || row.event || '').toLowerCase();
  const blob = [row.text, row.title, row.summary, row.detail].map((s) => String(s || '')).join(' ');
  if (et === 'flip' || /\bflips? to Florida\b/i.test(blob)) return 'flip';
  if (et === 'commit' || /\bcommits? to Florida\b/i.test(blob)) return 'commit';
  return '';
}

function isFloridaHeadline(row) {
  const kind = eventKind(row);
  if (!kind) return false;
  const school = committedSchoolOf(row);
  if (school && !isFloridaSchool(school) && !/\bflorida\b/i.test(school)) return false;
  const blob = [row.text, row.title, row.summary, row.detail].map((s) => String(s || '')).join(' ');
  if (/\bcommits? to (?!Florida\b)[A-Z]/i.test(blob)) return false;
  return true;
}

function scoreBreakIn(row, nowMs, biggerThanVisitors, commitDateFor) {
  if (!isFloridaHeadline(row)) return 0;
  const ts = commitWhenMs(row, nowMs, commitDateFor);
  if (!Number.isFinite(ts) || nowMs - ts > WEEK_MS || ts > nowMs + DAY_MS) return 0;
  const rank = natlRankOf(row);
  const stars = starsOf(row);
  const kind = eventKind(row);
  const top25 = Number.isFinite(rank) && rank <= TOP25;
  const fiveStar = stars >= 5;
  // Any Florida commit/flip this week beats visitors. Rank only picks the best one.
  if (top25) return 200 - rank + (kind === 'flip' ? 4 : 0);
  if (fiveStar) return 170;
  if (Number.isFinite(rank) && rank <= 100) return 140 - rank / 2;
  if (stars >= 4) return 90;
  return 70;
}

function formatBreakInLine(row) {
  const name = playerNameOf(row);
  if (!name) return '';
  const kind = eventKind(row);
  const verb = kind === 'flip' ? 'flips to Florida' : 'commits to Florida';
  const rank = natlRankOf(row);
  const rankBit = Number.isFinite(rank) && rank <= 100 ? ' · No. ' + rank : '';
  return name + ' ' + verb + rankBit;
}

function loadIntelRows(nowMs) {
  try {
    const since = new Date(nowMs - WEEK_MS).toISOString();
    const store = require('./recruiting-intel-store');
    const commits = store.listIntel({ limit: 60, since, eventType: 'commit' });
    const flips = store.listIntel({ limit: 20, since, eventType: 'flip' });
    return commits.concat(flips);
  } catch {
    return [];
  }
}

function pickWeeklyNowBreakIn(now, opts) {
  if (now == null) now = new Date();
  if (opts == null) opts = {};
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(nowMs)) return null;
  const biggerThanVisitors = Boolean(opts.biggerThanVisitors);
  const rows = Array.isArray(opts.rows) ? opts.rows : loadIntelRows(nowMs);
  const commitDateFor = makeCommitDateLookup();
  let best = null;
  for (const row of rows) {
    const score = scoreBreakIn(row, nowMs, biggerThanVisitors, commitDateFor);
    if (score <= 0) continue;
    const text = formatBreakInLine(row);
    if (!text) continue;
    if (!best || score > best.score) best = { text: text, score: score };
  }
  return best;
}

module.exports = {
  pickWeeklyNowBreakIn: pickWeeklyNowBreakIn,
  scoreBreakIn: scoreBreakIn,
  formatBreakInLine: formatBreakInLine,
  commitWhenMs: commitWhenMs,
  isRematerialized: isRematerialized,
  TOP25: TOP25,
};
