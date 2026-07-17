/**
 * Postgres persistence for push subscriptions + device tokens — survives Render redeploys.
 */
const fs = require('fs');
const path = require('path');

const MIGRATION_PATH = path.join(__dirname, '..', 'migrations', '020_create_push_subscriptions.sql');
const DEVICE_MIGRATION_PATH = path.join(
  __dirname,
  '..',
  'migrations',
  '022_create_push_device_tokens.sql'
);

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

async function ensureTables() {
  if (!isEnabled()) return false;
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
  const deviceSql = fs.readFileSync(DEVICE_MIGRATION_PATH, 'utf8');
  const client = pgClient();
  await client.connect();
  try {
    await client.query(sql);
    await client.query(deviceSql);
    return true;
  } finally {
    await client.end().catch(() => {});
  }
}

async function loadDoc() {
  if (!isEnabled()) return null;
  const client = pgClient();
  await client.connect();
  try {
    const { rows: subs } = await client.query(
      `SELECT endpoint, email, keys, prefs, updated_at
       FROM push_subscriptions
       ORDER BY updated_at DESC`
    );
    let devices = [];
    try {
      const { rows } = await client.query(
        `SELECT token, email, platform, prefs, updated_at
         FROM push_device_tokens
         ORDER BY updated_at DESC`
      );
      devices = rows;
    } catch {
      devices = [];
    }
    const { rows: fps } = await client.query(
      `SELECT fingerprint
       FROM push_dispatch_fingerprints
       ORDER BY created_at DESC
       LIMIT 500`
    );
    return {
      version: 2,
      subscriptions: subs.map((row) => ({
        email: row.email,
        endpoint: row.endpoint,
        keys: row.keys,
        prefs: row.prefs || {},
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      })),
      deviceTokens: devices.map((row) => ({
        email: row.email,
        token: row.token,
        platform: row.platform || 'ios',
        prefs: row.prefs || {},
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      })),
      dispatchFingerprints: fps.map((row) => row.fingerprint).filter(Boolean),
    };
  } finally {
    await client.end().catch(() => {});
  }
}

async function replaceDoc(doc) {
  if (!isEnabled()) return false;
  const client = pgClient();
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM push_subscriptions');
    await client.query('DELETE FROM push_dispatch_fingerprints');
    try {
      await client.query('DELETE FROM push_device_tokens');
    } catch {
      /* table may not exist yet */
    }
    for (const sub of doc.subscriptions || []) {
      await client.query(
        `INSERT INTO push_subscriptions (endpoint, email, keys, prefs, updated_at)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, COALESCE($5::timestamptz, NOW()))`,
        [
          sub.endpoint,
          sub.email,
          JSON.stringify(sub.keys || {}),
          JSON.stringify(sub.prefs || {}),
          sub.updatedAt || null,
        ]
      );
    }
    for (const device of doc.deviceTokens || []) {
      await client.query(
        `INSERT INTO push_device_tokens (token, email, platform, prefs, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, COALESCE($5::timestamptz, NOW()))
         ON CONFLICT (token) DO UPDATE SET
           email = EXCLUDED.email,
           platform = EXCLUDED.platform,
           prefs = EXCLUDED.prefs,
           updated_at = EXCLUDED.updated_at`,
        [
          device.token,
          device.email,
          device.platform || 'ios',
          JSON.stringify(device.prefs || {}),
          device.updatedAt || null,
        ]
      );
    }
    for (const fp of doc.dispatchFingerprints || []) {
      await client.query(
        `INSERT INTO push_dispatch_fingerprints (fingerprint) VALUES ($1)
         ON CONFLICT (fingerprint) DO NOTHING`,
        [fp]
      );
    }
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end().catch(() => {});
  }
}

async function persistDoc(doc) {
  return replaceDoc(doc);
}

module.exports = {
  isEnabled,
  ensureTables,
  loadDoc,
  replaceDoc,
  persistDoc,
};
