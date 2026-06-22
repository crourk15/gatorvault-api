/**
 * Postgres persistence for recruiting intel — survives Render redeploys.
 * Falls back to JSON-only when DATABASE_URL is unset.
 */
const fs = require('fs');
const path = require('path');

const MIGRATION_PATH = path.join(__dirname, '..', 'migrations', '019_create_recruiting_intel.sql');

function databaseUrl() {
  const url = process.env.DATABASE_URL && String(process.env.DATABASE_URL).trim();
  return url || null;
}

function isEnabled() {
  return !!databaseUrl();
}

function pgClient() {
  const { Client } = require('pg');
  return new Client({ connectionString: databaseUrl(), ssl: { rejectUnauthorized: false } });
}

async function ensureTable() {
  if (!isEnabled()) return false;
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
  const client = pgClient();
  await client.connect();
  try {
    await client.query(sql);
    return true;
  } finally {
    await client.end().catch(() => {});
  }
}

function rowToItem(row) {
  if (!row) return null;
  const payload = row.payload;
  if (payload && typeof payload === 'object') return payload;
  try {
    return typeof payload === 'string' ? JSON.parse(payload) : null;
  } catch {
    return null;
  }
}

async function loadAll({ limit = 5000 } = {}) {
  if (!isEnabled()) return [];
  const client = pgClient();
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT payload
       FROM recruiting_intel
       ORDER BY reported_at DESC NULLS LAST, updated_at DESC
       LIMIT $1`,
      [Math.max(1, Math.min(limit, 10000))]
    );
    return rows.map(rowToItem).filter(Boolean);
  } finally {
    await client.end().catch(() => {});
  }
}

async function countAll() {
  if (!isEnabled()) return 0;
  const client = pgClient();
  await client.connect();
  try {
    const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM recruiting_intel');
    return rows[0]?.n || 0;
  } finally {
    await client.end().catch(() => {});
  }
}

async function upsertItem(item) {
  if (!isEnabled() || !item?.fingerprint) return false;
  const client = pgClient();
  await client.connect();
  try {
    const reportedAt = item.reportedAt || item.createdAt || new Date().toISOString();
    await client.query(
      `INSERT INTO recruiting_intel (
         fingerprint, id, player_id, player_slug, player_name, event_type, reported_at, payload, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
       ON CONFLICT (fingerprint) DO UPDATE SET
         id = EXCLUDED.id,
         player_id = EXCLUDED.player_id,
         player_slug = EXCLUDED.player_slug,
         player_name = EXCLUDED.player_name,
         event_type = EXCLUDED.event_type,
         reported_at = EXCLUDED.reported_at,
         payload = EXCLUDED.payload,
         updated_at = NOW()`,
      [
        item.fingerprint,
        item.id || item.fingerprint,
        item.playerId || null,
        item.playerSlug || null,
        item.playerName || null,
        item.eventType || null,
        reportedAt,
        JSON.stringify(item),
      ]
    );
    return true;
  } finally {
    await client.end().catch(() => {});
  }
}

async function bulkUpsert(items) {
  if (!isEnabled() || !items?.length) return 0;
  let n = 0;
  for (const item of items) {
    if (await upsertItem(item)) n += 1;
  }
  return n;
}

async function replaceAll(items) {
  if (!isEnabled()) return 0;
  const client = pgClient();
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM recruiting_intel');
    for (const item of items || []) {
      if (!item?.fingerprint) continue;
      const reportedAt = item.reportedAt || item.createdAt || new Date().toISOString();
      await client.query(
        `INSERT INTO recruiting_intel (
           fingerprint, id, player_id, player_slug, player_name, event_type, reported_at, payload, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())`,
        [
          item.fingerprint,
          item.id || item.fingerprint,
          item.playerId || null,
          item.playerSlug || null,
          item.playerName || null,
          item.eventType || null,
          reportedAt,
          JSON.stringify(item),
        ]
      );
    }
    await client.query('COMMIT');
    return (items || []).length;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end().catch(() => {});
  }
}

async function deleteFingerprints(fingerprints) {
  if (!isEnabled() || !fingerprints?.length) return 0;
  const client = pgClient();
  await client.connect();
  try {
    const { rowCount } = await client.query(
      'DELETE FROM recruiting_intel WHERE fingerprint = ANY($1::text[])',
      [fingerprints.filter(Boolean)]
    );
    return rowCount || 0;
  } finally {
    await client.end().catch(() => {});
  }
}

function getStoreInfo() {
  return {
    mode: isEnabled() ? 'postgres' : 'json',
    databaseUrl: isEnabled() ? '(set)' : '(unset)',
    migration: path.basename(MIGRATION_PATH),
  };
}

module.exports = {
  isEnabled,
  ensureTable,
  loadAll,
  countAll,
  upsertItem,
  bulkUpsert,
  replaceAll,
  deleteFingerprints,
  getStoreInfo,
};
