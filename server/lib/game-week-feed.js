/**
 * Game Week feed — upcoming matchup meta for Film Room Game Week tab.
 * Weekly refresh: server/scripts/weekly/weekly-game-week-refresh.js
 */
const fs = require('fs');
const path = require('path');

const META_PATH = path.join(__dirname, '..', 'data', 'game-week', 'meta.json');

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function buildGameWeekPayload() {
  const meta = readJson(META_PATH, { season: 2026, currentGameId: 'fau' });
  return {
    ok: true,
    season: meta.season || 2026,
    currentGameId: meta.currentGameId || 'fau',
    updatedAt: meta.updatedAt || new Date().toISOString(),
    note: 'Full matchup sections render client-side from schedule-data; API provides current week pointer.',
  };
}

module.exports = {
  buildGameWeekPayload,
  META_PATH
};
