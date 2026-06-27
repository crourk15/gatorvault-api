/**
 * Seed MODEL predictions for allowlist underclassmen missing Rivals PM rows.
 * Unlocks underclassmen watchboard trendDelta7d / stock board movement.
 */
require('tsx/cjs');

const store = require('./recruiting-store');
const { getAllowlistSet } = require('./recruiting-target-allowlist');
const { toPercent, loadRivalsOnlyUfPctBySlug } = require('./uf-probability-utils');

const ON3_RPM_PATH = require('path').join(__dirname, '..', 'data', 'war-room', 'on3-rpm-allowlist.json');
const PREDICTOR_ID = 'allowlist_seed';
const BASELINE_GAP = 4;

function loadOn3RpmBySlug() {
  const map = new Map();
  try {
    const doc = JSON.parse(require('fs').readFileSync(ON3_RPM_PATH, 'utf8'));
    for (const row of doc.entries || []) {
      const slug = String(row.playerSlug || '').toLowerCase();
      const pct = toPercent(row.ufPct ?? row.ufProbability);
      if (slug && pct > 0) map.set(slug, pct);
    }
  } catch {
    /* optional */
  }
  return map;
}

function loadModels() {
  return {
    ...require('../models/player.ts'),
    ...require('../models/predictions.ts'),
    ...require('../models/uf-specific-profile.ts'),
  };
}

async function resolveSeedConfidence(slug, pgPlayer) {
  const rivalsOnly = loadRivalsOnlyUfPctBySlug();
  if (rivalsOnly.has(slug)) {
    return { confidence: rivalsOnly.get(slug), source: 'rivals_pm' };
  }

  const recruiting = await store.getPlayerBySlug(slug);
  const storePct = toPercent(
    recruiting?.ufProbability ?? recruiting?.ufRpmPct ?? recruiting?.futurecastProbability
  );
  if (storePct > 0) return { confidence: storePct, source: 'store' };

  const { getUFSpecificProfileByPlayerId } = loadModels();
  const ufProfile = await getUFSpecificProfileByPlayerId(pgPlayer.id);
  const ufPct = toPercent(ufProfile?.uf_commit_probability);
  if (ufPct > 0) return { confidence: ufPct, source: 'uf_profile' };

  const on3Rpm = loadOn3RpmBySlug().get(slug);
  if (on3Rpm > 0) return { confidence: on3Rpm, source: 'on3_rpm' };

  const stars = Number(recruiting?.stars ?? pgPlayer.stars ?? 0) || 0;
  if (stars >= 4) return { confidence: 25, source: 'estimate_4star', lowConfidence: true };
  if (stars >= 3) return { confidence: 15, source: 'estimate_3star', lowConfidence: true };

  return null;
}

async function hasRivalsPmPrediction(playerId) {
  const { listPredictionsByPlayerId } = loadModels();
  const preds = await listPredictionsByPlayerId(playerId);
  return preds.some(
    (row) =>
      String(row.source_type || '').toUpperCase() === 'MODEL' &&
      String(row.predictor_id || '') === 'rivals_pm' &&
      String(row.status || '').toUpperCase() === 'ACTIVE'
  );
}

async function hasAllowlistSeedPrediction(playerId) {
  const { listPredictionsByPlayerId } = loadModels();
  const preds = await listPredictionsByPlayerId(playerId);
  return preds.some(
    (row) =>
      String(row.source_type || '').toUpperCase() === 'MODEL' &&
      String(row.predictor_id || '') === PREDICTOR_ID &&
      String(row.status || '').toUpperCase() === 'ACTIVE'
  );
}

async function provisionAllowlistPredictionForSlug(slug, classYear, options = {}) {
  const key = String(slug || '').toLowerCase();
  if (!key) return { slug: key, ok: false, reason: 'missing_slug' };

  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  if (!dbUrl) return { slug: key, ok: false, reason: 'no_database' };

  const { getPlayerBySlug, upsertActiveModelPrediction, ensureMovementWindowBaseline } = loadModels();
  const pgPlayer = await getPlayerBySlug(key);
  if (!pgPlayer) return { slug: key, ok: false, reason: 'player_not_in_postgres' };
  if (Number(pgPlayer.class_year) !== Number(classYear)) {
    return { slug: key, ok: false, reason: 'class_year_mismatch', classYear: pgPlayer.class_year };
  }

  if (await hasRivalsPmPrediction(pgPlayer.id)) {
    return { slug: key, ok: true, skipped: true, reason: 'rivals_pm_present' };
  }

  if (await hasAllowlistSeedPrediction(pgPlayer.id)) {
    return { slug: key, ok: true, skipped: true, reason: 'allowlist_seed_present' };
  }

  const seed = await resolveSeedConfidence(key, pgPlayer);
  if (!seed || seed.confidence <= 0) {
    return { slug: key, ok: false, reason: 'no_confidence_seed' };
  }

  if (options.dryRun) {
    return {
      slug: key,
      ok: true,
      dryRun: true,
      confidence: seed.confidence,
      source: seed.source,
      priorConfidence: Math.max(1, seed.confidence - BASELINE_GAP),
    };
  }

  const priorConfidence = Math.max(1, seed.confidence - BASELINE_GAP);
  const windowDelta = await ensureMovementWindowBaseline(pgPlayer.id, seed.confidence, {
    priorConfidence,
    windowDays: options.windowDays || 30,
  });

  await upsertActiveModelPrediction({
    player_id: pgPlayer.id,
    school: 'Florida',
    confidence: seed.confidence,
    source_type: 'MODEL',
    predictor_id: PREDICTOR_ID,
  });

  return {
    slug: key,
    ok: true,
    confidence: seed.confidence,
    source: seed.source,
    windowDelta,
    predictorId: PREDICTOR_ID,
  };
}

async function runAllowlistFuturecastProvision(options = {}) {
  const classYear = Number(options.classYear) || 2028;
  const dryRun = Boolean(options.dryRun);
  const slugs =
    Array.isArray(options.slugs) && options.slugs.length
      ? options.slugs.map((s) => String(s).toLowerCase())
      : [...getAllowlistSet(classYear)].map((s) => String(s).toLowerCase());

  const results = {
    ok: true,
    dryRun,
    classYear,
    total: slugs.length,
    provisioned: 0,
    skipped: 0,
    failed: 0,
    samples: [],
    errors: [],
  };

  for (const slug of slugs) {
    try {
      const row = await provisionAllowlistPredictionForSlug(slug, classYear, options);
      if (row.skipped) {
        results.skipped += 1;
      } else if (row.ok && (row.dryRun || row.predictorId)) {
        results.provisioned += 1;
        if (results.samples.length < 8) results.samples.push(row);
      } else if (!row.ok) {
        results.failed += 1;
        if (results.errors.length < 12) results.errors.push(row);
      }
    } catch (err) {
      results.failed += 1;
      if (results.errors.length < 12) {
        results.errors.push({
          slug,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return results;
}

module.exports = {
  runAllowlistFuturecastProvision,
  provisionAllowlistPredictionForSlug,
  resolveSeedConfidence,
  PREDICTOR_ID,
};
