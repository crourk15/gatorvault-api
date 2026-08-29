/**
 * Live Florida depth chart board — API-backed so camp updates do not need Codemagic.
 * Bundled seed: server/data/roster/depth-chart.json
 * Durable override on Render: /var/data/roster/depth-chart.json
 */
const fs = require('fs');
const path = require('path');

const BUNDLE_PATH = path.join(__dirname, '..', 'data', 'roster', 'depth-chart.json');
const RENDER_PATH = '/var/data/roster/depth-chart.json';

const STATUSES = new Set(['locked', 'battle', 'watch']);

function resolveReadPath() {
  const fromEnv = String(process.env.GV_DEPTH_CHART_PATH || '').trim();
  if (fromEnv) return fromEnv;
  try {
    if (process.env.NODE_ENV === 'production' && fs.existsSync(RENDER_PATH)) {
      return RENDER_PATH;
    }
  } catch {
    /* ignore */
  }
  return BUNDLE_PATH;
}

function resolveWritePath() {
  const fromEnv = String(process.env.GV_DEPTH_CHART_PATH || '').trim();
  if (fromEnv) return fromEnv;
  try {
    if (process.env.NODE_ENV === 'production' && fs.existsSync('/var/data')) {
      return RENDER_PATH;
    }
  } catch {
    /* ignore */
  }
  return BUNDLE_PATH;
}

function readJson(filePath) {
  let text = fs.readFileSync(filePath, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return JSON.parse(text);
}

function normalizeRow(row) {
  if (!row || typeof row !== 'object') return null;
  const pos = String(row.pos || '').trim();
  const s = String(row.s || '').trim();
  if (!pos || !s) return null;
  const status = String(row.status || 'locked').toLowerCase();
  return {
    pos,
    s,
    si: String(row.si || '').trim(),
    b: String(row.b || '').trim(),
    bi: String(row.bi || '').trim(),
    third: String(row.third || '').trim(),
    status: STATUSES.has(status) ? status : 'locked',
    analysis: String(row.analysis || '').trim(),
  };
}

function normalizePhase(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeRow).filter(Boolean);
}

function normalizeDoc(raw) {
  const offense = normalizePhase(raw?.offense);
  const defense = normalizePhase(raw?.defense);
  const specialTeams = normalizePhase(raw?.specialTeams);
  if (!offense.length || !defense.length) {
    throw new Error('depth chart requires offense and defense rows');
  }
  const updatedAt =
    String(raw?.updatedAt || '').trim() || new Date().toISOString();
  const label =
    String(raw?.label || '').trim() || 'Fall camp projection · battles open';
  const subtitle =
    String(raw?.subtitle || '').trim() ||
    'Camp board from Sumrall / beat leans — not an official locked depth chart.';
  return {
    version: Number(raw?.version) > 0 ? Number(raw.version) : 1,
    mode: String(raw?.mode || 'fall-camp').trim() || 'fall-camp',
    label,
    subtitle,
    updatedAt,
    source: String(raw?.source || 'vault-camp-board').trim() || 'vault-camp-board',
    offense,
    defense,
    specialTeams,
  };
}

function parseTs(iso) {
  const ms = Date.parse(String(iso || ''));
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Prefer a newer git bundle over a stale Render durable file (same pattern as schedule-board).
 * Writes the newer bundle back to durable when possible so the next read stays healed.
 */
function preferNewerBundle(doc, filePath) {
  if (filePath === BUNDLE_PATH || !fs.existsSync(BUNDLE_PATH)) return doc;
  let bundle;
  try {
    bundle = normalizeDoc(readJson(BUNDLE_PATH));
  } catch {
    return doc;
  }
  if (parseTs(bundle.updatedAt) <= parseTs(doc.updatedAt)) return doc;
  try {
    const writePath = resolveWritePath();
    if (writePath !== BUNDLE_PATH) {
      fs.mkdirSync(path.dirname(writePath), { recursive: true });
      fs.writeFileSync(writePath, JSON.stringify(bundle, null, 2));
    }
  } catch {
    /* serve newer bundle even if durable write fails */
  }
  return bundle;
}

function getDepthChartBoard() {
  const filePath = resolveReadPath();
  try {
    return preferNewerBundle(normalizeDoc(readJson(filePath)), filePath);
  } catch (err) {
    if (filePath !== BUNDLE_PATH && fs.existsSync(BUNDLE_PATH)) {
      return normalizeDoc(readJson(BUNDLE_PATH));
    }
    throw err;
  }
}

function saveDepthChartBoard(raw) {
  const doc = normalizeDoc({
    ...raw,
    updatedAt: String(raw?.updatedAt || '').trim() || new Date().toISOString(),
  });
  const filePath = resolveWritePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(doc, null, 2));
  return { ...doc, path: filePath };
}

function toApiPayload(doc = getDepthChartBoard()) {
  return {
    ok: true,
    version: doc.version,
    mode: doc.mode,
    label: doc.label,
    subtitle: doc.subtitle,
    updatedAt: doc.updatedAt,
    source: doc.source,
    offense: doc.offense,
    defense: doc.defense,
    specialTeams: doc.specialTeams,
    byPhase: {
      off: doc.offense,
      def: doc.defense,
      st: doc.specialTeams,
    },
  };
}

module.exports = {
  BUNDLE_PATH,
  RENDER_PATH,
  resolveReadPath,
  resolveWritePath,
  getDepthChartBoard,
  saveDepthChartBoard,
  toApiPayload,
  normalizeDoc,
};
