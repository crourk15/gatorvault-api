/**
 * Apply a SQL migration file to Postgres (uses DATABASE_URL from server/.env).
 * Usage: npx tsx migrators/run-migration.ts migrations/011_create_predictions_table.sql
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { db, closeDb } from '../models/db';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main(): Promise<void> {
  const rel = process.argv[2];
  if (!rel) {
    console.error('Usage: npx tsx migrators/run-migration.ts <migration-file.sql>');
    process.exit(1);
  }

  const filePath = path.join(__dirname, '..', rel);
  if (!fs.existsSync(filePath)) {
    console.error('Migration file not found:', filePath);
    process.exit(1);
  }

  const sql = fs.readFileSync(filePath, 'utf8');
  await db.query(sql);
  console.log('Migration applied:', rel);
  await closeDb();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
