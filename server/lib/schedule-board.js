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

/**
 * Expand a combo label into helmet/jersey/pants when parts were omitted.
 * Game Week chips need the three parts — label-only rows used to drop entirely.
 */
function expandUniformParts(label, helmet, jersey, pants) {
  let h = helmet;
  let j = jersey;
  let p = pants;
  if (h || j || p) return { helmet: h, jersey: j, pants: p };
  const text = String(label || '').trim();
  if (!text) return { helmet: h, jersey: j, pants: p };
  if (/^all[- ]?blue$/i.test(text)) {
    return { helmet: 'Blue', jersey: 'Blue', pants: 'Blue' };
  }
  const parts = text
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    return { helmet: parts[0], jersey: parts[1], pants: parts[2] };
  }
  return { helmet: h, jersey: j, pants: p };
}

function normalizeUniform(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  let helmet = String(raw.helmet || '').trim();
  let jersey = String(raw.jersey || '').trim();
  let pants = String(raw.pants || '').trim();
  let label =
    String(raw.label || '').trim() ||
    [helmet, jersey, pants].filter(Boolean).join(' / ');
  ({ helmet, jersey, pants } = expandUniformParts(label, helmet, jersey, pants));
  if (!helmet && !jersey && !pants) return undefined;
  label = label || [helmet, jersey, pants].filter(Boolean).join(' / ');
  const out = {
    helmet: helmet || undefined,
    jersey: jersey || undefined,
    pants: pants || undefined,
    label,
  };
  if (raw.note != null && String(raw.note).trim()) out.note = String(raw.note).trim();
  if (raw.source != null && String(raw.source).trim()) out.source = String(raw.source).trim();
  return out;
}

/** Bundled season uniforms — always available even when durable disk is stale. */
function loadBundleUniformMap(season) {
  const year = String(season || 2026);
  try {
    const doc = readJson(bundlePath(year));
    const map = new Map();
    for (const row of Array.isArray(doc?.games) ? doc.games : []) {
      const id = String(row?.id || '').trim();
      const uniform = normalizeUniform(row?.uniform);
      if (id && uniform) map.set(id, uniform);
    }
    return map;
  } catch {
    return new Map();
  }
}

/** Model / film intel fields that git-bundle edits should win when the bundle is newer. */
const BUNDLE_MODEL_KEYS = [
  'ufPct',
  'pred',
  'predUF',
  'predOpp',
  'film',
  'filmNotes',
  'keys',
  'swing',
  'opponentTendencies',
  'defenseTendencies',
  'offenseScout',
  'defenseScout',
  'howUFWins',
  'scoutingReport',
  'filmWatched',
  'finalUF',
  'finalOpp',
  'finalSource',
];

function parseTs(value) {
  const ms = Date.parse(String(value || '').trim());
  return Number.isFinite(ms) ? ms : 0;
}

function loadBundleDoc(season) {
  try {
    return normalizeDoc(readJson(bundlePath(season)), season);
  } catch {
    return null;
  }
}

/**
 * When durable disk lags a newer git bundle (admin PUT left an older slate),
 * overlay prediction + film intel from the bundle so schedule edits ship without
 * waiting for a manual durable wipe.
 */
function overlayBundleModelFields(doc, season) {
  const bundle = loadBundleDoc(season);
  if (!bundle) return { doc, healed: 0 };
  if (parseTs(bundle.updatedAt) <= parseTs(doc.updatedAt)) {
    return { doc, healed: 0 };
  }
  const byId = new Map((bundle.games || []).map((g) => [String(g.id || ''), g]));
  let healed = 0;
  const games = (doc.games || []).map((game) => {
    if (!game || game.kind === 'bye') return game;
    const fromBundle = byId.get(String(game.id || ''));
    if (!fromBundle) return game;
    let changed = false;
    const next = { ...game };
    for (const key of BUNDLE_MODEL_KEYS) {
      const incoming = fromBundle[key];
      if (incoming === undefined) continue;
      const same =
        typeof incoming === 'object'
          ? JSON.stringify(incoming) === JSON.stringify(game[key])
          : incoming === game[key];
      if (same) continue;
      next[key] = incoming;
      changed = true;
    }
    if (!changed) return game;
    healed += 1;
    return next;
  });
  if (!healed) {
    return {
      doc: { ...doc, updatedAt: bundle.updatedAt },
      healed: 0,
    };
  }
  return {
    doc: {
      ...doc,
      updatedAt: bundle.updatedAt,
      games,
    },
    healed,
  };
}

/**
 * Ensure every non-bye game carries helmet/jersey/pants for the baked Game Week chips.
 * Prefers live/durable row; backfills from repo bundle when durable PUT stripped them.
 */
function backfillUniforms(games, season) {
  const list = Array.isArray(games) ? games : [];
  const bundleMap = loadBundleUniformMap(season);
  let healed = 0;
  const out = list.map((game) => {
    if (!game || game.kind === 'bye') return game;
    const current = normalizeUniform(game.uniform);
    if (current?.helmet && current?.jersey && current?.pants) {
      // Re-attach if label-only was expanded into parts.
      if (
        game.uniform &&
        game.uniform.helmet === current.helmet &&
        game.uniform.jersey === current.jersey &&
        game.uniform.pants === current.pants
      ) {
        return game;
      }
      return { ...game, uniform: current };
    }
    const fromBundle = bundleMap.get(String(game.id || ''));
    const merged = normalizeUniform({
      ...(fromBundle || {}),
      ...(current || {}),
      helmet: current?.helmet || fromBundle?.helmet,
      jersey: current?.jersey || fromBundle?.jersey,
      pants: current?.pants || fromBundle?.pants,
      label: current?.label || fromBundle?.label,
      note: current?.note || fromBundle?.note,
      source: current?.source || fromBundle?.source,
    });
    if (!merged) return game;
    healed += 1;
    return { ...game, uniform: merged };
  });
  return { games: out, healed };
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
  const kind = String(row.kind || 'game').trim().toLowerCase() === 'bye' ? 'bye' : 'game';
  const uniform = normalizeUniform(row.uniform);
  return {
    id,
    kind,
    label: String(row.label || '').trim() || id,
    opp,
    date,
    venue: String(row.venue || '').trim(),
    ufPct: Number.isFinite(Number(row.ufPct)) ? Number(row.ufPct) : 50,
    tv: row.tv != null ? String(row.tv).trim() : undefined,
    keys,
    swing,
    film: String(row.film || '').trim(),
    filmNotes: Array.isArray(row.filmNotes)
      ? row.filmNotes.map((x) => String(x || '').trim()).filter(Boolean)
      : undefined,
    pred: String(row.pred || '').trim(),
    predUF: Number.isFinite(Number(row.predUF)) ? Number(row.predUF) : 0,
    predOpp: Number.isFinite(Number(row.predOpp)) ? Number(row.predOpp) : 0,
    ...(Number.isFinite(Number(row.finalUF)) && Number.isFinite(Number(row.finalOpp))
      ? {
          finalUF: Number(row.finalUF),
          finalOpp: Number(row.finalOpp),
          ...(row.finalSource ? { finalSource: String(row.finalSource).trim() } : {}),
        }
      : {}),
    filmLessonId: row.filmLessonId != null ? String(row.filmLessonId).trim() : undefined,
    ...(typeof row.filmWatched === 'boolean' ? { filmWatched: row.filmWatched } : {}),
    opponentTendencies: Array.isArray(row.opponentTendencies)
      ? row.opponentTendencies.map((x) => String(x || '').trim()).filter(Boolean)
      : undefined,
    defenseTendencies: Array.isArray(row.defenseTendencies)
      ? row.defenseTendencies.map((x) => String(x || '').trim()).filter(Boolean)
      : undefined,
    offenseScout: Array.isArray(row.offenseScout)
      ? row.offenseScout.map((x) => String(x || '').trim()).filter(Boolean)
      : undefined,
    defenseScout: Array.isArray(row.defenseScout)
      ? row.defenseScout.map((x) => String(x || '').trim()).filter(Boolean)
      : undefined,
    howUFWins: Array.isArray(row.howUFWins)
      ? row.howUFWins.map((x) => String(x || '').trim()).filter(Boolean)
      : undefined,
    scoutingReport: row.scoutingReport != null ? String(row.scoutingReport).trim() : undefined,
    tickets: normalizeTickets(row.tickets),
    ...(uniform ? { uniform } : {}),
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
  let doc;
  try {
    doc = normalizeDoc(readJson(filePath), year);
  } catch (err) {
    const fallback = bundlePath(year);
    if (filePath !== fallback && fs.existsSync(fallback)) {
      doc = normalizeDoc(readJson(fallback), year);
    } else {
      throw err;
    }
  }
  const filled = backfillUniforms(doc.games, year);
  doc = { ...doc, games: filled.games };
  const modelOverlay =
    filePath !== bundlePath(year) ? overlayBundleModelFields(doc, year) : { doc, healed: 0 };
  doc = modelOverlay.doc;
  // Durable disk can lag the bundle (admin PUT without uniform / stale model).
  // Rewrite so Game Week chips + predictions stay stable without a manual wipe.
  if ((filled.healed > 0 || modelOverlay.healed > 0) && filePath !== bundlePath(year)) {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(
        filePath,
        JSON.stringify(
          {
            season: doc.season,
            updatedAt: doc.updatedAt,
            label: doc.label,
            source: doc.source,
            games: doc.games.map((g) => {
              const { expectedVisitors: _ev, ...rest } = g || {};
              return rest;
            }),
          },
          null,
          2
        ) + '\n'
      );
    } catch {
      /* read path still served healed games */
    }
  }
  try {
    const { attachExpectedVisitorsToGames } = require('./game-week-visitors');
    doc = {
      ...doc,
      games: attachExpectedVisitorsToGames(doc.games),
    };
  } catch {
    /* optional */
  }
  return doc;
}

function saveScheduleBoard(raw, season = 2026) {
  const year = String(season || raw?.season || 2026);
  const incoming = Array.isArray(raw?.games) ? raw.games : [];
  const filled = backfillUniforms(incoming, year);
  const doc = normalizeDoc(
    {
      ...raw,
      games: filled.games,
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
  normalizeUniform,
  backfillUniforms,
  overlayBundleModelFields,
  loadBundleUniformMap,
};
