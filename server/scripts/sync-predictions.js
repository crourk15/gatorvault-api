/**
 * Sync MODEL predictions locally and report counts.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function main() {
  const { listPredictionCandidates, upsertActiveModelPrediction } = await import('../models/predictions.ts');
  const { syncModelPredictionsForCandidates } = await import('../api/predictions/engine.ts');
  const { db, closeDb } = await import('../models/db.ts');

  const candidates = await listPredictionCandidates({});
  console.log('candidates:', candidates.length);

  const synced = await syncModelPredictionsForCandidates(candidates, upsertActiveModelPrediction);
  console.log('synced picks:', synced);

  const rows = await db.query('SELECT COUNT(*)::int AS n FROM futurecast.predictions');
  console.log('predictions in db:', rows.rows[0].n);

  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
