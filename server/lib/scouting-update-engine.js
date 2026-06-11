/**
 * Continuous Scouting Update Engine — scans ALL players on schedule or trigger.
 * NFL pipeline for roster; college recruiting pipeline for commits/recruits/targets.
 * Never generates AI scouting; never uses beat writers; never mixes evaluator types.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const scoutingDb = require('./scouting-database');
const fetcher = require('./scouting-fetcher');
const analysts = require('./scouting-analysts');
const { triggerScoutingUiRefresh } = require('./scouting-refresh');

const DATA_DIR = path.join(__dirname, '..', 'data', 'war-room');
const UPDATE_LOG_PATH = path.join(DATA_DIR, 'scouting-update-log.json');
const MAX_LOG_ENTRIES = parseInt(process.env.SCOUTING_UPDATE_LOG_MAX || '500', 10);

let cycleRunning = false;
const playerQueue = new Map();

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

function contentHash(text) {
  return crypto.createHash('sha256').update(String(text || '').trim()).digest('hex').slice(0, 20);
}

function classifyUpdateType(text) {
  const t = String(text || '');
  if (/\b(?:measurables?|height|weight|wingspan|40[- ]?yard|arm length|hand size)\b/i.test(t) && t.length < 220) {
    return 'Measurables';
  }
  if (/\b(?:comparison|comp(?:ares|ared)? to|reminds me of|similar to|NFL comp)\b/i.test(t)) {
    return 'Comparison';
  }
  if (/\b(?:scheme fit|fits (?:in|into)|system fit|gap scheme|zone scheme)\b/i.test(t)) {
    return 'Scheme Fit';
  }
  if (/\b(?:projection|projects? to|ceiling|floor|upside|NFL (?:role|level))\b/i.test(t)) {
    return 'Projection';
  }
  if (/\b(?:weakness|concern|needs to|lack of|limited|raw|inconsistent|question)\b/i.test(t)) {
    return 'Weaknesses';
  }
  if (/\b(?:strength|excel(?:s|led)?|plus|elite|explosive|powerful|intelligent|instincts)\b/i.test(t)) {
    return 'Strengths';
  }
  if (/["“][^"”]{12,}["”]/.test(t)) {
    return 'Verified Quote';
  }
  if (/\b(?:insider|source|told|according to)\b/i.test(t)) {
    return 'Insider Notes';
  }
  return 'Evaluation';
}

function splitStructuredUpdates(raw, player) {
  if (!raw?.scoutingSummary) return [];
  const base = scoutingDb.normalizeEntry(player, raw);
  if (!base) return [];

  const sentences = String(raw.scoutingSummary)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40);

  const updates = [];
  const sourceLabel = `${base.outlet || 'Unknown'} / ${base.analystName}`;

  if (sentences.length >= 3) {
    const buckets = { Strengths: [], Weaknesses: [], Projection: [], Comparison: [], 'Scheme Fit': [] };
    sentences.forEach((s) => {
      const type = classifyUpdateType(s);
      if (buckets[type]) buckets[type].push(s);
      else if (type === 'Weaknesses') buckets.Weaknesses.push(s);
      else buckets.Strengths.push(s);
    });
    Object.entries(buckets).forEach(([type, parts]) => {
      if (!parts.length) return;
      updates.push({
        playerId: base.playerId,
        source: sourceLabel,
        type,
        content: parts.join(' ').slice(0, 4000),
        timestamp: base.timestamp,
        analystName: base.analystName,
        sourceUrl: base.sourceUrl,
        sourceType: base.sourceType,
        contentHash: contentHash(parts.join(' '))
      });
    });
  }

  updates.unshift({
    playerId: base.playerId,
    source: sourceLabel,
    type: 'Evaluation',
    content: base.scoutingSummary.slice(0, 8000),
    timestamp: base.timestamp,
    analystName: base.analystName,
    sourceUrl: base.sourceUrl,
    sourceType: base.sourceType,
    contentHash: contentHash(base.scoutingSummary)
  });

  return updates;
}

function appendUpdateLog(entry) {
  const log = readJson(UPDATE_LOG_PATH, { entries: [] });
  log.entries = Array.isArray(log.entries) ? log.entries : [];
  log.entries.unshift(entry);
  if (log.entries.length > MAX_LOG_ENTRIES) log.entries.length = MAX_LOG_ENTRIES;
  log.updatedAt = new Date().toISOString();
  writeJson(UPDATE_LOG_PATH, log);
}

function mergeEntry(existing, player, raw, structuredUpdates) {
  const normalized = scoutingDb.normalizeEntry(player, raw);
  if (!normalized) return { entry: existing, changed: false, updatesAdded: 0 };

  const prev = existing || {
    playerId: normalized.playerId,
    playerSlug: normalized.playerSlug,
    playerName: normalized.playerName,
    playerType: normalized.playerType,
    updates: [],
    lastCheckedAt: null
  };

  const knownHashes = new Set((prev.updates || []).map((u) => u.contentHash).filter(Boolean));
  let updatesAdded = 0;
  const mergedUpdates = [...(prev.updates || [])];

  for (const u of structuredUpdates) {
    if (knownHashes.has(u.contentHash)) continue;
    mergedUpdates.unshift(u);
    knownHashes.add(u.contentHash);
    updatesAdded += 1;
  }

  mergedUpdates.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const latest = normalized.timestamp;
  const prevTs = prev.timestamp ? new Date(prev.timestamp).getTime() : 0;
  const newTs = new Date(latest).getTime();
  const summaryChanged = prev.scoutingSummary !== normalized.scoutingSummary;
  const isNewer = newTs > prevTs;

  const entry = {
    ...prev,
    ...normalized,
    updates: mergedUpdates.slice(0, 40),
    lastCheckedAt: new Date().toISOString(),
    contentHash: contentHash(normalized.scoutingSummary)
  };

  if (!isNewer && !summaryChanged && updatesAdded === 0) {
    entry.lastCheckedAt = new Date().toISOString();
    return { entry, changed: false, updatesAdded: 0 };
  }

  return { entry, changed: true, updatesAdded };
}

async function updatePlayerScouting(player, { reason = 'scheduled' } = {}) {
  const raw = await fetcher.findVerifiedScouting(player);
  let normalizedRaw = raw;
  if (!normalizedRaw) {
    const legacy = scoutingDb.importLegacyBreakdown(player);
    if (legacy) {
      normalizedRaw = {
        analystName: legacy.analystName,
        sourceUrl: legacy.sourceUrl,
        scoutingSummary: legacy.scoutingSummary,
        sourceType: legacy.sourceType,
        outlet: legacy.outlet,
        timestamp: legacy.timestamp
      };
    }
  }

  const doc = scoutingDb.loadDatabase();
  const pid = scoutingDb.playerIdFor(player);
  const existing = doc.entries[pid] || null;

  if (!normalizedRaw) {
    if (existing) {
      existing.lastCheckedAt = new Date().toISOString();
      doc.entries[pid] = existing;
      scoutingDb.saveDatabase(doc);
    }
    return { slug: player.slug, status: 'no_new_data', updatesAdded: 0 };
  }

  const structured = splitStructuredUpdates(normalizedRaw, player);
  const { entry, changed, updatesAdded } = mergeEntry(existing, player, normalizedRaw, structured);

  doc.entries[pid] = entry;
  scoutingDb.saveDatabase(doc);

  if (changed) {
    scoutingDb.syncEntryToBreakdown(entry);
    appendUpdateLog({
      at: new Date().toISOString(),
      reason,
      playerSlug: player.slug,
      playerName: player.name,
      playerType: player.playerType,
      updatesAdded,
      sourceType: entry.sourceType,
      analystName: entry.analystName,
      sourceUrl: entry.sourceUrl
    });
  }

  return {
    slug: player.slug,
    status: changed ? 'updated' : 'unchanged',
    updatesAdded,
    analystName: entry.analystName
  };
}

async function runContinuousScoutingUpdate({
  delayMs = null,
  playerSlug = null,
  reason = 'scheduled',
  onProgress = null
} = {}) {
  if (cycleRunning && !playerSlug) {
    return { ok: false, skipped: true, reason: 'cycle_already_running' };
  }

  const waitMs = delayMs != null ? delayMs : parseInt(process.env.SCOUTING_UPDATE_DELAY_MS || '400', 10);
  let players;
  try {
    players = scoutingDb.collectAllPlayers();
  } catch (e) {
    scoutingDb.writeRebuildStatus({
      running: false,
      phase: 'error',
      error: e.message,
      finishedAt: new Date().toISOString()
    });
    throw e;
  }

  if (playerSlug) {
    players = players.filter((p) => p.slug === playerSlug);
    if (!players.length) return { ok: false, error: 'player_not_found', playerSlug };
  }

  if (!playerSlug) cycleRunning = true;

  const startedAt = new Date().toISOString();
  const summary = {
    ok: true,
    reason,
    startedAt,
    finishedAt: null,
    total: players.length,
    updated: 0,
    unchanged: 0,
    blank: 0,
    errors: [],
    updatesAdded: 0
  };

  scoutingDb.writeRebuildStatus({
    running: true,
    phase: 'fetching',
    startedAt,
    finishedAt: null,
    error: null,
    progress: { index: 0, total: players.length, slug: null },
    lastRun: null
  });

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const progress = { index: i + 1, total: players.length, slug: player.slug };
    scoutingDb.writeRebuildStatus({ running: true, phase: 'fetching', progress });
    if (onProgress) onProgress(progress);

    try {
      const result = await updatePlayerScouting(player, { reason });
      if (result.status === 'updated') {
        summary.updated += 1;
        summary.updatesAdded += result.updatesAdded || 0;
      } else if (result.status === 'unchanged') summary.unchanged += 1;
      else summary.blank += 1;
    } catch (e) {
      summary.errors.push({ slug: player.slug, error: e.message });
      summary.blank += 1;
    }

    if (waitMs > 0 && i < players.length - 1) {
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  summary.finishedAt = new Date().toISOString();
  writeJson(scoutingDb.REBUILD_LOG_PATH, summary);

  scoutingDb.writeRebuildStatus({
    running: false,
    phase: 'done',
    finishedAt: summary.finishedAt,
    error: null,
    progress: { index: players.length, total: players.length, slug: null },
    lastRun: summary
  });

  if (!playerSlug) cycleRunning = false;

  const refresh = triggerScoutingUiRefresh({ reason, updated: summary.updated });
  return { ...summary, refresh };
}

function queuePlayerScoutingRefresh(playerSlug, { reason = 'player_status_change', delayMs = 8000 } = {}) {
  if (!playerSlug) return;
  const key = String(playerSlug);
  if (playerQueue.has(key)) clearTimeout(playerQueue.get(key).timer);
  const timer = setTimeout(() => {
    playerQueue.delete(key);
    runContinuousScoutingUpdate({ playerSlug: key, reason, delayMs: 200 }).catch((err) => {
      console.warn('[scouting-update] queued refresh failed:', key, err.message);
    });
  }, delayMs);
  playerQueue.set(key, { timer, reason });
}

function isCycleRunning() {
  return cycleRunning;
}

module.exports = {
  UPDATE_LOG_PATH,
  contentHash,
  classifyUpdateType,
  splitStructuredUpdates,
  updatePlayerScouting,
  runContinuousScoutingUpdate,
  queuePlayerScoutingRefresh,
  isCycleRunning,
  appendUpdateLog
};
