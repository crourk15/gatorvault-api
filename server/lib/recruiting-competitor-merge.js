/**
 * Merge competitor entries onto player.competitors[] — dedupe by normalized school name.
 */
const store = require('./recruiting-store');

function normalizeSchoolKey(school) {
  return String(school || '').trim().toLowerCase();
}

function competitorSchoolName(entry) {
  if (typeof entry === 'string') return entry.trim();
  return String(entry?.school || entry?.schoolName || entry?.name || '').trim();
}

function competitorUpdatedAt(entry) {
  const raw = typeof entry === 'object' ? entry?.updatedAt || entry?.updated_at : null;
  const ts = new Date(raw || 0).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

/**
 * @param {Array} existingCompetitors
 * @param {{ school, score?, source, updatedAt, trend? }} entry
 */
function mergeCompetitorEntry(existingCompetitors, entry) {
  const list = Array.isArray(existingCompetitors) ? [...existingCompetitors] : [];
  const school = String(entry?.school || '').trim();
  const key = normalizeSchoolKey(school);
  if (!key) return list;

  const idx = list.findIndex((c) => normalizeSchoolKey(competitorSchoolName(c)) === key);
  const incomingTs = new Date(entry.updatedAt || new Date().toISOString()).getTime();
  const normalized = {
    school,
    score: entry.score != null ? Number(entry.score) : null,
    source: entry.source || 'unknown',
    updatedAt: entry.updatedAt || new Date().toISOString(),
    trend: entry.trend || 'flat',
  };

  if (idx < 0) {
    list.push(normalized);
    return list;
  }

  const existing = list[idx];
  const existingObj =
    typeof existing === 'string'
      ? { school: existing, updatedAt: '1970-01-01T00:00:00.000Z', trend: 'flat' }
      : { ...existing, school: competitorSchoolName(existing) || school };

  if (incomingTs >= competitorUpdatedAt(existingObj)) {
    list[idx] = {
      ...existingObj,
      school: normalized.school,
      source: normalized.source,
      updatedAt: normalized.updatedAt,
      ...(normalized.score != null ? { score: normalized.score } : existingObj.score != null ? { score: existingObj.score } : {}),
      ...(normalized.trend !== 'flat' ? { trend: normalized.trend } : existingObj.trend ? { trend: existingObj.trend } : { trend: 'flat' }),
    };
  }

  return list;
}

async function mergeCompetitorsOnPlayer(slug, entries = []) {
  const key = String(slug || '').trim();
  if (!key || !entries.length) return null;

  const existing = await store.getPlayerBySlug(key);
  if (!existing) return null;

  let competitors = existing.competitors || [];
  let denied = null;
  try {
    denied = require('./recruiting-visit-scrub').isDeniedPlayerSchool;
  } catch {
    denied = () => false;
  }
  for (const entry of entries) {
    if (!entry?.school) continue;
    if (denied(key, entry.school)) continue;
    competitors = mergeCompetitorEntry(competitors, entry);
  }
  try {
    competitors = require('./recruiting-visit-scrub').scrubCompetitorList(key, competitors);
  } catch {
    /* optional */
  }

  return store.upsertPlayer({ slug: key, competitors });
}

function mergeCompetitorArrays(existingArr, incomingArr) {
  const existing = Array.isArray(existingArr) ? existingArr : [];
  const incoming = Array.isArray(incomingArr) ? incomingArr : [];
  if (!incoming.length) return existing.length ? existing : undefined;
  let merged = [...existing];
  for (const entry of incoming) {
    if (typeof entry === 'string') {
      merged = mergeCompetitorEntry(merged, {
        school: entry,
        source: 'legacy',
        updatedAt: new Date().toISOString(),
      });
    } else if (entry?.school || entry?.schoolName || entry?.name) {
      merged = mergeCompetitorEntry(merged, {
        school: entry.school || entry.schoolName || entry.name,
        score: entry.score ?? entry.probability ?? entry.pct ?? null,
        source: entry.source || 'legacy',
        updatedAt: entry.updatedAt || entry.updated_at || new Date().toISOString(),
        trend: entry.trend || 'flat',
      });
    }
  }
  return merged;
}

module.exports = {
  normalizeSchoolKey,
  mergeCompetitorEntry,
  mergeCompetitorsOnPlayer,
  mergeCompetitorArrays,
};
