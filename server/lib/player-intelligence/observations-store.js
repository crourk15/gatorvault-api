/**
 * Append-only intelligence observation history (local JSON).
 * Current state lives in recruiting store; this is audit + momentum deltas.
 */
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'recruiting', 'intelligence-observations.json');
const MAX_ROWS = Number(process.env.PLAYER_INTEL_OBS_MAX || 5000);

function loadDoc() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    return Array.isArray(raw) ? raw : raw.observations || [];
  } catch {
    return [];
  }
}

function saveDoc(rows) {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const trimmed = rows.slice(-MAX_ROWS);
  fs.writeFileSync(
    DATA_PATH,
    JSON.stringify({ updatedAt: new Date().toISOString(), observations: trimmed }, null, 2),
    'utf8'
  );
  return trimmed;
}

function appendSnapshot(slug, intel = {}) {
  const key = String(slug || '').toLowerCase();
  if (!key) return null;
  const row = {
    slug: key,
    observedAt: new Date().toISOString(),
    coverageTier: intel.coverageTier || null,
    rankingBlock: intel.rankingBlock || null,
    rpm: intel.rpm || null,
    gaps: intel.gaps || [],
    stale: intel.stale || []
  };
  const rows = loadDoc();
  rows.push(row);
  saveDoc(rows);
  return row;
}

function latestSnapshot(slug) {
  const key = String(slug || '').toLowerCase();
  const rows = loadDoc().filter((r) => r.slug === key);
  return rows.length ? rows[rows.length - 1] : null;
}

function listRecent(limit = 50) {
  return loadDoc().slice(-limit).reverse();
}

module.exports = {
  appendSnapshot,
  latestSnapshot,
  listRecent,
  DATA_PATH
};
