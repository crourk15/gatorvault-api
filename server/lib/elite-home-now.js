/**
 * Elite Home NOW curation — named Florida process over thin class metrics / offer spam.
 */
'use strict';

function isThinClassMetricLine(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  if (/^Blue chip % at 100%/i.test(t)) return true;
  if (/^1\s+(commit|signee)s?\s+locked\b/i.test(t)) return true;
  if (/^Blue chip % at\b/i.test(t) && /\bat 100%/i.test(t)) return true;
  return false;
}

/** Evergreen class-dashboard lines — filler, never the weekly NOW lead. */
function isClassMetricLine(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/class trending nationally/i.test(t)) return true;
  if (/^\d+\s+(commits|signees)\s+locked\b/i.test(t)) return true;
  if (/^Blue chip % at\b/i.test(t)) return true;
  return false;
}

/** Allowlist auto-rows — no fan fact. */
function isThinFloridaProcessLine(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  return /(?:—|-)\s*Florida process\.?$/i.test(t) || /^Florida process\.?$/i.test(t);
}

function isGameWeekPulse(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  return (
    /^Game Week\b/i.test(t) ||
    /^LIVE — Florida vs\b/i.test(t) ||
    /^Up next — /i.test(t) ||
    /\bin the Swamp\b/i.test(t) ||
    /^[A-Za-z].+\s(Saturday|Sunday|Friday|Thursday)\s—/.test(t)
  );
}

function isFloridaProcessLine(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/\bunofficial visit\s*[·•]\s*Florida\b/i.test(t)) return true;
  if (/\bofficial visit\s*[·•]\s*Florida\b/i.test(t)) return true;
  if (/\bFlorida\s+(?:unofficial\s+|official\s+)?visit\b/i.test(t)) return true;
  if (/\bFlorida offer\b/i.test(t)) return true;
  if (/\bOffer from Florida\b/i.test(t)) return true;
  if (/\bVisit scheduled\b/i.test(t)) return true;
  return false;
}

function isRivalOnlyOfferLine(text) {
  const t = String(text || '').trim();
  if (!/\bOffer from\b/i.test(t)) return false;
  if (/\bOffer from Florida\b/i.test(t)) return false;
  return true;
}

/** Higher = more elite for Gator Nation NOW. */
function eliteHomeNowScore(text) {
  const t = String(text || '').trim();
  if (!t) return 0;
  if (isThinFloridaProcessLine(t)) return 0;
  if (isThinClassMetricLine(t)) return 5;
  if (isGameWeekPulse(t) && /^LIVE — Florida vs\b/i.test(t)) return 112;
  if (/^Expected visitors in the Swamp\b/i.test(t)) return 109;
  if (/^On the road this\b/i.test(t)) return 109;
  if (/^\d+[–-]\d+\b/.test(t) && /\bSaturday\b/i.test(t)) return 109;
  if (isGameWeekPulse(t)) return 110;
  if (/\bVerified OV\b/i.test(t)) return 104;
  if (/\bFlip Watch\b/i.test(t) && /\bFlip\s+\d+/i.test(t)) return 102;
  if (/\bFlip Watch\b/i.test(t)) return 8;
  if (/\bVisit scheduled\b/i.test(t)) {
    if (/\b(Saturday|Sunday|Friday|Thursday|today|tonight|this week|this weekend)\b/i.test(t)) {
      return 108;
    }
    return 96;
  }
  if (/\b(unofficial|official)\s+visit\s*[·•]\s*Florida\b/i.test(t)) return 100;
  if (/\bFlorida\s+(?:unofficial\s+|official\s+)?visit\b/i.test(t)) return 98;
  if (/\brising\s*—\s*UF\b/i.test(t) || /\bleaning UF at\b/i.test(t)) return 90;
  if (/\bunofficial visit\s*[·•]/i.test(t) || /\bofficial visit\s*[·•]/i.test(t)) return 72;
  if (/\bFlorida offer\b/i.test(t) || /\bOffer from Florida\b/i.test(t)) return 58;
  if (isClassMetricLine(t)) {
    if (/class trending nationally/i.test(t) && /#\d+/i.test(t)) return 18;
    if (/^\d+\s+(commits|signees)\s+locked\b/i.test(t)) {
      const n = Number((t.match(/^(\d+)/) || [])[1] || 0);
      if (n >= 10) return 16;
      if (n >= 5) return 14;
      return 8;
    }
    if (/^Blue chip % at\b/i.test(t)) return 12;
  }
  if (isRivalOnlyOfferLine(t)) return 22;
  return 40;
}

function rankEliteHomeNowLines(lines, limit = 6) {
  const incoming = (Array.isArray(lines) ? lines : [])
    .map((t) => String(t || '').trim())
    .filter(Boolean);

  const seen = new Set();
  const scored = [];
  let floridaOfferCount = 0;

  for (const line of incoming) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    let score = eliteHomeNowScore(line);
    if (score <= 5) continue;
    if (isThinFloridaProcessLine(line)) continue;
    // Rival offer spam is profile noise — not Gator Nation NOW.
    if (isRivalOnlyOfferLine(line)) continue;

    const isBareFlOffer = /\bFlorida offer\b/i.test(line) || /\bOffer from Florida\b/i.test(line);
    if (isBareFlOffer) {
      floridaOfferCount += 1;
      if (floridaOfferCount > 2) continue;
    }

    scored.push({ line, score, classMetric: isClassMetricLine(line) });
  }

  scored.sort((a, b) => b.score - a.score || a.line.localeCompare(b.line));
  const out = [];
  let classMetricCount = 0;
  for (const row of scored) {
    if (row.classMetric) {
      classMetricCount += 1;
      if (classMetricCount > 1) continue;
    }
    out.push(row.line);
    if (out.length >= limit) break;
  }
  return out;
}

function shortenSchoolLabel(school) {
  return String(school || '')
    .replace(/\s+Aggies$/i, '')
    .replace(/\s+Tigers$/i, '')
    .replace(/\s+Bulldogs$/i, '')
    .replace(/\s+Crimson Tide$/i, '')
    .replace(/\s+Seminoles$/i, '')
    .replace(/\s+Rebels$/i, '')
    .replace(/\s+Cornhuskers$/i, '')
    .replace(/\s+Flames$/i, '')
    .replace(/\s+Wildcats$/i, '')
    .replace(/\s+Gators$/i, '')
    .trim();
}


const DAY_MS = 24 * 60 * 60 * 1000;
/** Hard Home NOW window — Charles: nothing 3 weeks+ on the strip. */
const HOME_NOW_MAX_AGE_MS = 21 * DAY_MS;
const HOME_NOW_VISIT_MAX_AGE_MS = HOME_NOW_MAX_AGE_MS;
/** Upcoming scheduled visits still count as NOW pulse. */
const HOME_NOW_VISIT_UPCOMING_MS = 120 * DAY_MS;
/** Florida offers must be a real offer day inside the same 3-week window. */
const HOME_NOW_OFFER_MAX_AGE_MS = HOME_NOW_MAX_AGE_MS;

function parseHomeNowTimestamp(value) {
  if (value == null || value === '') return NaN;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  const raw = String(value).trim();
  if (!raw) return NaN;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : NaN;
}

function isVisitPulseSummary(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/\bVisit scheduled\b/i.test(t)) return true;
  if (/\b(unofficial|official)\s+visit\b/i.test(t)) return true;
  if (/\bFlorida\s+(?:unofficial\s+|official\s+)?visit\b/i.test(t)) return true;
  if (/\bVerified OV\b/i.test(t)) return true;
  return false;
}

function escapeNowNameRe(name) {
  return String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function lastCompletedKickMs(nowMs, games) {
  const list = Array.isArray(games) ? games : loadScheduleGamesForNow();
  let last = NaN;
  for (const g of list) {
    if (!g || g.kind === 'bye') continue;
    const kickMs = parseScheduleKickoffMs(g.date);
    const postedFinal =
      Number.isFinite(Number(g.finalUF)) && Number.isFinite(Number(g.finalOpp));
    if (!postedFinal || !Number.isFinite(kickMs) || kickMs >= nowMs) continue;
    if (!Number.isFinite(last) || kickMs > last) last = kickMs;
  }
  return last;
}

/**
 * Last week's gameday / visit pulse — not this week's NOW.
 * "expected Campbell gameday" dies once Campbell is final.
 */
function isPriorGameWeekNowPulse(text, raw = {}, nowMs = Date.now()) {
  const t = String(text || '').trim();
  const list = loadScheduleGamesForNow();
  for (const g of list) {
    const kickMs = parseScheduleKickoffMs(g.date);
    const postedFinal =
      Number.isFinite(Number(g.finalUF)) && Number.isFinite(Number(g.finalOpp));
    if (!postedFinal || !Number.isFinite(kickMs) || kickMs >= nowMs) continue;
    const name = shortenOpponentName(g.opp);
    if (!name || name.length < 3) continue;
    const hit = new RegExp(`\\b${escapeNowNameRe(name)}\\b`, 'i').test(t);
    if (hit && /\b(gameday|game day|expected .{0,60}visit|visit weekend)\b/i.test(t)) {
      return true;
    }
  }
  const lastKick = lastCompletedKickMs(nowMs, list);
  if (!Number.isFinite(lastKick)) return false;
  const row = raw && typeof raw === 'object' ? raw : {};
  let ts = NaN;
  for (const c of [row.visitDate, row.visitStart, row.date, row.timestamp, row.reportedAt]) {
    ts = parseHomeNowTimestamp(c);
    if (Number.isFinite(ts)) break;
  }
  if (!Number.isFinite(ts) || ts > nowMs) return false;
  return ts < lastKick;
}

/**
 * Fresh enough for Home NOW.
 * Prefer actual visit day when known (past ≤3 weeks / upcoming ≤120d).
 * If no visit day, only fresh reporting (≤3 weeks) counts — never undated history.
 */
function isFreshHomeNowVisit(raw, nowMs = Date.now()) {
  const row = raw && typeof raw === 'object' ? raw : { timestamp: raw };
  let visitTs = NaN;
  for (const c of [row.visitDate, row.visitStart, row.visitEnd, row.date]) {
    visitTs = parseHomeNowTimestamp(c);
    if (Number.isFinite(visitTs)) break;
  }
  if (Number.isFinite(visitTs)) {
    if (visitTs > nowMs) return visitTs - nowMs <= HOME_NOW_VISIT_UPCOMING_MS;
    return nowMs - visitTs <= HOME_NOW_VISIT_MAX_AGE_MS;
  }
  let reportTs = NaN;
  for (const c of [row.timestamp, row.reportedAt, row.createdAt]) {
    reportTs = parseHomeNowTimestamp(c);
    if (Number.isFinite(reportTs)) break;
  }
  if (!Number.isFinite(reportTs) || reportTs > nowMs) return false;
  return nowMs - reportTs <= HOME_NOW_MAX_AGE_MS;
}

/**
 * Generic named-row freshness (intel / movement) — 3-week hard cap.
 * Class metric lines are not dated events.
 */
function isFreshHomeNowTimestamp(raw, nowMs = Date.now()) {
  const row = raw && typeof raw === 'object' ? raw : { timestamp: raw };
  const candidates = [
    row.offerDate,
    row.visitDate,
    row.visitStart,
    row.date,
    row.timestamp,
    row.reportedAt,
    row.createdAt,
  ];
  let ts = NaN;
  for (const c of candidates) {
    ts = parseHomeNowTimestamp(c);
    if (Number.isFinite(ts)) break;
  }
  if (!Number.isFinite(ts)) return false;
  if (ts > nowMs) return ts - nowMs <= HOME_NOW_VISIT_UPCOMING_MS;
  return nowMs - ts <= HOME_NOW_MAX_AGE_MS;
}

function isOfferPulseSummary(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/\bFlorida offer\b/i.test(t)) return true;
  if (/\bOffer from\b/i.test(t)) return true;
  return false;
}

/**
 * Fresh enough for Home NOW.
 * Prefer actual offer date — never allowlist rematerialization / board "has offer" now().
 * Undated offers never paint as NOW.
 */
function isFreshHomeNowOffer(raw, nowMs = Date.now()) {
  const row = raw && typeof raw === 'object' ? raw : { offerDate: raw };
  const candidates = [row.offerDate, row.date, row.offer_date];
  let ts = NaN;
  for (const c of candidates) {
    ts = parseHomeNowTimestamp(c);
    if (Number.isFinite(ts)) break;
  }
  if (!Number.isFinite(ts)) return false;
  if (ts > nowMs + DAY_MS) return false;
  return nowMs - ts <= HOME_NOW_OFFER_MAX_AGE_MS;
}

const MONTHS = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function parseScheduleKickoffMs(dateStr) {
  const cleaned = String(dateStr || '')
    .replace(/\s*[·|]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || /\b(OFF|FLEX|EARLY|NIGHT|TBA|TBD)\b/i.test(cleaned)) return NaN;
  const ranged = cleaned.replace(
    /(\d{1,2}:\d{2})\s*[-–]\s*\d{1,2}:\d{2}\s*(AM|PM)/i,
    (_, t, ap) => `${t} ${ap}`
  );
  const m = ranged.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?(?:\s*ET)?/i
  );
  if (!m) {
    const d = Date.parse(cleaned.replace(/\s*ET\s*$/i, '').trim());
    return Number.isFinite(d) ? d : NaN;
  }
  const month = MONTHS[m[1].toLowerCase()];
  const day = Number(m[2]);
  const year = Number(m[3]);
  let hour = m[4] ? Number(m[4]) : 12;
  const minute = m[4] ? Number(m[5]) : 0;
  const ap = String(m[6] || 'AM').toUpperCase();
  if (m[4] && ap === 'PM' && hour < 12) hour += 12;
  if (m[4] && ap === 'AM' && hour === 12) hour = 0;
  // Kick times are Eastern — Date.UTC + 4h is close enough for NOW windowing.
  return Date.UTC(year, month - 1, day, hour + 4, minute, 0);
}

function shortenOpponentName(opp) {
  return String(opp || '')
    .replace(/\s+Rebels$/i, '')
    .replace(/\s+Tigers$/i, '')
    .replace(/\s+Bulldogs$/i, '')
    .replace(/\s+Crimson Tide$/i, '')
    .replace(/\s+Seminoles$/i, '')
    .replace(/\s+Gamecocks$/i, '')
    .replace(/\s+Longhorns$/i, '')
    .replace(/\s+Sooners$/i, '')
    .replace(/\s+Wildcats$/i, '')
    .replace(/\s+Gators$/i, '')
    .replace(/\s+Owls$/i, '')
    .replace(/\s+Camels$/i, '')
    .trim();
}

function formatKickClock(dateStr) {
  const m = String(dateStr || '').match(/(\d{1,2}:\d{2})\s*(AM|PM)/i);
  if (!m) return '';
  return `${m[1]} ${m[2].toUpperCase()}`;
}

function weekdayFromKick(kickMs) {
  return new Date(kickMs).toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'America/New_York',
  });
}

function pickCurrentNowGame(now = new Date(), games) {
  const list = Array.isArray(games) ? games : loadScheduleGamesForNow();
  if (!list.length) return null;
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(nowMs)) return null;

  let current = null;
  let next = null;
  let nextTs = Infinity;
  for (const g of list) {
    if (!g || g.kind === 'bye' || String(g.id || '').startsWith('bye')) continue;
    const kickMs = parseScheduleKickoffMs(g.date);
    if (!Number.isFinite(kickMs)) continue;
    const postedFinal =
      Number.isFinite(Number(g.finalUF)) && Number.isFinite(Number(g.finalOpp));
    if (postedFinal && nowMs > kickMs) continue;
    const start = kickMs - 3 * 60 * 60 * 1000;
    const end = kickMs + 8 * 60 * 60 * 1000;
    if (nowMs >= start && nowMs <= end) {
      current = { game: g, kickMs };
      break;
    }
    if (kickMs > nowMs && kickMs < nextTs) {
      nextTs = kickMs;
      next = { game: g, kickMs };
    }
  }
  return current || next;
}

/**
 * This-week game chip — Home NOW must move with the slate, not sit on class rank.
 * Schedule facts only (opponent / venue / TV / kick). Never invented tape.
 */
function buildHomeNowGameStory(now = new Date(), games) {
  const picked = pickCurrentNowGame(now, games);
  if (!picked) return null;

  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  const { game, kickMs } = picked;
  const opp = shortenOpponentName(game.opp) || 'the opponent';
  const venue = String(game.venue || '');
  const home = /gainesville|swamp|hill griffin/i.test(venue);
  const where = home ? 'in the Swamp' : venue ? `at ${venue.split(',')[0].trim()}` : '';
  const tvRaw = String(game.tv || '').trim();
  const tv = tvRaw && !/^(TBD|—|-)$/i.test(tvRaw) ? tvRaw : '';
  const clock = formatKickClock(game.date);
  const weekday = weekdayFromKick(kickMs);
  const days = (kickMs - nowMs) / DAY_MS;

  if (nowMs >= kickMs && nowMs <= kickMs + 8 * 60 * 60 * 1000) {
    return `LIVE — Florida vs ${opp}`;
  }
  if (days <= 3) {
    const bits = [`${opp} ${weekday}`];
    if (clock) bits[0] += ` — ${clock}`;
    if (tv) bits[0] += ` · ${tv}`;
    return bits[0];
  }
  if (days <= 7) {
    const loc = where ? ` ${where}` : '';
    return tv ? `Game Week — ${opp}${loc} · ${tv}` : `Game Week — ${opp}${loc}`.trim();
  }
  if (days <= 14) {
    const loc = where ? ` ${where}` : '';
    return `Up next — ${opp}${loc}`.trim();
  }
  return null;
}

function loadScheduleGamesForNow() {
  try {
    const { getScheduleBoard } = require('./schedule-board');
    const board = getScheduleBoard(2026);
    return Array.isArray(board?.games) ? board.games : [];
  } catch {
    return [];
  }
}

module.exports = {
  isThinClassMetricLine,
  isClassMetricLine,
  isThinFloridaProcessLine,
  isGameWeekPulse,
  isFloridaProcessLine,
  isRivalOnlyOfferLine,
  eliteHomeNowScore,
  rankEliteHomeNowLines,
  shortenSchoolLabel,
  shortenOpponentName,
  parseHomeNowTimestamp,
  isVisitPulseSummary,
  isPriorGameWeekNowPulse,
  isFreshHomeNowVisit,
  isFreshHomeNowTimestamp,
  isOfferPulseSummary,
  isFreshHomeNowOffer,
  pickCurrentNowGame,
  buildHomeNowGameStory,
  parseScheduleKickoffMs,
  HOME_NOW_MAX_AGE_MS,
  HOME_NOW_VISIT_MAX_AGE_MS,
  HOME_NOW_VISIT_UPCOMING_MS,
  HOME_NOW_OFFER_MAX_AGE_MS,
};
