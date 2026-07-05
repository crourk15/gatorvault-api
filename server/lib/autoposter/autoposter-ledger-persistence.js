/**
 * Postgres persistence for autoposter sent + player-resolution ledgers.
 */
const fs = require('fs');
const path = require('path');

const MIGRATION_PATH = path.join(__dirname, '..', '..', 'migrations', '020_create_autoposter_ledgers.sql');
const SENT_LEDGER_PATH = path.join(__dirname, '..', '..', 'data', 'x', 'autoposter-sent-commits.json');
const RESOLUTION_LEDGER_PATH = path.join(__dirname, '..', '..', 'data', 'autoposter', 'player-resolution-ledger.json');

let persistChain = Promise.resolve();

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
  const client = pgClient();
  await client.connect();
  try {
    await client.query(sql);
    return true;
  } finally {
    await client.end().catch(() => {});
  }
}

function queuePersist(fn) {
  if (!isEnabled()) return;
  persistChain = persistChain.then(fn).catch((err) => {
    console.warn('[autoposter-ledger] postgres persist failed:', err.message);
  });
}

async function persistSentEntry(row) {
  if (!isEnabled() || !row) return false;
  await ensureTables();
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO autoposter_sent_ledger
        (player_slug, intel_fingerprint, text_hash_norm, tweet_id, sent_at, payload, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
       ON CONFLICT DO NOTHING`,
      [
        row.playerSlug || null,
        row.intelFingerprint || null,
        row.textHashNorm || null,
        row.tweetId || null,
        row.sentAt || new Date().toISOString(),
        JSON.stringify(row)
      ]
    );
    return true;
  } finally {
    await client.end().catch(() => {});
  }
}

async function persistPlayerResolution(slug, row) {
  if (!isEnabled() || !slug || !row) return false;
  await ensureTables();
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO autoposter_player_resolution (player_slug, payload, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (player_slug) DO UPDATE
         SET payload = EXCLUDED.payload, updated_at = NOW()`,
      [slug, JSON.stringify(row)]
    );
    return true;
  } finally {
    await client.end().catch(() => {});
  }
}

async function hydrateSentLedger() {
  if (!isEnabled()) return { mode: 'json-only', added: 0 };
  await ensureTables();
  const client = pgClient();
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT payload FROM autoposter_sent_ledger ORDER BY sent_at DESC NULLS LAST LIMIT 500`
    );
    if (!rows.length) return { mode: 'postgres-empty', added: 0 };
    let doc = { version: 1, updatedAt: new Date().toISOString(), entries: [] };
    try {
      doc = JSON.parse(fs.readFileSync(SENT_LEDGER_PATH, 'utf8'));
      if (!Array.isArray(doc.entries)) doc.entries = [];
    } catch {
      doc = { version: 1, updatedAt: new Date().toISOString(), entries: [] };
    }
    let added = 0;
    for (const row of rows) {
      const payload = row.payload && typeof row.payload === 'object' ? row.payload : null;
      if (!payload) continue;
      const key = payload.intelFingerprint || payload.textHashNorm || payload.textHash;
      if (doc.entries.some((e) => (e.intelFingerprint || e.textHashNorm || e.textHash) === key)) continue;
      doc.entries.push(payload);
      added += 1;
    }
    if (added) {
      fs.mkdirSync(path.dirname(SENT_LEDGER_PATH), { recursive: true });
      fs.writeFileSync(SENT_LEDGER_PATH, JSON.stringify(doc, null, 2));
    }
    return { mode: 'postgres', added };
  } finally {
    await client.end().catch(() => {});
  }
}

async function hydratePlayerResolutionLedger() {
  if (!isEnabled()) return { mode: 'json-only', added: 0 };
  await ensureTables();
  const client = pgClient();
  await client.connect();
  try {
    const { rows } = await client.query(`SELECT player_slug, payload FROM autoposter_player_resolution`);
    if (!rows.length) return { mode: 'postgres-empty', added: 0 };
    let doc = { version: 1, updatedAt: new Date().toISOString(), players: {} };
    try {
      doc = JSON.parse(fs.readFileSync(RESOLUTION_LEDGER_PATH, 'utf8'));
      if (!doc.players || typeof doc.players !== 'object') doc.players = {};
    } catch {
      doc = { version: 1, updatedAt: new Date().toISOString(), players: {} };
    }
    let added = 0;
    for (const row of rows) {
      const slug = String(row.player_slug || '').toLowerCase();
      const payload = row.payload && typeof row.payload === 'object' ? row.payload : null;
      if (!slug || !payload || doc.players[slug]) continue;
      doc.players[slug] = payload;
      added += 1;
    }
    if (added) {
      fs.mkdirSync(path.dirname(RESOLUTION_LEDGER_PATH), { recursive: true });
      fs.writeFileSync(RESOLUTION_LEDGER_PATH, JSON.stringify(doc, null, 2));
    }
    return { mode: 'postgres', added };
  } finally {
    await client.end().catch(() => {});
  }
}

async function hydrateAllLedgers() {
  const [sent, resolution] = await Promise.all([hydrateSentLedger(), hydratePlayerResolutionLedger()]);
  return { sent, resolution };
}

function scheduleSentPersist(row) {
  queuePersist(() => persistSentEntry(row));
}

function schedulePlayerResolutionPersist(slug, row) {
  queuePersist(() => persistPlayerResolution(slug, row));
}

module.exports = {
  isEnabled,
  ensureTables,
  hydrateAllLedgers,
  scheduleSentPersist,
  schedulePlayerResolutionPersist
};
