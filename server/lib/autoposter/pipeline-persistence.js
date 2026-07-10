/**
 * Postgres persistence for detectives pile + autoposter queue documents.
 */
const fs = require('fs');
const path = require('path');

const MIGRATION_PATH = path.join(__dirname, '..', '..', 'migrations', '023_create_pipeline_persistence.sql');
const DETECTIVES_PATH = path.join(__dirname, '..', '..', 'data', 'autoposter', 'detectives-pile.json');
const QUEUE_PATH = path.join(__dirname, '..', '..', 'data', 'x', 'autoposter-queue.json');

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
    console.warn('[pipeline-persistence] postgres persist failed:', err.message);
  });
}

async function persistDetectivesDoc(doc) {
  if (!isEnabled() || !doc) return false;
  await ensureTables();
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO autoposter_detectives_doc (id, payload, updated_at)
       VALUES ('default', $1::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE
         SET payload = EXCLUDED.payload, updated_at = NOW()`,
      [JSON.stringify(doc)]
    );
    return true;
  } finally {
    await client.end().catch(() => {});
  }
}

async function persistQueueDoc(doc) {
  if (!isEnabled() || !doc) return false;
  await ensureTables();
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO autoposter_queue_doc (id, payload, updated_at)
       VALUES ('default', $1::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE
         SET payload = EXCLUDED.payload, updated_at = NOW()`,
      [JSON.stringify(doc)]
    );
    return true;
  } finally {
    await client.end().catch(() => {});
  }
}

function readJsonDoc(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonDoc(filePath, doc) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(doc, null, 2));
}

async function loadDetectivesDocFromPostgres() {
  if (!isEnabled()) return null;
  await ensureTables();
  const client = pgClient();
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT payload, updated_at FROM autoposter_detectives_doc WHERE id = 'default' LIMIT 1`
    );
    if (!rows.length) return null;
    const payload = rows[0].payload;
    if (!payload || typeof payload !== 'object') return null;
    return { doc: payload, updatedAt: rows[0].updated_at };
  } finally {
    await client.end().catch(() => {});
  }
}

async function loadQueueDocFromPostgres() {
  if (!isEnabled()) return null;
  await ensureTables();
  const client = pgClient();
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT payload, updated_at FROM autoposter_queue_doc WHERE id = 'default' LIMIT 1`
    );
    if (!rows.length) return null;
    const payload = rows[0].payload;
    if (!payload || typeof payload !== 'object') return null;
    return { doc: payload, updatedAt: rows[0].updated_at };
  } finally {
    await client.end().catch(() => {});
  }
}

function fileUpdatedMs(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

async function hydrateDetectivesPile() {
  if (!isEnabled()) return { mode: 'json-only', restored: false };
  const remote = await loadDetectivesDocFromPostgres();
  if (!remote?.doc) return { mode: 'postgres-empty', restored: false };

  const local = readJsonDoc(DETECTIVES_PATH, null);
  const localMs = fileUpdatedMs(DETECTIVES_PATH);
  const remoteMs = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;

  if (!local || remoteMs >= localMs) {
    writeJsonDoc(DETECTIVES_PATH, remote.doc);
    return { mode: 'postgres', restored: true, cases: Array.isArray(remote.doc.cases) ? remote.doc.cases.length : 0 };
  }
  return { mode: 'local-newer', restored: false };
}

async function hydrateAutoposterQueue() {
  if (!isEnabled()) return { mode: 'json-only', restored: false };
  const remote = await loadQueueDocFromPostgres();
  if (!remote?.doc) return { mode: 'postgres-empty', restored: false };

  const local = readJsonDoc(QUEUE_PATH, null);
  const localMs = fileUpdatedMs(QUEUE_PATH);
  const remoteMs = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;

  if (!local || remoteMs >= localMs) {
    writeJsonDoc(QUEUE_PATH, remote.doc);
    return { mode: 'postgres', restored: true, items: Array.isArray(remote.doc.items) ? remote.doc.items.length : 0 };
  }
  return { mode: 'local-newer', restored: false };
}

async function hydratePipelineDocs() {
  const [detectives, queue] = await Promise.all([hydrateDetectivesPile(), hydrateAutoposterQueue()]);
  return { detectives, queue };
}

function scheduleDetectivesPersist(doc) {
  queuePersist(() => persistDetectivesDoc(doc));
}

function scheduleQueuePersist(doc) {
  queuePersist(() => persistQueueDoc(doc));
}

module.exports = {
  isEnabled,
  hydratePipelineDocs,
  scheduleDetectivesPersist,
  scheduleQueuePersist,
};
