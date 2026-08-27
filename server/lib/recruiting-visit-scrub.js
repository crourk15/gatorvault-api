/**
 * Hard denylist for known-bad visit rows that must never surface on profiles,
 * Home NOW, or intel — even if On3 / seed / players.json re-introduces them.
 *
 * Tranard Roberts: Auburn "unofficial visit" was a false stone wiped for the
 * 1.0.20/1.0.21 bake. Keep scrubbing forever so ingest cannot resurrect it.
 */

'use strict';

/** @type {Array<{ slug: string, schoolRe: RegExp }>} */
const DENIED_VISITS = [
  { slug: 'tranard-roberts', schoolRe: /auburn/i },
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

module.exports = {
  DENIED_VISITS,
  isDeniedVisit,
  scrubPlayerVisits,
  scrubVisitLogRows,
  scrubPlayerVisitFields,
};
