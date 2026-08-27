/**
 * Hard denylist for known-bad visit rows that must never surface on profiles,
 * Home NOW, hub ticker/movement, or intel — even if On3 / seed / durable disk
 * re-introduces them.
 *
 * Tranard Roberts: Auburn "unofficial visit" was a false stone wiped for the
 * 1.0.20/1.0.21 bake. Keep scrubbing forever so ingest + durable hub plates
 * cannot resurrect it (live iOS must pick this up without Codemagic).
 */

'use strict';

/** @type {Array<{ slug: string, nameRe: RegExp, schoolRe: RegExp }>} */
const DENIED_VISITS = [
  { slug: 'tranard-roberts', nameRe: /tranard\s+roberts/i, schoolRe: /auburn/i },
];

function rulesForSlug(slug) {
  const s = String(slug || '').toLowerCase().trim();
  return DENIED_VISITS.filter((r) => r.slug === s);
}

function isDeniedVisit(slug, school) {
  const schoolStr = String(school || '').trim();
  if (!schoolStr) return false;
  return rulesForSlug(slug).some((r) => r.schoolRe.test(schoolStr));
}

/** Home NOW / hub ticker line: "Tranard Roberts — unofficial visit · Auburn Tigers" */
function isDeniedVisitTickerLine(line) {
  const text = String(line || '');
  if (!text.trim()) return false;
  if (!/\b(unofficial|official)\s+visit\b|\bUOV\b|\bOV\b/i.test(text)) return false;
  return DENIED_VISITS.some((r) => r.nameRe.test(text) && r.schoolRe.test(text));
}

function scrubHubTickerLines(lines) {
  if (!Array.isArray(lines) || !lines.length) return Array.isArray(lines) ? lines : [];
  return lines.filter((line) => !isDeniedVisitTickerLine(line));
}

function scrubMovementFeedItems(items) {
  if (!Array.isArray(items) || !items.length) return Array.isArray(items) ? items : [];
  return items.filter((item) => {
    if (!item || typeof item !== 'object') return true;
    const name = String(item.name || item.player || item.playerName || '');
    const summary = String(item.summary || item.detail || '');
    const school = String(item.school || '');
    const blob = `${name} ${summary} ${school}`;
    if (!/\b(unofficial|official)\s+visit\b|\bUOV\b|\bOV\b|visit/i.test(blob)) return true;
    return !DENIED_VISITS.some((r) => r.nameRe.test(blob) && r.schoolRe.test(blob));
  });
}

/** Scrub hub bundle/hero payloads (ticker + movementFeed) before serve. */
function scrubHubPayload(value) {
  if (value == null) return value;
  if (Array.isArray(value)) {
    // ticker items are string[]; movement feed is object[]
    if (value.length && typeof value[0] === 'string') return scrubHubTickerLines(value);
    if (value.length && value[0] && typeof value[0] === 'object') return scrubMovementFeedItems(value);
    return value;
  }
  if (typeof value !== 'object') return value;
  const out = { ...value };
  if (Array.isArray(out.ticker)) out.ticker = scrubHubTickerLines(out.ticker);
  if (Array.isArray(out.movementFeed)) out.movementFeed = scrubMovementFeedItems(out.movementFeed);
  if (out.hero && typeof out.hero === 'object') {
    out.hero = scrubHubPayload(out.hero);
  }
  return out;
}

function scrubPlayerVisits(slug, visits) {
  if (!Array.isArray(visits) || !visits.length) return Array.isArray(visits) ? visits : [];
  const rules = rulesForSlug(slug);
  if (!rules.length) return visits;
  return visits.filter((v) => {
    const school =
      typeof v === 'string'
        ? v
        : String(v?.school || v?.schoolName || v?.visitSchool || v?.host || v?.team || '').trim();
    if (!school) return true;
    return !rules.some((r) => r.schoolRe.test(school));
  });
}

function scrubVisitLogRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return Array.isArray(rows) ? rows : [];
  return rows.filter((row) => {
    const slug = row?.playerSlug || row?.slug || '';
    const school = row?.school || row?.visitSchool || row?.host || '';
    return !isDeniedVisit(slug, school);
  });
}

function scrubPlayerVisitFields(player) {
  if (!player || typeof player !== 'object') return player;
  const slug = player.slug || player.id || '';
  if (Array.isArray(player.visits)) {
    player.visits = scrubPlayerVisits(slug, player.visits);
  }
  if (Array.isArray(player.visitHistory)) {
    player.visitHistory = scrubPlayerVisits(slug, player.visitHistory);
  }
  return player;
}

/**
 * One-shot durable disk heal — /var/data/players.json survives deploys and can
 * keep denied visit rows forever. Rewrite when any denied row is present.
 */
function healDurableDeniedVisits(playersPath) {
  const fs = require('fs');
  const path = require('path');
  const filePath = playersPath || path.join(require('./recruiting-data-dir').resolveRecruitingDataDir(), 'players.json');
  if (!fs.existsSync(filePath)) return { healed: false, reason: 'missing' };
  let players;
  try {
    players = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return { healed: false, reason: err.message };
  }
  if (!Array.isArray(players)) return { healed: false, reason: 'not_array' };
  let changed = 0;
  for (const p of players) {
    if (!p || !p.slug) continue;
    const before = Array.isArray(p.visits) ? p.visits.length : 0;
    scrubPlayerVisitFields(p);
    const after = Array.isArray(p.visits) ? p.visits.length : 0;
    if (after < before) changed += 1;
  }
  if (!changed) return { healed: false, reason: 'clean', changed: 0 };
  try {
    fs.writeFileSync(filePath, `${JSON.stringify(players, null, 2)}\n`, 'utf8');
    return { healed: true, changed };
  } catch (err) {
    return { healed: false, reason: err.message, changed };
  }
}

module.exports = {
  DENIED_VISITS,
  isDeniedVisit,
  isDeniedVisitTickerLine,
  scrubHubTickerLines,
  scrubMovementFeedItems,
  scrubHubPayload,
  scrubPlayerVisits,
  scrubVisitLogRows,
  scrubPlayerVisitFields,
  healDurableDeniedVisits,
};
