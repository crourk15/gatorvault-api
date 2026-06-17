/**
 * Postgres FutureCast sync — CommonJS bridge for Rivals PM ingest on Render.
 */
require('tsx/cjs');

const { createRequire } = require('module');
const req = createRequire(__filename);

let models;

function loadModels() {
  if (!models) {
    models = {
      ...req('../models/player.ts'),
      ...req('../models/predictions.ts'),
      ...req('../models/competing-school-history.ts')
    };
  }
  return models;
}

async function syncModelPrediction(player, row, predictionEvent = {}) {
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  if (!dbUrl) {
    return { ok: false, reason: 'no_database' };
  }
  if (!player?.slug || row.confidence == null) {
    return { ok: false, reason: 'missing_player_or_confidence' };
  }

  const { getPlayerBySlug, ensureMovementWindowBaseline, upsertActiveModelPrediction } = loadModels();
  const pgPlayer = await getPlayerBySlug(player.slug);
  if (!pgPlayer) {
    return { ok: false, reason: 'player_not_in_postgres', slug: player.slug };
  }

  const confidence = Math.round(Number(row.confidence));
  let windowDelta = null;
  if (predictionEvent.priorConfidence != null) {
    windowDelta = await ensureMovementWindowBaseline(pgPlayer.id, confidence, {
      priorConfidence: predictionEvent.priorConfidence
    });
  }

  await upsertActiveModelPrediction({
    player_id: pgPlayer.id,
    school: row.predictionSchool || 'Florida',
    confidence,
    source_type: 'MODEL',
    predictor_id: 'rivals_pm'
  });

  let competingLogged = 0;
  if (Array.isArray(row.competingSchools) && row.competingSchools.length) {
    const { logCompetingSchoolRanks } = loadModels();
    competingLogged = await logCompetingSchoolRanks(pgPlayer.id, row.competingSchools);
  }

  return { ok: true, slug: player.slug, windowDelta, competingLogged };
}

async function reseedMovementBaselines(candidates) {
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  if (!dbUrl) return { ok: false, reason: 'no_database', seeded: 0 };

  const { getPlayerBySlug, ensureMovementWindowBaseline, upsertActiveModelPrediction } = loadModels();
  let seeded = 0;

  for (const intel of candidates) {
    const pgPlayer = await getPlayerBySlug(intel.playerSlug);
    if (!pgPlayer) continue;
    const delta = await ensureMovementWindowBaseline(pgPlayer.id, intel.confidence, {
      priorConfidence: intel.priorConfidence
    });
    if (delta == null) continue;
    await upsertActiveModelPrediction({
      player_id: pgPlayer.id,
      school: intel.predictionSchool || 'Florida',
      confidence: intel.confidence,
      source_type: 'MODEL',
      predictor_id: 'rivals_pm'
    });
    seeded += 1;
  }

  return { ok: true, seeded, candidates: candidates.length };
}

module.exports = {
  syncModelPrediction,
  reseedMovementBaselines
};
