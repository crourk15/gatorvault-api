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
  if (isThinClassMetricLine(t)) return 5;
  if (/\bVerified OV\b/i.test(t)) return 104;
  if (/\bFlip Watch\b/i.test(t)) return 102;
  if (/\b(unofficial|official)\s+visit\s*[·•]\s*Florida\b/i.test(t)) return 100;
  if (/\bFlorida\s+(?:unofficial\s+|official\s+)?visit\b/i.test(t)) return 98;
  if (/\brising\s*—\s*UF\b/i.test(t)) return 90;
  if (/\bunofficial visit\s*[·•]/i.test(t) || /\bofficial visit\s*[·•]/i.test(t)) return 72;
  if (/\bFlorida offer\b/i.test(t) || /\bOffer from Florida\b/i.test(t)) return 58;
  if (/class trending nationally/i.test(t) && /#\d+/i.test(t)) return 70;
  if (/^\d+\s+(commits|signees)\s+locked\b/i.test(t)) {
    const n = Number((t.match(/^(\d+)/) || [])[1] || 0);
    if (n >= 10) return 68;
    if (n >= 5) return 50;
    return 12;
  }
  if (/^Blue chip % at\b/i.test(t)) return 35;
  if (/\bVisit scheduled\b/i.test(t)) return 48;
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
    // Rival offer spam is profile noise — not Gator Nation NOW.
    if (isRivalOnlyOfferLine(line)) continue;

    const isBareFlOffer = /\bFlorida offer\b/i.test(line) || /\bOffer from Florida\b/i.test(line);
    if (isBareFlOffer) {
      floridaOfferCount += 1;
      if (floridaOfferCount > 2) continue;
    }

    scored.push({ line, score });
  }

  scored.sort((a, b) => b.score - a.score || a.line.localeCompare(b.line));
  return scored.slice(0, limit).map((row) => row.line);
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
/** Home NOW visit window — history belongs on the profile, not the strip. */
const HOME_NOW_VISIT_MAX_AGE_MS = 21 * DAY_MS;
/** Upcoming scheduled visits still count as NOW pulse. */
const HOME_NOW_VISIT_UPCOMING_MS = 120 * DAY_MS;

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

/**
 * Fresh enough for Home NOW.
 * Prefer actual visit date over allowlist rematerialization reportedAt.
 * Undated visit history never paints as NOW.
 */
function isFreshHomeNowVisit(raw, nowMs = Date.now()) {
  const row = raw && typeof raw === 'object' ? raw : { timestamp: raw };
  const candidates = [
    row.visitDate,
    row.date,
    row.visitStart,
    row.visitEnd,
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
  return nowMs - ts <= HOME_NOW_VISIT_MAX_AGE_MS;
}

/** Home NOW offer window — older offers live on the profile, not the strip. */
const HOME_NOW_OFFER_MAX_AGE_MS = 14 * DAY_MS;

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

module.exports = {
  isThinClassMetricLine,
  isFloridaProcessLine,
  isRivalOnlyOfferLine,
  eliteHomeNowScore,
  rankEliteHomeNowLines,
  shortenSchoolLabel,
  parseHomeNowTimestamp,
  isVisitPulseSummary,
  isFreshHomeNowVisit,
  isOfferPulseSummary,
  isFreshHomeNowOffer,
  HOME_NOW_VISIT_MAX_AGE_MS,
  HOME_NOW_VISIT_UPCOMING_MS,
  HOME_NOW_OFFER_MAX_AGE_MS,
};
