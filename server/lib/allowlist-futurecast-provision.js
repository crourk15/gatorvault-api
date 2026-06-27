/**
 * Seed MODEL predictions for allowlist underclassmen missing Rivals PM rows.
 * Unlocks underclassmen watchboard trendDelta7d / stock board movement.
 */
require('tsx/cjs');

const store = require('./recruiting-store');
const { getAllowlistSet, getMergedCanonicalNames } = require('./recruiting-target-allowlist');
const {
  normalizeAllowlistSlug,
  buildAllowlistSlugAliasLookup,
  dedupeAllowlistSlugs,
} = require('./allowlist-slug-aliases');
const { loadCanonicalOn3SlugMap } = require('./on3-recruit-discovery');
const { toPercent, loadRivalsOnlyUfPctBySlug } = require('./uf-probability-utils');

const path = require('path');
const ON3_RPM_PATH = path.join(__dirname, '..', 'data', 'war-room', 'on3-rpm-allowlist.json');
const BOARD_2028_PATH = path.join(__dirname, '..', 'data', 'recruiting', '2028-target-board.json');
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
    ...require('../models/player-slug.ts'),
    ...require('../models/predictions.ts'),
    ...require('../models/uf-specific-profile.ts'),
  };
}

function load2028BoardRow(slug) {
  try {
    const doc = JSON.parse(require('fs').readFileSync(BOARD_2028_PATH, 'utf8'));
    return (
      (doc.targets || []).find((t) => String(t.slug || '').toLowerCase() === String(slug).toLowerCase()) ||
      null
    );
  } catch {
    return null;
  }
}

async function resolveSeedConfidence(slug, pgPlayer) {
  const canonical = normalizeAllowlistSlug(slug, pgPlayer.class_year);
  const rivalsOnly = loadRivalsOnlyUfPctBySlug();
  if (rivalsOnly.has(canonical)) {
    return { confidence: rivalsOnly.get(canonical), source: 'rivals_pm' };
  }

  const recruiting = await store.getPlayerBySlug(canonical);
  const boardRow = load2028BoardRow(canonical);
  const boardPct = toPercent(boardRow?.ufProbability);
  const storePct = toPercent(
    recruiting?.ufProbability ?? recruiting?.ufRpmPct ?? recruiting?.futurecastProbability
  );
  const mergedPct = Math.max(storePct, boardPct);
  if (mergedPct >= 10) {
    return {
      confidence: mergedPct,
      source: storePct >= boardPct && storePct >= 10 ? 'store' : 'board',
    };
  }

  const { getUFSpecificProfileByPlayerId } = loadModels();
  const ufProfile = await getUFSpecificProfileByPlayerId(pgPlayer.id);
  const ufPct = toPercent(ufProfile?.uf_commit_probability);
  if (ufPct > 0) return { confidence: ufPct, source: 'uf_profile' };

  const forward = loadCanonicalOn3SlugMap();
  const on3Key = String(forward[canonical] || '').toLowerCase();
  const on3Rpm =
    loadOn3RpmBySlug().get(canonical) ||
    (on3Key ? loadOn3RpmBySlug().get(on3Key) : undefined);
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

async function findPostgresPlayerForAllowlistSlug(slug, classYear) {
  const { getPlayerBySlug, getPlayerById, resolvePostgresPlayerBySlug } = loadModels();
  const canonical = normalizeAllowlistSlug(slug, classYear);
  const lookup = buildAllowlistSlugAliasLookup([canonical], classYear);
  for (const alias of lookup.keys()) {
    const player = await getPlayerBySlug(alias);
    if (player) return player;
  }
  const resolved = await resolvePostgresPlayerBySlug(canonical);
  if (resolved?.playerId) {
    return (await getPlayerById(resolved.playerId)) || null;
  }
  return null;
}

async function ensureAllowlistPostgresPlayer(slug, classYear) {
  const existing = await findPostgresPlayerForAllowlistSlug(slug, classYear);
  if (existing) return existing;

  const canonical = normalizeAllowlistSlug(slug, classYear);
  const names = getMergedCanonicalNames();
  const recruiting = await store.getPlayerBySlug(canonical);
  const boardRow = load2028BoardRow(canonical);
  const fullName =
    String(recruiting?.name || boardRow?.name || names[canonical] || canonical).trim() || canonical;
  const position = String(recruiting?.pos || recruiting?.position || boardRow?.pos || 'ATH')
    .trim()
    .toUpperCase();

  const { upsertPlayer, ensurePlayerSlugAlias } = loadModels();
  const player = await upsertPlayer({
    slug: canonical,
    full_name: fullName,
    position,
    class_year: Number(classYear),
    status: 'HS',
    state: recruiting?.state || boardRow?.state || null,
    high_school: recruiting?.school || recruiting?.highSchool || boardRow?.school || null,
    stars: Number(recruiting?.stars ?? boardRow?.stars ?? 0) || null,
    composite_rating:
      recruiting?.rating != null
        ? Number(recruiting.rating)
        : boardRow?.rating != null
          ? Number(boardRow.rating)
          : null,
    ranking_national: recruiting?.natlRank ?? boardRow?.natlRank ?? null,
    ranking_position: recruiting?.posRank ?? boardRow?.posRank ?? null,
    ranking_state: recruiting?.stateRank ?? boardRow?.stateRank ?? null,
  });

  await ensurePlayerSlugAlias(player.id, canonical, true);
  const forward = loadCanonicalOn3SlugMap();
  const on3Slug = String(recruiting?.on3Slug || forward[canonical] || '').toLowerCase();
  if (on3Slug && on3Slug !== canonical) {
    await ensurePlayerSlugAlias(player.id, on3Slug, false);
  }

  return player;
}

async function syncAllowlistSlugAliases(pgPlayer, classYear) {
  const { ensurePlayerSlugAlias } = loadModels();
  const canonical = normalizeAllowlistSlug(pgPlayer.slug, classYear);
  if (String(pgPlayer.slug || '').toLowerCase() !== canonical) {
    await ensurePlayerSlugAlias(pgPlayer.id, canonical, true);
  }
  const forward = loadCanonicalOn3SlugMap();
  const on3Slug = String(forward[canonical] || '').toLowerCase();
  if (on3Slug && on3Slug !== canonical) {
    await ensurePlayerSlugAlias(pgPlayer.id, on3Slug, false);
  }
}

async function provisionAllowlistPredictionForSlug(slug, classYear, options = {}) {
  const key = String(slug || '').toLowerCase();
  if (!key) return { slug: key, ok: false, reason: 'missing_slug' };

  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  if (!dbUrl) return { slug: key, ok: false, reason: 'no_database' };

  const { upsertActiveModelPrediction, ensureMovementWindowBaseline } = loadModels();
  let pgPlayer = await findPostgresPlayerForAllowlistSlug(key, classYear);
  if (!pgPlayer && !options.dryRun) {
    try {
      pgPlayer = await ensureAllowlistPostgresPlayer(key, classYear);
    } catch (err) {
      return {
        slug: key,
        ok: false,
        reason: 'postgres_upsert_failed',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
  if (!pgPlayer) return { slug: key, ok: false, reason: 'player_not_in_postgres' };
  await syncAllowlistSlugAliases(pgPlayer, classYear);
  if (Number(pgPlayer.class_year) !== Number(classYear)) {
    return { slug: key, ok: false, reason: 'class_year_mismatch', classYear: pgPlayer.class_year };
  }

  if (await hasRivalsPmPrediction(pgPlayer.id)) {
    return { slug: key, ok: true, skipped: true, reason: 'rivals_pm_present' };
  }

  if (await hasAllowlistSeedPrediction(pgPlayer.id)) {
    const existingSeed = await resolveSeedConfidence(key, pgPlayer);
    if (existingSeed?.confidence > 0 && !options.dryRun) {
      await ensureMovementWindowBaseline(pgPlayer.id, existingSeed.confidence, {
        priorConfidence: Math.max(1, existingSeed.confidence - BASELINE_GAP),
        windowDays: options.windowDays || 30,
      });
    }
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
      : dedupeAllowlistSlugs(
          [...getAllowlistSet(classYear)].map((s) => String(s).toLowerCase()),
          classYear
        );

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
  ensureAllowlistPostgresPlayer,
  PREDICTOR_ID,
};
