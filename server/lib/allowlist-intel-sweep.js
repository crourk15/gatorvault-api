/**
 * Continuous allowlist intel sweep — ensure every FutureCast / allowlist target
 * gets process intel gathered (visits, FL offers, board pulse), not only whoever
 * Beat Desk opened or a beat writer happened to tweet.
 *
 * Designed for cron (recruiting-light) + ops job. Cheap: materializes existing
 * visit/offer logs into intel.json with stable fingerprints (1/source/day max
 * via chase unique source-day scoring).
 */
'use strict';

const visitLogStore = require('./recruiting-visit-log-store');
const offerLogStore = require('./recruiting-offer-log-store');
const intelStore = require('./recruiting-intel-store');
const { getAllowlistSet, CANONICAL_TARGET_NAMES } = require('./recruiting-target-allowlist');
const { isFloridaSchool } = require('./recruiting-target-filters');
const { getLiveBoardTargets } = require('./live-board-targets');
const store = require('./recruiting-store');

const DAY_MS = 24 * 60 * 60 * 1000;

function slugKey(value) {
  return String(value || '').trim().toLowerCase();
}

function isoDay(value) {
  const d = new Date(value);
  if (Number.isFinite(d.getTime())) return d.toISOString().slice(0, 10);
  const s = String(value || '').trim();
  const m = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const parsed = Date.parse(s);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return null;
}

function isFloridaVisit(entry) {
  const school = String(entry?.school || 'Florida');
  return isFloridaSchool(school) || /\bgators\b|\buf\b|gainesville/i.test(school);
}

function visitLabel(visitType) {
  const t = String(visitType || '').toLowerCase();
  if (/home/.test(t)) return 'home visit';
  if (t.includes('unofficial') || /\buv\b/.test(t) || /junior/.test(t) || t.includes('camp')) {
    return 'unofficial visit';
  }
  if (t.includes('official') || t === 'ov') return 'official visit';
  return 'campus visit';
}

async function resolveTargetSlugs(classYear) {
  const allow = getAllowlistSet(classYear);
  let live = [];
  try {
    live = await getLiveBoardTargets(classYear);
  } catch {
    live = [];
  }
  const ordered = [];
  const seen = new Set();
  for (const slug of allow) {
    const key = slugKey(slug);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    ordered.push(key);
  }
  for (const row of live) {
    const key = slugKey(row.slug);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    ordered.push(key);
  }
  return ordered;
}

function playerDisplayName(slug, fallback) {
  const key = slugKey(slug);
  if (CANONICAL_TARGET_NAMES && CANONICAL_TARGET_NAMES[key]) {
    return CANONICAL_TARGET_NAMES[key];
  }
  return (
    fallback ||
    key
      .split('-')
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ')
  );
}


async function loadPlayerContext(slug, fallbackName) {
  let player = null;
  try {
    player = (await store.getPlayerBySlug(slug)) || null;
  } catch {
    player = null;
  }
  const school = String(player?.school || player?.highSchool || '').trim();
  // Never pass college "Florida" as HS identity — omit when unknown.
  const safeSchool =
    school && !/^florida$/i.test(school) && !/gators/i.test(school) ? school : null;
  return {
    player,
    playerName: playerDisplayName(slug, player?.name || player?.fullName || fallbackName),
    pos: player?.pos || player?.position || null,
    classYear: player?.classYear || player?.class_year || null,
    school: safeSchool,
    playerId: player?.on3Id || player?.id || slug,
  };
}

async function ensureIntelRow(raw, { dryRun }) {
  const fp = raw.fingerprint;
  if (!fp) return { created: false, skipped: true, reason: 'no_fingerprint' };
  if (intelStore.hasIntelFingerprint(fp)) {
    return { created: false, skipped: true, reason: 'duplicate', fingerprint: fp };
  }
  if (dryRun) {
    return { created: true, dryRun: true, fingerprint: fp, slug: raw.playerSlug };
  }
  await intelStore.initIntelStore();
  const result = await intelStore.addIntel(raw);
  return {
    created: !!result?.created,
    skipped: !!result?.skipped || !!result?.duplicate,
    reason: result?.reason || (result?.duplicate ? 'duplicate' : undefined),
    fingerprint: fp,
    slug: raw.playerSlug,
  };
}

/**
 * Coverage report for ops / FutureCast health.
 */
function measureAllowlistIntelCoverage(classYear = 2028, { days = 30 } = {}) {
  const allow = [...getAllowlistSet(classYear)];
  const since = new Date(Date.now() - days * DAY_MS).toISOString();
  const rows = intelStore.listIntel({ limit: 5000, since: new Date(Date.now() - 180 * DAY_MS).toISOString() });
  const bySlug = new Map();
  for (const row of rows) {
    const key = slugKey(row.playerSlug || row.player_slug || row.slug);
    if (!key) continue;
    if (!bySlug.has(key)) bySlug.set(key, []);
    bySlug.get(key).push(row);
  }
  let withAny = 0;
  let withRecent = 0;
  const missing = [];
  const thin = [];
  for (const slug of allow) {
    const key = slugKey(slug);
    const list = bySlug.get(key) || [];
    if (list.length) withAny += 1;
    else missing.push(key);
    const recent = list.some((r) => String(r.reportedAt || r.createdAt || '') >= since);
    if (recent) withRecent += 1;
    else if (list.length) thin.push(key);
  }
  return {
    classYear,
    allowlistSize: allow.length,
    withAnyIntel: withAny,
    withIntelInWindow: withRecent,
    windowDays: days,
    coveragePct: allow.length ? Math.round((withAny / allow.length) * 1000) / 10 : 0,
    recentCoveragePct: allow.length ? Math.round((withRecent / allow.length) * 1000) / 10 : 0,
    missing,
    thin,
  };
}

/**
 * Materialize visit/offer process signals into intel for every allowlist target.
 */
async function runAllowlistIntelSweep(opts = {}) {
  const { runHeavyJob } = require('./heavy-job-gate');
  return runHeavyJob('allowlist-intel-sweep', () => runAllowlistIntelSweepInner(opts));
}

async function runAllowlistIntelSweepInner({
  classYear = 2028,
  days = 180,
  dryRun = false,
  maxCreates = 200,
} = {}) {
  const cutoffMs = Date.now() - days * DAY_MS;
  const slugs = await resolveTargetSlugs(classYear);
  const slugSet = new Set(slugs);

  const results = {
    ok: true,
    classYear,
    targetCount: slugs.length,
    scannedVisits: 0,
    scannedOffers: 0,
    created: [],
    skipped: [],
    errors: [],
  };

  const visits = visitLogStore.listVisitLogs({ limit: 8000 });
  for (const row of visits) {
    const slug = slugKey(row.playerSlug);
    if (!slug || !slugSet.has(slug)) continue;
    if (!isFloridaVisit(row)) continue;
    const ts = new Date(row.date || row.reportedAt).getTime();
    if (!Number.isFinite(ts) || ts < cutoffMs) continue;
    results.scannedVisits += 1;
    const day = isoDay(row.date || row.reportedAt) || isoDay(row.reportedAt);
    if (!day) continue;
    const vType = row.visitType || row.eventType || 'visit';
    const label = visitLabel(vType);
    const ctx = await loadPlayerContext(slug, row.playerName);
    const name = ctx.playerName;
    const detail =
      String(row.detail || '').trim() ||
      `${name} — Florida ${label} on file (${day}). Continuous allowlist intel sweep.`;
    const fp = `allowlist_sweep_visit_${slug}_${day}_${String(vType).toLowerCase().replace(/\s+/g, '_')}`;
    try {
      if (results.created.length >= maxCreates) break;
      // reportedAt = sweep time (signal confirmed on file now); visit day stays in detail/fp.
      const now = new Date().toISOString();
      const out = await ensureIntelRow(
        {
          playerId: row.playerId || ctx.playerId,
          playerSlug: slug,
          playerName: name,
          classYear: ctx.classYear || classYear,
          pos: ctx.pos,
          // target_update (not visit eventType) — avoids recruiting-store visit upsert side effects.
          // Visit traction for chase still comes from visit-log-store.
          eventType: 'target_update',
          status: `Florida ${label}`,
          detail,
          text: detail.slice(0, 280),
          timestamp: now,
          reportedAt: now,
          source: 'auto:allowlist-intel-sweep',
          sourceType: 'visit',
          ufRelevant: true,
          identityConfirmed: true,
          fingerprint: fp,
          ...(ctx.school ? { school: ctx.school } : {}),
        },
        { dryRun }
      );
      if (out.created) results.created.push({ kind: 'visit', ...out });
      else results.skipped.push({ kind: 'visit', slug, reason: out.reason || 'skip' });
    } catch (err) {
      results.errors.push({ slug, kind: 'visit', error: err.message });
    }
  }

  const offers = offerLogStore.listOfferLogs({ limit: 8000 });
  for (const row of offers) {
    const slug = slugKey(row.playerSlug);
    if (!slug || !slugSet.has(slug)) continue;
    if (!isFloridaSchool(row.school || 'Florida')) continue;
    const ts = new Date(row.date || row.reportedAt).getTime();
    if (!Number.isFinite(ts) || ts < cutoffMs) continue;
    results.scannedOffers += 1;
    const day = isoDay(row.date || row.reportedAt) || isoDay(row.reportedAt);
    if (!day) continue;
    const ctx = await loadPlayerContext(slug, row.playerName);
    const name = ctx.playerName;
    const detail =
      String(row.detail || '').trim() ||
      `${name} — Florida offer on file (${day}). Continuous allowlist intel sweep.`;
    const fp = `allowlist_sweep_offer_${slug}_${day}`;
    try {
      if (results.created.length >= maxCreates) break;
      const now = new Date().toISOString();
      const out = await ensureIntelRow(
        {
          playerId: row.playerId || ctx.playerId,
          playerSlug: slug,
          playerName: name,
          classYear: ctx.classYear || classYear,
          pos: ctx.pos,
          eventType: 'offer',
          status: 'Florida offer',
          detail,
          text: detail.slice(0, 280),
          timestamp: now,
          reportedAt: now,
          source: 'auto:allowlist-intel-sweep',
          sourceHandle: row.source || null,
          sourceType: 'offer',
          ufRelevant: true,
          identityConfirmed: true,
          fingerprint: fp,
          ...(ctx.school ? { school: ctx.school } : {}),
        },
        { dryRun }
      );
      if (out.created) results.created.push({ kind: 'offer', ...out });
      else results.skipped.push({ kind: 'offer', slug, reason: out.reason || 'skip' });
    } catch (err) {
      results.errors.push({ slug, kind: 'offer', error: err.message });
    }
  }

  const coverageBefore = measureAllowlistIntelCoverage(classYear, { days: 30 });
  // Re-measure after writes (same process memory).
  const coverage = measureAllowlistIntelCoverage(classYear, { days: 30 });

  return {
    ...results,
    createdCount: results.created.length,
    skippedCount: results.skipped.length,
    errorCount: results.errors.length,
    coverageBefore,
    coverage,
  };
}

module.exports = {
  runAllowlistIntelSweep,
  measureAllowlistIntelCoverage,
  resolveTargetSlugs,
  isoDay,
  visitLabel,
};
