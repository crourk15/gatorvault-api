/**
 * Postgres persistence for email alert preferences.
 */
const fs = require("fs");
const path = require("path");

const MIGRATION_PATH = path.join(__dirname, "..", "migrations", "021_create_alert_email_preferences.sql");
const STORE_PATH = path.join(__dirname, "../data/ops/alert-email-preferences.json");

function databaseUrl() {
  const url = process.env.DATABASE_URL && String(process.env.DATABASE_URL).trim();
  return url || null;
}

function isEnabled() {
  return !!databaseUrl();
}

function pgClient() {
  const { Client } = require("pg");
  return new Client({ connectionString: databaseUrl(), ssl: { rejectUnauthorized: false } });
}

async function ensureTables() {
  if (!isEnabled()) return false;
  const sql = fs.readFileSync(MIGRATION_PATH, "utf8");
  const client = pgClient();
  await client.connect();
  try {
    await client.query(sql);
    return true;
  } finally {
    await client.end().catch(() => {});
  }
}

function readJsonStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
  } catch {
    return { version: 1, preferences: [] };
  }
}

function writeJsonStore(doc) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(STORE_PATH, JSON.stringify(doc, null, 2));
}

async function loadAllPrefs() {
  if (isEnabled()) {
    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT email, prefs, updated_at FROM alert_email_preferences ORDER BY updated_at DESC`
      );
      return rows.map((row) => ({
        email: row.email,
        prefs: row.prefs || {},
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      }));
    } finally {
      await client.end().catch(() => {});
    }
  }
  const doc = readJsonStore();
  return (doc.preferences || []).map((row) => ({
    email: row.email,
    prefs: row.prefs || {},
    updatedAt: row.updatedAt || null,
  }));
}

async function upsertPref(email, prefs) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return { ok: false, error: "invalid_email" };

  const doc = readJsonStore();
  doc.preferences = doc.preferences || [];
  const row = {
    email: normalized,
    prefs,
    updatedAt: new Date().toISOString(),
  };
  const idx = doc.preferences.findIndex((p) => p.email === normalized);
  if (idx >= 0) doc.preferences[idx] = { ...doc.preferences[idx], ...row };
  else doc.preferences.push(row);
  writeJsonStore(doc);

  if (isEnabled()) {
    const client = pgClient();
    await client.connect();
    try {
      await client.query(
        `INSERT INTO alert_email_preferences (email, prefs, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (email) DO UPDATE SET prefs = EXCLUDED.prefs, updated_at = NOW()`,
        [normalized, JSON.stringify(prefs)]
      );
    } finally {
      await client.end().catch(() => {});
    }
  }

  return { ok: true, email: normalized };
}

async function initAlertEmailPrefsStore() {
  if (!isEnabled()) {
    const doc = readJsonStore();
    return { mode: "json", count: (doc.preferences || []).length };
  }
  await ensureTables();
  const fromDb = await loadAllPrefs();
  if (fromDb.length) {
    writeJsonStore({ version: 1, preferences: fromDb });
    return { mode: "postgres", count: fromDb.length };
  }
  const local = readJsonStore();
  if ((local.preferences || []).length) {
    for (const row of local.preferences) {
      await upsertPref(row.email, row.prefs);
    }
    return { mode: "postgres-seeded-from-json", count: local.preferences.length };
  }
  return { mode: "postgres-empty", count: 0 };
}

module.exports = {
  isEnabled,
  ensureTables,
  loadAllPrefs,
  upsertPref,
  initAlertEmailPrefsStore,
  STORE_PATH,
};