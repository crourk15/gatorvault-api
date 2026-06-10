/**
 * Rivals Prediction Machine ingest — detect UF FutureCast picks, update board, Heat Check, autoposter, alerts.
 */
const fs = require('fs');
const path = require('path');
const client = require('./rivals-prediction-client');
const beatParser = require('./rivals-prediction-parser');
const { getBeatPosts } = require('./live-beat');
const store = require('./recruiting-store');
const intelStore = require('./recruiting-intel-store');
const liveStore = require('./live-store');
const { clearHeatCheckCache } = require('./heat-check-store');
const { buildOn3ProfileUrl } = require('./on3-urls');
const { intelFingerprint } = require('./commit-fingerprint');
const eligibility = require('./rivals-prediction-eligibility');

const DATA_DIR = path.join(__dirname, '..', 'data', 'recruiting');
const SNAPSHOT_PATH = path.join(DATA_DIR, 'rivals-pm-snapshot.json');
const LOG_PATH = path.join(DATA_DIR, 'rivals-pm-ingest-log.json');
const WAR_ROOM_PREDICTIONS_PATH = path.join(__dirname, '..', 'data', 'war-room', 'rivals-predictions.json');
const INTERNAL_ALERTS_PATH = path.join(DATA_DIR, 'internal-alerts.json');
const SITE_URL = process.env.SITE_URL || 'https://gatorvaultinsider.com';

const CLASS_YEARS = (process.env.RIVALS_PM_CLASS_YEARS || '2027,2028,2029')
  .split(',')
  .map((y) => parseInt(y.trim(), 10))
  .filter((y) => !Number.isNaN(y));

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadSnapshot() {
  return readJson(SNAPSHOT_PATH, { version: 2, fingerprints: {}, pickKeys: {}, lastRun: null });
}

function saveSnapshot(doc) {
  doc.lastRun = new Date().toISOString();
  writeJson(SNAPSHOT_PATH, doc);
}

function appendLog(entry) {
  const doc = readJson(LOG_PATH, { runs: [] });
  doc.runs = doc.runs || [];
  doc.runs.unshift({ ...entry, at: new Date().toISOString() });
  doc.runs = doc.runs.slice(0, 100);
  writeJson(LOG_PATH, doc);
}

function appendWarRoomPrediction(row) {
  const doc = readJson(WAR_ROOM_PREDICTIONS_PATH, { version: 1, predictions: [] });
  doc.predictions = doc.predictions || [];
  doc.predictions.unshift({
    playerSlug: row.playerSlug,
    playerName: row.playerName,
    classYear: row.classYear,
    pos: row.pos,
    analystName: row.analystName,
    confidence: row.confidence,
    predictionSchool: row.predictionSchool,
    articleUrl: row.articleUrl,
    source: row.source,
    loggedAt: row.timestamp
  });
  doc.predictions = doc.predictions.slice(0, 200);
  doc.updatedAt = new Date().toISOString();
  writeJson(WAR_ROOM_PREDICTIONS_PATH, doc);
}

function appendInternalAlert(row) {
  const doc = readJson(INTERNAL_ALERTS_PATH, { version: 1, alerts: [] });
  const alert = {
    id: `rivals_${row.fingerprint}`,
    type: 'rivals_prediction',
    title: `Rivals PM: ${row.analystName} → ${row.playerName} (Florida)`,
    detail: row.detail,
    playerSlug: row.playerSlug,
    playerName: row.playerName,
    analystName: row.analystName,
    confidence: row.confidence,
    classYear: row.classYear,
    articleUrl: row.articleUrl,
    createdAt: new Date().toISOString(),
    read: false
  };
  doc.alerts = doc.alerts || [];
  if (!doc.alerts.some((a) => a.id === alert.id)) {
    doc.alerts.unshift(alert);
    doc.alerts = doc.alerts.slice(0, 300);
  }
  doc.updatedAt = new Date().toISOString();
  writeJson(INTERNAL_ALERTS_PATH, doc);
  return alert;
}

async function buildAutoposterText(row) {
  const copy = require('./x-autoposter-copy');
  const playerContext = require('./x-autoposter-player-context');
  const prediction = require('./x-autoposter-prediction');

  if (row.eventType === 'visit_cancelled' || row.eventType === 'ov_change') {
    const built = await copy.buildIntelCopyAsync({
      eventType: row.eventType,
      playerName: row.playerName,
      playerSlug: row.playerSlug,
      nextVisitSchool: row.nextVisitSchool,
      source: row.source,
      analystName: row.source
    });
    return built?.text || null;
  }

  const built = await prediction.buildPredictionPost({
    row,
    playerSlug: row.playerSlug,
    playerName: row.playerName,
    patch: playerContext.verifiedPatchFromRow(row),
    intel: {
      id: row.intelId || null,
      eventType: 'prediction',
      playerName: row.playerName,
      playerSlug: row.playerSlug,
      analystName: row.analystName,
      confidencePct: row.confidence,
      ufRpmPct: row.ufRpmPct,
      pos: row.pos,
      classYear: row.classYear,
      stars: row.stars,
      natlRank: row.natlRank,
      highSchool: row.highSchool,
      hometownState: row.hometownState,
      school: row.school,
      articleUrl: row.articleUrl,
      source: row.source,
      detail: row.detail
    },
    intelId: row.intelId || null,
    sourceLabel: `Rivals analyst ${row.analystName}`
  });
  return built?.ok ? { ...built, text: copy.appendSite(built.text) } : null;
}

async function queueAutoposter(row, intelId) {
  try {
    const xStore = require('./x-autoposter-store');
    const policy = require('./x-autoposter-policy');
    const textResult = await buildAutoposterText({ ...row, intelId });
    const built = textResult && typeof textResult === 'object' ? textResult : null;
    const text = built?.text || (typeof textResult === 'string' ? textResult : null);
    const fp = row.fingerprint || intelFingerprint(row.on3Id, 'rivals_prediction', row.timestamp);
    const copy = require('./x-autoposter-copy');
    if (!text || copy.isBrokenCopy(text, built || {}) || !copy.isValidPlayerName(row.playerName)) {
      return { queued: false, reason: 'invalid_copy' };
    }
    const doc = xStore.loadQueue();
    const dup = doc.items.some(
      (i) =>
        (i.intelFingerprint === fp ||
          (row.pickKey && i.intelFingerprint === `rivals_pick_${row.pickKey}`)) &&
        (i.status === 'pending' || i.status === 'sent')
    );
    if (dup) return { queued: false, reason: 'duplicate' };

    const payload = {
      text,
      category: 'news',
      topic: 'recruiting',
      sources: [{ label: row.analystName, url: row.articleUrl || SITE_URL }],
      source: 'auto:rivals-pm',
      intelFingerprint: fp,
      intelType: 'rivals_prediction',
      playerName: row.playerName,
      sourceIntelId: intelId,
      scheduledAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      status: 'pending',
      templateBlocks: built?.templateBlocks,
      validationMeta: built?.validationMeta,
      playerContext: built?.context,
      sourceEventCreatedAt: row.timestamp
    };
    const check = policy.validatePostContent(payload);
    if (!check.valid) return { queued: false, reason: 'policy', errors: check.errors };
    const out = xStore.enqueuePost(payload);
    return { queued: true, item: out.item };
  } catch (e) {
    return { queued: false, reason: e.message };
  }
}

async function processPrediction(row, snapshot) {
  if (!row?.fingerprint || !row.playerName) return { skipped: true, reason: 'invalid' };

  const gate = await eligibility.evaluatePredictionGate(row, snapshot);
  if (!gate.allowed) {
    if (gate.markSeen) eligibility.markSeen(snapshot, row, gate.reason);
    return { skipped: true, reason: gate.reason, fingerprint: row.fingerprint };
  }

  const detailParts = [
    `${row.analystName} logged a Florida FutureCast`,
    row.confidence != null ? `${row.confidence}% confidence` : null,
    row.ufRpmPct != null ? `UF RPM ${row.ufRpmPct}%` : null
  ].filter(Boolean);
  row.detail = detailParts.join(' · ');

  const existing = gate.player || (await store.getPlayerBySlug(row.playerSlug));
  if (eligibility.isCommittedAnywhere(existing, row) || !eligibility.isActiveUfTarget(existing, row)) {
    eligibility.markSeen(snapshot, row, 'ineligible_at_process');
    return { skipped: true, reason: 'ineligible_at_process', fingerprint: row.fingerprint };
  }

  const mergedPlayer = {
    ...(existing || {}),
    slug: row.playerSlug,
    name: row.playerName,
    pos: row.pos || existing?.pos,
    classYear: row.classYear || existing?.classYear,
    school: row.school || existing?.school,
    stars: row.stars || existing?.stars,
    natlRank: row.natlRank || existing?.natlRank,
    committedTo: existing?.committedTo || null
  };
  const copy = require('./recruiting-alert-templates').buildRecruitingCopy({
    player: mergedPlayer,
    existing,
    eventType: 'prediction',
    row
  });
  const playerPatch = {
    slug: row.playerSlug,
    name: row.playerName,
    pos: row.pos || existing?.pos,
    classYear: row.classYear || existing?.classYear,
    school: row.school || existing?.school,
    on3Id: String(row.on3Id || existing?.on3Id || '').replace(/^beat_/, '') || existing?.on3Id,
    on3Slug: row.on3Slug || existing?.on3Slug,
    on3ProfileUrl: row.on3Slug ? `https://www.on3.com/rivals/${row.on3Slug}/` : buildOn3ProfileUrl(existing || row),
    stars: row.stars || existing?.stars,
    natlRank: row.natlRank || existing?.natlRank,
    category: existing?.category === 'recruit' && store.isFloridaCommit(existing) ? 'recruit' : 'target',
    status: existing?.status || 'uncommitted',
    rivalsLastPrediction: row.timestamp,
    rivalsAnalyst: row.analystName,
    rivalsConfidence: row.confidence,
    rivalsArticleUrl: row.articleUrl,
    skinny: copy.skinny,
    profileNote: copy.profileNote
  };
  const player = await store.upsertPlayer(playerPatch);

  const intelResult = await intelStore.addIntel({
    playerId: String(row.on3Id || player.on3Id || player.slug),
    playerSlug: player.slug,
    playerName: player.name,
    classYear: player.classYear,
    pos: player.pos,
    eventType: 'prediction',
    status: 'Rivals FutureCast · Florida',
    timestamp: row.timestamp,
    source: row.source,
    sourceHandle: row.analystHandle,
    detail: row.detail,
    fingerprint: row.fingerprint,
    analystName: row.analystName,
    confidencePct: row.confidence,
    ufRpmPct: row.ufRpmPct,
    stars: row.stars,
    natlRank: row.natlRank,
    school: row.school,
    highSchool: row.highSchool,
    hometownState: row.hometownState,
    articleUrl: row.articleUrl,
    rivalsPickKey: row.pickKey,
    predictionSchool: row.predictionSchool
  });

  if (!intelResult.created && intelResult.duplicate) {
    snapshot.fingerprints[row.fingerprint] = row.timestamp;
    return { skipped: true, reason: 'intel_exists' };
  }

  await store.createEvent({
    playerId: player.id,
    playerSlug: player.slug,
    eventType: 'prediction',
    title: `Rivals PM: ${row.analystName} picks Florida for ${player.name}`,
    detail: copy.profileNote,
    skinny: copy.skinny,
    classYear: player.classYear,
    payload: { player, rivals: row },
    source: 'rivals_pm'
  });

  appendWarRoomPrediction({ ...row, playerSlug: player.slug });
  const alert = appendInternalAlert({ ...row, playerSlug: player.slug });

  liveStore.upsertFeedItem({
    id: `rivals_pm_${row.fingerprint}`,
    dedupeKey: row.fingerprint,
    type: 'prediction',
    title: `Rivals PM: ${row.analystName} → ${player.name}`,
    summary: row.detail,
    source_url: row.articleUrl || `/player/${player.slug}`,
    source: 'rivals_pm',
    author: row.analystName,
    createdAt: row.timestamp,
    meta: {
      eventType: 'prediction',
      playerSlug: player.slug,
      analystName: row.analystName,
      confidence: row.confidence,
      internalAlert: true,
      alertId: alert.id
    }
  });

  const autopost = await queueAutoposter({ ...row, playerSlug: player.slug }, intelResult.item?.id);
  snapshot.fingerprints[row.fingerprint] = row.timestamp;

  return {
    processed: true,
    player: player.slug,
    analyst: row.analystName,
    autopost,
    fingerprint: row.fingerprint
  };
}

async function collectBeatPredictions() {
  const beat = getBeatPosts(60);
  const rows = [];
  for (const post of beat.posts || []) {
    if (!eligibility.isTodayOrNewer(post.publishedAt)) continue;
    const parsed = beatParser.parseBeatPostForPrediction(post);
    if (parsed && eligibility.isTodayOrNewer(parsed.timestamp)) rows.push(parsed);
  }
  return rows;
}

async function runRivalsPredictionIngest({ force = false } = {}) {
  const snapshot = loadSnapshot();
  const results = { processed: [], skipped: [], errors: [] };

  let apiRows = [];
  try {
    apiRows = await client.fetchAllUfPredictions(CLASS_YEARS.length ? CLASS_YEARS : [2027, 2028, 2029]);
  } catch (e) {
    results.errors.push({ stage: 'fetch', error: e.message });
  }

  let beatRows = [];
  try {
    beatRows = await collectBeatPredictions();
  } catch (e) {
    results.errors.push({ stage: 'beat', error: e.message });
  }

  const byFp = new Map();
  [...apiRows, ...beatRows].forEach((row) => {
    if (row?.fingerprint) byFp.set(row.fingerprint, row);
  });

  const candidates = [...byFp.values()].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  for (const row of candidates) {
    try {
      const gate = await eligibility.evaluatePredictionGate(row, snapshot);
      if (!gate.allowed) {
        if (gate.markSeen) eligibility.markSeen(snapshot, row, gate.reason);
        results.skipped.push({
          fingerprint: row.fingerprint,
          player: row.playerName,
          reason: gate.reason
        });
        continue;
      }
      const out = await processPrediction(row, snapshot);
      if (out.processed) results.processed.push(out);
      else results.skipped.push(out);
    } catch (e) {
      results.errors.push({ player: row.playerName, error: e.message });
    }
  }

  saveSnapshot(snapshot);
  if (results.processed.length) clearHeatCheckCache();

  appendLog({
    processed: results.processed.length,
    skipped: results.skipped.length,
    errors: results.errors.length,
    candidates: candidates.length,
    todayOnly: true,
    tz: eligibility.TZ
  });

  return {
    ok: true,
    ...results,
    processedCount: results.processed.length,
    lastRun: snapshot.lastRun,
    policy: {
      todayOnly: true,
      timezone: eligibility.TZ,
      todayKey: eligibility.toDateKey(new Date().toISOString())
    }
  };
}

function getRivalsPmStatus() {
  const snapshot = loadSnapshot();
  const log = readJson(LOG_PATH, { runs: [] });
  return {
    ok: true,
    enabled: process.env.RIVALS_PM_INGEST_ENABLED === 'true',
    classYears: CLASS_YEARS,
    lastRun: snapshot.lastRun,
    trackedPicks: Object.keys(snapshot.fingerprints || {}).length,
    trackedPickKeys: Object.keys(snapshot.pickKeys || {}).length,
    policy: {
      todayOnly: true,
      timezone: eligibility.TZ,
      todayKey: eligibility.toDateKey(new Date().toISOString()),
      skipCommitted: true,
      activeTargetsOnly: true
    },
    recentRuns: (log.runs || []).slice(0, 5)
  };
}

module.exports = {
  runRivalsPredictionIngest,
  getRivalsPmStatus,
  processPrediction,
  SNAPSHOT_PATH,
  INTERNAL_ALERTS_PATH
};
