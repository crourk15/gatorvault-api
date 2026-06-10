/**
 * Depth chart refresh job — stamps metadata for GV-OM freshness tracking.
 */
const fs = require('fs');
const path = require('path');
const rosterStore = require('./roster-store');

const META_PATH = path.join(__dirname, '..', 'data', 'roster', 'depth-chart-meta.json');

function isEnabled() {
  const v = process.env.DEPTH_CHART_ENABLED;
  if (v == null || v === '') return true;
  return v === 'true' || v === '1';
}

function refreshDepthChart() {
  if (!isEnabled()) {
    return { ok: false, skipped: true, reason: 'DEPTH_CHART_ENABLED=false' };
  }

  const players = rosterStore.getAllRosterPlayers();
  const updatedAt = new Date().toISOString();
  const meta = {
    version: 1,
    updatedAt,
    playerCount: players.length,
    source: 'roster/players.json',
    units: {
      offense: players.filter((p) => p.unit === 'offense').length,
      defense: players.filter((p) => p.unit === 'defense').length,
      special: players.filter((p) => p.unit === 'special').length
    }
  };

  fs.mkdirSync(path.dirname(META_PATH), { recursive: true });
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2));

  return {
    ok: true,
    processedCount: players.length,
    updatedAt,
    meta
  };
}

function getDepthChartMeta() {
  try {
    return JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
  } catch {
    return null;
  }
}

module.exports = {
  META_PATH,
  isEnabled,
  refreshDepthChart,
  getDepthChartMeta
};
