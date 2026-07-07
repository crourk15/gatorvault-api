/**
 * Compose skip / enrich telemetry for operator visibility.
 */
const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, '../data/ops/compose-skip-log.json');
const MAX_ENTRIES = parseInt(process.env.COMPOSE_SKIP_LOG_MAX || '500', 10);

function readLog() {
  try {
    return JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
  } catch {
    return { entries: [], updatedAt: null };
  }
}

function writeLog(doc) {
  try {
    const dir = path.dirname(LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    doc.updatedAt = new Date().toISOString();
    fs.writeFileSync(LOG_PATH, JSON.stringify(doc, null, 2), 'utf8');
  } catch (err) {
    console.warn('[compose-skip-log] write failed:', err.message);
  }
}

function logComposeSkip(entry = {}) {
  const doc = readLog();
  const row = {
    at: new Date().toISOString(),
    slug: entry.slug || null,
    reason: entry.reason || 'unknown',
    lastReason: entry.lastReason || null,
    enrichPassesTried: entry.enrichPassesTried || [],
    gaps: entry.gaps || [],
    trigger: entry.trigger || 'compose',
    beatLen: entry.beatLen != null ? entry.beatLen : null
  };
  doc.entries = [row, ...(doc.entries || [])].slice(0, MAX_ENTRIES);
  writeLog(doc);
  return row;
}

function listComposeSkips({ slug = null, limit = 50 } = {}) {
  const doc = readLog();
  let rows = doc.entries || [];
  if (slug) {
    const key = String(slug).toLowerCase();
    rows = rows.filter((r) => String(r.slug || '').toLowerCase() === key);
  }
  return rows.slice(0, limit);
}

module.exports = { logComposeSkip, listComposeSkips, LOG_PATH };