/**
 * FutureCast read/write shim — JSON cache + player row fallback for autoposter context enrichment.
 */
const fs = require('fs');
const path = require('path');

const BUNDLE_DATA_DIR = path.join(__dirname, '..', 'data', 'futurecast');
const RENDER_DATA_DIR = '/var/data/futurecast';

function resolveFuturecastDataDir() {
  const fromEnv = String(process.env.GV_FUTURECAST_DATA_DIR || '').trim();
  if (fromEnv) return fromEnv;
  try {
    if (process.env.NODE_ENV === 'production' && fs.existsSync('/var/data')) {
      return RENDER_DATA_DIR;
    }
  } catch {
    /* ignore */
  }
  return BUNDLE_DATA_DIR;
}

const DATA_DIR = resolveFuturecastDataDir();
try {
  if (DATA_DIR !== BUNDLE_DATA_DIR) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    for (const name of fs.existsSync(BUNDLE_DATA_DIR) ? fs.readdirSync(BUNDLE_DATA_DIR) : []) {
      if (!name.endsWith('.json')) continue;
      const dest = path.join(DATA_DIR, name);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(path.join(BUNDLE_DATA_DIR, name), dest);
      }
    }
  }
} catch (err) {
  console.warn('[futurecast-store] migrate skipped:', err.message);
}

const HISTORY_PATH = path.join(DATA_DIR, 'prediction-history.json');

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function cachePathForYear(classYear) {
  return path.join(DATA_DIR, `futurecast-${classYear || 2027}.json`);
}

function getByPlayerId(playerIdOrSlug) {
  const key = String(playerIdOrSlug || '').toLowerCase();
  if (!key) return null;

  const recruitingStore = require('./recruiting-store');
  const player = recruitingStore.findBySlug(key) || null;

  let ufProbability = player?.ufProbability ?? player?.ufRpmPct ?? null;
  let movementDelta = player?.movementDelta ?? player?.delta ?? null;
  let competition = [];
  let timeline = null;

  const classYear = player?.classYear || 2027;
  const cachePath = path.join(DATA_DIR, `futurecast-${classYear}.json`);
  const rows = readJson(cachePath, []);
  const row = (rows || []).find((r) => String(r.slug || '').toLowerCase() === key);
  if (row?.predictions?.length) {
    const schools = row.predictions.map((p) => p.school).filter(Boolean);
    competition = schools.slice(0, 4);
    const uf = row.predictions.find((p) => /florida|gators|\buf\b/i.test(String(p.school || '')));
    if (uf?.confidence != null) ufProbability = uf.confidence;
    if (row.movementDelta != null) movementDelta = row.movementDelta;
    timeline = row.timeline || row.decisionWindow || null;
  }

  return {
    ufProbability,
    movementDelta,
    priorConfidence: row?.priorConfidence ?? null,
    competition,
    timeline,
    fitScore: player?.fitScore ?? row?.fitScore ?? null,
    predictionHistory: row?.predictionHistory || []
  };
}

function upsertPrediction({
  slug,
  classYear = 2027,
  confidence,
  priorConfidence = null,
  movementDelta = null,
  analystName = null,
  source = 'rivals_pm',
  timestamp = null
} = {}) {
  const key = String(slug || '').toLowerCase();
  if (!key || confidence == null) return null;

  const cachePath = cachePathForYear(classYear);
  const rows = readJson(cachePath, []);
  let row = rows.find((r) => String(r.slug || '').toLowerCase() === key);
  if (!row) {
    row = { slug: key, class_year: classYear, predictions: [] };
    rows.push(row);
  }

  row.predictions = row.predictions || [];
  const ufIdx = row.predictions.findIndex((p) => /florida|gators|\buf\b/i.test(String(p.school || '')));
  const ufPick = { school: 'Florida Gators', confidence, analystName, source, updatedAt: timestamp || new Date().toISOString() };
  if (ufIdx >= 0) row.predictions[ufIdx] = { ...row.predictions[ufIdx], ...ufPick };
  else row.predictions.unshift(ufPick);

  if (priorConfidence != null) row.priorConfidence = priorConfidence;
  if (movementDelta != null) row.movementDelta = movementDelta;
  row.updatedAt = timestamp || new Date().toISOString();
  writeJson(cachePath, rows);
  return row;
}

function appendPredictionHistory({
  slug,
  classYear = 2027,
  confidence,
  priorConfidence = null,
  movementDelta = null,
  source = 'rivals_pm',
  eventType = 'prediction_change',
  timestamp = null
} = {}) {
  const key = String(slug || '').toLowerCase();
  if (!key) return null;

  const doc = readJson(HISTORY_PATH, { version: 1, items: [] });
  doc.items = doc.items || [];
  const entry = {
    slug: key,
    classYear,
    confidence,
    priorConfidence,
    movementDelta,
    source,
    eventType,
    timestamp: timestamp || new Date().toISOString()
  };
  doc.items.unshift(entry);
  doc.items = doc.items.slice(0, 500);
  doc.updatedAt = new Date().toISOString();
  writeJson(HISTORY_PATH, doc);

  const cachePath = cachePathForYear(classYear);
  const rows = readJson(cachePath, []);
  const row = rows.find((r) => String(r.slug || '').toLowerCase() === key);
  if (row) {
    row.predictionHistory = row.predictionHistory || [];
    row.predictionHistory.unshift(entry);
    row.predictionHistory = row.predictionHistory.slice(0, 20);
    writeJson(cachePath, rows);
  }
  return entry;
}

module.exports = {
  getByPlayerId,
  upsertPrediction,
  appendPredictionHistory,
  HISTORY_PATH
};
