/**
 * Fetch DATABASE_URL from Render gatorvault-api env and apply a SQL migration.
 * Requires RENDER_API_KEY in server/.env (Render → Account Settings → API Keys).
 *
 * Usage: npx tsx migrators/run-migration-render.ts migrations/011_create_predictions_table.sql
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const API = 'https://api.render.com/v1';
const SERVICE_NAME = 'gatorvault-api';

async function fetchDatabaseUrl(): Promise<string> {
  const key = process.env.RENDER_API_KEY;
  if (!key) {
    throw new Error('RENDER_API_KEY missing in server/.env');
  }

  const headers = {
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
  };

  const servicesRes = await fetch(`${API}/services?name=${encodeURIComponent(SERVICE_NAME)}&limit=20`, {
    headers,
  });
  if (!servicesRes.ok) {
    throw new Error(`Render services lookup failed: ${servicesRes.status}`);
  }

  const rows = (await servicesRes.json()) as Array<{ service?: { id: string; name: string }; id?: string; name?: string }>;
  const svc = rows.find((row) => (row.service || row).name === SERVICE_NAME);
  if (!svc) {
    throw new Error(`Render service ${SERVICE_NAME} not found`);
  }

  const serviceId = (svc.service || svc).id;
  const envRes = await fetch(`${API}/services/${serviceId}/env-vars?limit=100`, { headers });
  if (!envRes.ok) {
    throw new Error(`Render env-vars lookup failed: ${envRes.status}`);
  }

  const envRows = (await envRes.json()) as Array<{ envVar?: { key: string; value: string }; key?: string; value?: string }>;
  const byKey: Record<string, string> = {};
  for (const row of envRows) {
    const ev = row.envVar || row;
    if (ev.key && ev.value) byKey[ev.key] = ev.value;
  }

  const url = byKey.DATABASE_URL || byKey.SUPABASE_DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL not found on Render gatorvault-api — add it in Render Dashboard → Environment');
  }
  return url;
}

async function main(): Promise<void> {
  const rel = process.argv[2];
  if (!rel) {
    console.error('Usage: npx tsx migrators/run-migration-render.ts <migration-file.sql>');
    process.exit(1);
  }

  const filePath = path.join(__dirname, '..', rel);
  if (!fs.existsSync(filePath)) {
    console.error('Migration file not found:', rel);
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || (await fetchDatabaseUrl());
  const useSsl =
    process.env.FUTURECAST_DB_SSL === 'true' ||
    /supabase\.co|render\.com/i.test(connectionString) ||
    process.env.NODE_ENV === 'production';

  const pool = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });

  const sql = fs.readFileSync(filePath, 'utf8');
  await pool.query(sql);
  await pool.end();

  console.log('Migration applied on Render Postgres:', rel);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
