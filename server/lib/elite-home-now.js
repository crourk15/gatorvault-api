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

module.exports = {
  isThinClassMetricLine,
  isFloridaProcessLine,
  isRivalOnlyOfferLine,
  eliteHomeNowScore,
  rankEliteHomeNowLines,
  shortenSchoolLabel,
};
