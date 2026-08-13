/**
 * Live Florida football schedule board — API-backed so slate fixes do not need Codemagic.
 * Bundled seed: server/data/schedule/2026-season.json
 * Durable override on Render: /var/data/schedule/2026-season.json
 */
'use strict';

const fs = require('fs');
const path = require('path');

const BUNDLE_DIR = path.join(__dirname, '..', 'data', 'schedule');
const RENDER_DIR = '/var/data/schedule';

function bundlePath(season) {
  return path.join(BUNDLE_DIR, `${season}-season.json`);
}

function renderPath(season) {
  return path.join(RENDER_DIR, `${season}-season.json`);
}

function resolveReadPath(season) {
  const fromEnv = String(process.env.GV_SCHEDULE_PATH || '').trim();
  if (fromEnv) return fromEnv;
  const rp = renderPath(season);
  try {
    if (process.env.NODE_ENV === 'production' && fs.existsSync(rp)) {
      return rp;
    }
  } catch {
    /* ignore */
  }
  return bundlePath(season);
}

function resolveWritePath(season) {
  const fromEnv = String(process.env.GV_SCHEDULE_PATH || '').trim();
  if (fromEnv) return fromEnv;
  try {
    if (process.env.NODE_ENV === 'production' && fs.existsSync('/var/data')) {
      return renderPath(season);
    }
  } catch {
    /* ignore */
  }
  return bundlePath(season);
}

function readJson(filePath) {
  let text = fs.readFileSync(filePath, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return JSON.parse(text);
}

function normalizeGame(row) {
  if (!row || typeof row !== 'object') return null;
  const id = String(row.id || '').trim();
  const opp = String(row.opp || '').trim();
  const date = String(row.date || '').trim();
  if (!id || !opp || !date) return null;
  const keys = Array.isArray(row.keys) ? row.keys.map((k) => String(k || '').trim()).filter(Boolean) : [];
  const swing = Array.isArray(row.swing)
    ? row.swing
        .map((s) => ({
          name: String(s?.name || '').trim(),
          role: String(s?.role || '').trim(),
        }))
        .filter((s) => s.name)
    : [];
  return {
    id,
    label: String(row.label || '').trim() || id,
    opp,
    date,
    venue: String(row.venue || '').trim(),
    ufPct: Number.isFinite(Number(row.ufPct)) ? Number(row.ufPct) : 50,
    tv: row.tv != null ? String(row.tv).trim() : undefined,
    keys,
    swing,
    film: String(row.film || '').trim(),
    pred: String(row.pred || '').trim(),
    predUF: Number.isFinite(Number(row.predUF)) ? Number(row.predUF) : 0,
    predOpp: Number.isFinite(Number(row.predOpp)) ? Number(row.predOpp) : 0,
    filmLessonId: row.filmLessonId != null ? String(row.filmLessonId).trim() : undefined,
    opponentTendencies: Array.isArray(row.opponentTendencies)
      ? row.opponentTendencies.map((x) => String(x || '').trim()).filter(Boolean)
      : undefined,
    howUFWins: Array.isArray(row.howUFWins)
      ? row.howUFWins.map((x) => String(x || '').trim()).filter(Boolean)
      : undefined,
    scoutingReport: row.scoutingReport != null ? String(row.scoutingReport).trim() : undefined,
    tickets: normalizeTickets(row.tickets),
  };
}

function normalizeTickets(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const out = {};
  for (const key of ['gameCenter', 'official', 'tickpick', 'stubhub', 'seatgeek', 'ticketmaster']) {
    const v = String(raw[key] || '').trim();
    if (v) out[key] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeDoc(raw, season) {
  const games = (Array.isArray(raw?.games) ? raw.games : []).map(normalizeGame).filter(Boolean);
  if (!games.length) {
    throw new Error(`schedule ${season} requires at least one game`);
  }
  return {
    season: Number(raw?.season) || Number(season) || 2026,
    updatedAt: String(raw?.updatedAt || '').trim() || new Date().toISOString(),
    label: String(raw?.label || '').trim() || `${season} Florida football schedule`,
    source: String(raw?.source || 'vault-schedule-board').trim() || 'vault-schedule-board',
    games,
  };
}

function getScheduleBoard(season = 2026) {
  const year = String(season || 2026);
  const filePath = resolveReadPath(year);
  try {
    return normalizeDoc(readJson(filePath), year);
  } catch (err) {
    const fallback = bundlePath(year);
    if (filePath !== fallback && fs.existsSync(fallback)) {
      return normalizeDoc(readJson(fallback), year);
    }
    throw err;
  }
}

function saveScheduleBoard(raw, season = 2026) {
  const year = String(season || raw?.season || 2026);
  const doc = normalizeDoc(
    {
      ...raw,
      season: Number(year),
      updatedAt: String(raw?.updatedAt || '').trim() || new Date().toISOString(),
    },
    year
  );
  const filePath = resolveWritePath(year);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(doc, null, 2) + '\n');
  return { ...doc, path: filePath };
}

function toApiPayload(doc) {
  const board = doc || getScheduleBoard(2026);
  return {
    ok: true,
    season: board.season,
    updatedAt: board.updatedAt,
    label: board.label,
    source: board.source,
    games: board.games,
    count: board.games.length,
  };
}

module.exports = {
  BUNDLE_DIR,
  RENDER_DIR,
  resolveReadPath,
  resolveWritePath,
  getScheduleBoard,
  saveScheduleBoard,
  toApiPayload,
  normalizeDoc,
};
