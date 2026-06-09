/**
 * Beat-sourced visit intel — OV cancellations, visit changes (Hayes Fawcett, etc.).
 */
const fs = require('fs');
const path = require('path');
const parser = require('./beat-visit-intel-parser');
const { getBeatPosts } = require('./live-beat');
const store = require('./recruiting-store');
const intelStore = require('./recruiting-intel-store');
const liveStore = require('./live-store');
const { clearHeatCheckCache } = require('./heat-check-store');
const { buildOn3ProfileUrl } = require('./on3-urls');

const DATA_DIR = path.join(__dirname, '..', 'data', 'recruiting');
const SNAPSHOT_PATH = path.join(DATA_DIR, 'visit-intel-snapshot.json');
const WAR_ROOM_VISITS_PATH = path.join(__dirname, '..', 'data', 'war-room', 'visit-intel.json');
const SITE_URL = process.env.SITE_URL || 'https://gatorvaultinsider.com';

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
  return readJson(SNAPSHOT_PATH, { version: 1, fingerprints: {}, lastRun: null });
}

function saveSnapshot(doc) {
  doc.lastRun = new Date().toISOString();
  writeJson(SNAPSHOT_PATH, doc);
}

function appendWarRoomVisit(row) {
  const doc = readJson(WAR_ROOM_VISITS_PATH, { version: 1, visits: [] });
  doc.visits = doc.visits || [];
  doc.visits.unshift({
    playerSlug: row.playerSlug,
    playerName: row.playerName,
    classYear: row.classYear,
    pos: row.pos,
    eventType: row.eventType,
    cancelledSchool: row.cancelledSchool,
    nextVisitSchool: row.nextVisitSchool,
    source: row.source,
    detail: row.detail,
    articleUrl: row.articleUrl,
    loggedAt: row.timestamp
  });
  doc.visits = doc.visits.slice(0, 200);
  doc.updatedAt = new Date().toISOString();
  writeJson(WAR_ROOM_VISITS_PATH, doc);
}

function buildAutoposterText(row) {
  const copy = require('./x-autoposter-copy');
  const built = copy.buildIntelCopy({
    eventType: 'visit_cancelled',
    playerName: row.playerName,
    nextVisitSchool: row.nextVisitSchool,
    source: row.source
  });
  return built?.text || copy.appendSite(`${row.playerName} has cancelled his OV to Florida — via ${row.source} 🐊`);
}

async function queueAutoposter(row, intelId) {
  try {
    const xStore = require('./x-autoposter-store');
    const policy = require('./x-autoposter-policy');
    const text = buildAutoposterText(row);
    const fp = row.fingerprint;
    const copy = require('./x-autoposter-copy');
    if (!text || copy.isBrokenCopy(text) || !copy.isValidPlayerName(row.playerName)) {
      return { queued: false, reason: 'invalid_copy' };
    }
    const doc = xStore.loadQueue();
    const dup = doc.items.some(
      (i) => i.intelFingerprint === fp && (i.status === 'pending' || i.status === 'sent')
    );
    if (dup) return { queued: false, reason: 'duplicate' };

    const payload = {
      text,
      category: 'news',
      topic: 'recruiting',
      sources: [{ label: row.source, url: row.articleUrl || SITE_URL }],
      source: 'auto:visit-intel',
      intelFingerprint: fp,
      intelType: 'visit_cancelled',
      playerName: row.playerName,
      sourceIntelId: intelId,
      scheduledAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      status: 'pending'
    };
    const check = policy.validatePostContent(payload);
    if (!check.valid) return { queued: false, reason: 'policy', errors: check.errors };
    const out = xStore.enqueuePost(payload);
    return { queued: true, item: out.item };
  } catch (e) {
    return { queued: false, reason: e.message };
  }
}

async function processVisitIntelRow(row, snapshot) {
  if (!row?.fingerprint || !row.playerName) return { skipped: true, reason: 'invalid' };
  if (snapshot.fingerprints[row.fingerprint]) {
    return { skipped: true, reason: 'duplicate', fingerprint: row.fingerprint };
  }
  if (intelStore.hasIntelFingerprint(row.fingerprint)) {
    snapshot.fingerprints[row.fingerprint] = row.timestamp;
    return { skipped: true, reason: 'intel_duplicate' };
  }

  const existing = await store.getPlayerBySlug(row.playerSlug);
  const playerPatch = {
    slug: row.playerSlug,
    name: row.playerName,
    pos: row.pos || existing?.pos,
    classYear: row.classYear || existing?.classYear,
    school: row.school || existing?.school,
    on3Id: String(row.on3Id || existing?.on3Id || '').replace(/^beat_/, '') || existing?.on3Id,
    on3ProfileUrl: existing?.on3ProfileUrl || buildOn3ProfileUrl(existing || row),
    category: 'target',
    status: existing?.status || 'uncommitted',
    ufOvStatus: 'cancelled',
    ufOvCancelledAt: row.timestamp,
    nextVisitSchool: row.nextVisitSchool || existing?.nextVisitSchool,
    visitStart: null,
    visitEnd: null,
    skinny: row.detail,
    profileNote: row.nextVisitSchool
      ? `OV to Florida cancelled · now visiting ${row.nextVisitSchool}`
      : 'OV to Florida cancelled'
  };
  const player = await store.upsertPlayer(playerPatch);

  const intelResult = await intelStore.addIntel({
    playerId: String(row.on3Id || player.on3Id || player.slug),
    playerSlug: player.slug,
    playerName: player.name,
    classYear: player.classYear,
    pos: player.pos,
    eventType: row.eventType || 'visit_cancelled',
    status: row.status || 'OV Cancelled · Florida',
    timestamp: row.timestamp,
    source: row.source,
    sourceHandle: row.sourceHandle,
    detail: row.detail,
    fingerprint: row.fingerprint,
    cancelledSchool: row.cancelledSchool || 'Florida',
    nextVisitSchool: row.nextVisitSchool
  });

  if (!intelResult.created && intelResult.duplicate) {
    snapshot.fingerprints[row.fingerprint] = row.timestamp;
    return { skipped: true, reason: 'intel_exists' };
  }

  await store.createEvent({
    playerId: player.id,
    playerSlug: player.slug,
    eventType: 'visit_cancelled',
    title: `${player.name} — OV to Florida cancelled${row.nextVisitSchool ? ` · visiting ${row.nextVisitSchool}` : ''}`,
    detail: row.detail,
    skinny: `${player.pos || 'Recruit'} · ${player.classYear || ''} · via ${row.source}`,
    classYear: player.classYear,
    payload: { player, visitIntel: row },
    source: row.sourceType === 'manual' ? row.source : 'beat_visit_intel'
  });

  appendWarRoomVisit({ ...row, playerSlug: player.slug });

  liveStore.upsertFeedItem({
    id: `visit_intel_${row.fingerprint}`,
    dedupeKey: row.fingerprint,
    type: 'visit',
    title: `${player.name} — OV to Florida cancelled`,
    summary: row.detail,
    source_url: row.articleUrl || `/player/${player.slug}`,
    source: row.source,
    author: row.source,
    createdAt: row.timestamp,
    meta: {
      eventType: 'visit_cancelled',
      playerSlug: player.slug,
      nextVisitSchool: row.nextVisitSchool,
      cancelledSchool: row.cancelledSchool
    }
  });

  const autopost = await queueAutoposter({ ...row, playerSlug: player.slug }, intelResult.item?.id);
  snapshot.fingerprints[row.fingerprint] = row.timestamp;

  return {
    processed: true,
    player: player.slug,
    source: row.source,
    autopost,
    fingerprint: row.fingerprint
  };
}

async function collectBeatVisitRows() {
  const beat = getBeatPosts(60);
  const cutoff = Date.now() - 7 * 86400000;
  const rows = [];
  for (const post of beat.posts || []) {
    if (new Date(post.publishedAt).getTime() < cutoff) continue;
    const parsed = parser.parseBeatPostForVisitChange(post);
    if (parsed) rows.push(parsed);
  }
  return rows;
}

async function runBeatVisitIntelIngest({ force = false, manualRows = [] } = {}) {
  const snapshot = loadSnapshot();
  const results = { processed: [], skipped: [], errors: [] };

  let beatRows = [];
  try {
    beatRows = await collectBeatVisitRows();
  } catch (e) {
    results.errors.push({ stage: 'beat', error: e.message });
  }

  const byFp = new Map();
  [...manualRows, ...beatRows].forEach((row) => {
    if (row?.fingerprint) byFp.set(row.fingerprint, row);
  });

  const candidates = [...byFp.values()].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  for (const row of candidates) {
    try {
      const isNew = !snapshot.fingerprints[row.fingerprint];
      if (!force && !isNew) {
        results.skipped.push({ fingerprint: row.fingerprint, reason: 'snapshot' });
        continue;
      }
      const ageMs = Date.now() - new Date(row.timestamp).getTime();
      if (!force && ageMs > 14 * 86400000) {
        results.skipped.push({ fingerprint: row.fingerprint, reason: 'stale' });
        continue;
      }
      const out = await processVisitIntelRow(row, snapshot);
      if (out.processed) results.processed.push(out);
      else results.skipped.push(out);
    } catch (e) {
      results.errors.push({ player: row.playerName, error: e.message });
    }
  }

  saveSnapshot(snapshot);
  if (results.processed.length) clearHeatCheckCache();

  return {
    ok: true,
    ...results,
    processedCount: results.processed.length,
    lastRun: snapshot.lastRun
  };
}

/** Ingest a single manual visit-intel row (e.g. Hayes Fawcett breaking news). */
async function ingestManualVisitIntel(row) {
  const snapshot = loadSnapshot();
  const out = await processVisitIntelRow(row, snapshot);
  saveSnapshot(snapshot);
  if (out.processed) clearHeatCheckCache();
  return out;
}

module.exports = {
  runBeatVisitIntelIngest,
  ingestManualVisitIntel,
  processVisitIntelRow,
  buildAutoposterText,
  SNAPSHOT_PATH,
  WAR_ROOM_VISITS_PATH
};
