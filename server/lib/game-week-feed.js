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
  let games = [];
  let scheduleUpdatedAt = null;
  try {
    const scheduleBoard = require('./schedule-board');
    const board = scheduleBoard.getScheduleBoard(meta.season || 2026);
    games = board.games || [];
    scheduleUpdatedAt = board.updatedAt || null;
  } catch {
    /* schedule board optional for meta pointer */
  }
  return {
    ok: true,
    season: meta.season || 2026,
    currentGameId: meta.currentGameId || 'fau',
    updatedAt: meta.updatedAt || new Date().toISOString(),
    scheduleUpdatedAt,
    games,
    count: games.length,
    note: 'Schedule games are live from /api/schedule — edit server/data/schedule without Codemagic after client bake.',
  };
}

module.exports = {
  buildGameWeekPayload,
  META_PATH
};
