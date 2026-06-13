/**
 * Quick DB connectivity test — prints error code only, never credentials.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function main() {
  const { db, closeDb } = await import('../models/db.ts');
  try {
    const r = await db.query('SELECT current_database() AS db, current_user AS usr');
    console.log('connected:', r.rows[0]);
    const schema = await db.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'futurecast' AND table_name = 'predictions') AS has_predictions"
    );
    console.log('futurecast.predictions exists:', schema.rows[0]?.has_predictions);
    const counts = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM futurecast.players) AS players,
        (SELECT COUNT(*)::int FROM futurecast.predictions) AS predictions
    `);
    console.log('counts:', counts.rows[0]);
  } catch (err) {
    const e = err;
    console.error('connection failed:', e.code || e.message);
  } finally {
    await closeDb();
  }
}

main();
