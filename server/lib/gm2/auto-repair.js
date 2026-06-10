/**
 * GM 2.0 — automatic identity repair for quarantined and corrupted players.
 */
const fs = require('fs');
const path = require('path');
const quarantine = require('./quarantine-store');
const decisionLog = require('./decision-log');
const identityValidator = require('../identity-record-validator');
const { GM2_ACTIONS } = require('./types');

const REPAIR_QUEUE_PATH = path.join(__dirname, '..', '..', 'data', 'recruiting', 'gm2-repair-queue.json');
const REPAIR_LOG_PATH = path.join(__dirname, '..', '..', 'data', 'recruiting', 'gm2-repair-log.json');

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

function readRepairQueue() {
  const doc = readJson(REPAIR_QUEUE_PATH, { slugs: [], updatedAt: null });
  doc.slugs = [...new Set((doc.slugs || []).filter(Boolean))];
  return doc;
}

function writeRepairQueue(doc) {
  doc.updatedAt = new Date().toISOString();
  writeJson(REPAIR_QUEUE_PATH, doc);
}

function schedulePlayerRepair(slug, { reason = 'needs_identity_repair', source = 'gm2' } = {}) {
  const s = String(slug || '').trim();
  if (!s) return false;
  const doc = readRepairQueue();
  if (!doc.slugs.includes(s)) doc.slugs.push(s);
  writeRepairQueue(doc);
  decisionLog.logDecision({
    layer: 'auto-repair',
    action: GM2_ACTIONS.NEEDS_RESOLUTION,
    playerSlug: s,
    reason,
    source
  });
  return true;
}

function dequeuePlayerRepair(slug) {
  const doc = readRepairQueue();
  doc.slugs = (doc.slugs || []).filter((s) => s !== slug);
  writeRepairQueue(doc);
}

function listRepairQueue() {
  return readRepairQueue().slugs || [];
}

function appendRepairLog(entry) {
  const doc = readJson(REPAIR_LOG_PATH, { runs: [] });
  doc.runs = doc.runs || [];
  doc.runs.unshift({ ...entry, at: new Date().toISOString() });
  doc.runs = doc.runs.slice(0, 100);
  writeJson(REPAIR_LOG_PATH, doc);
}

async function repairPlayer(slug, options = {}) {
  const targetSlug = String(slug || '').trim();
  if (!targetSlug) return { ok: false, error: 'missing_slug' };

  let result = await identityValidator.rebuildPlayerIdentityFromOn3(targetSlug, options);
  if (!result.ok) {
    const store = require('../recruiting-store');
    const existing = await store.getPlayerBySlug(targetSlug);
    if (existing) {
      const healed = identityValidator.healPlayerRecord(existing, existing);
      const validation = identityValidator.validatePlayerIdentityRecord(healed);
      const classification = identityValidator.classifyIdentityErrors(validation.errors);
      if (validation.valid || classification.canWrite) {
        await store.upsertPlayer(healed, { repairMode: true, subsystem: 'auto-repair-heal' });
        result = { ok: true, slug: targetSlug, fallback: 'heal', validation };
      }
    }
  }

  if (result.ok) {
    quarantine.releasePlayer(targetSlug);
    quarantine.clearPlayerQuarantine(targetSlug);
    dequeuePlayerRepair(targetSlug);
    decisionLog.logDecision({
      layer: 'auto-repair',
      action: GM2_ACTIONS.ALLOW,
      playerSlug: targetSlug,
      reason: result.fallback ? 'identity_healed' : 'identity_rebuilt',
      source: options.source || 'auto-repair'
    });
  } else {
    decisionLog.logDecision({
      layer: 'auto-repair',
      action: GM2_ACTIONS.REJECT,
      playerSlug: targetSlug,
      reason: result.error || 'repair_failed',
      errors: result.validation?.errors,
      source: options.source || 'auto-repair'
    });
  }
  return result;
}

async function clearStaleQuarantines() {
  const released = [];
  for (const row of quarantine.listQuarantinedPlayers()) {
    const store = require('../recruiting-store');
    const player = await store.getPlayerBySlug(row.slug);
    if (!player) continue;
    const healed = identityValidator.healPlayerRecord(player, player);
    const validation = identityValidator.validatePlayerIdentityRecord(healed);
    if (validation.valid) {
      quarantine.releasePlayer(row.slug);
      quarantine.clearPlayerQuarantine(row.slug);
      dequeuePlayerRepair(row.slug);
      released.push(row.slug);
    }
  }
  return released;
}

async function repairAllQuarantined(options = {}) {
  const slugs = quarantine.listQuarantinedPlayers().map((p) => p.slug);
  const queued = listRepairQueue();
  const all = [...new Set([...slugs, ...queued])];
  const results = { total: all.length, repaired: 0, failed: 0, items: [] };

  for (const slug of all) {
    if (options.limit && results.repaired + results.failed >= options.limit) break;
    try {
      const r = await repairPlayer(slug, { source: options.source || 'bulk-repair' });
      if (r.ok) results.repaired += 1;
      else results.failed += 1;
      results.items.push({ slug, ok: r.ok, error: r.error, errors: r.validation?.errors });
    } catch (err) {
      results.failed += 1;
      results.items.push({ slug, ok: false, error: err.message });
    }
  }

  appendRepairLog({ type: 'repair_all_quarantined', ...results, source: options.source });
  return results;
}

async function sanitizePlayerInStore(player, options = {}) {
  const store = require('../recruiting-store');
  const existing = player.slug ? await store.getPlayerBySlug(player.slug) : null;
  const healed = identityValidator.healPlayerRecord(player, existing || player);
  const validation = identityValidator.validatePlayerIdentityRecord(healed);
  const classification = identityValidator.classifyIdentityErrors(validation.errors);

  if (!classification.canWrite) {
    schedulePlayerRepair(player.slug, { reason: 'hard_identity_failure', source: options.source });
    return { slug: player.slug, action: 'quarantine', errors: validation.errors };
  }

  const before = JSON.stringify(existing || player);
  await store.upsertPlayer(healed, { repairMode: true, subsystem: options.subsystem || 'gm2-sanitize' });

  if (validation.valid) {
    if (quarantine.isPlayerQuarantined(player.slug)) quarantine.releasePlayer(player.slug);
    dequeuePlayerRepair(player.slug);
    return {
      slug: player.slug,
      action: before === JSON.stringify(healed) ? 'unchanged' : 'fixed',
      validation
    };
  }

  schedulePlayerRepair(player.slug, { reason: validation.errors.join(','), source: options.source });
  return { slug: player.slug, action: 'healed_needs_repair', errors: validation.errors };
}

async function sanitizeAllPlayersInStore(options = {}) {
  const store = require('../recruiting-store');
  const players = await store.getAllPlayers();
  const summary = { total: players.length, fixed: 0, healedNeedsRepair: 0, unchanged: 0, quarantined: 0, items: [] };

  for (const player of players) {
    if (options.limit && summary.fixed + summary.healedNeedsRepair + summary.quarantined >= options.limit) break;
    const r = await sanitizePlayerInStore(player, options);
    summary.items.push(r);
    if (r.action === 'fixed') summary.fixed += 1;
    else if (r.action === 'unchanged') summary.unchanged += 1;
    else if (r.action === 'healed_needs_repair') summary.healedNeedsRepair += 1;
    else if (r.action === 'quarantine') summary.quarantined += 1;
  }

  appendRepairLog({ type: 'sanitize_all', ...summary, source: options.source });
  return summary;
}

async function runAutoRepair(options = {}) {
  const source = options.source || 'nightly';
  console.log('[gm2:auto-repair] starting', source);

  const sanitize = await sanitizeAllPlayersInStore({ source, limit: options.sanitizeLimit });
  const repair = await repairAllQuarantined({ source, limit: options.repairLimit });
  const released = await clearStaleQuarantines();

  const out = {
    ok: true,
    source,
    sanitize,
    repair,
    releasedStaleQuarantines: released,
    quarantineRemaining: quarantine.listQuarantinedPlayers().length,
    repairQueueRemaining: listRepairQueue().length
  };

  console.log(
    '[gm2:auto-repair] done',
    source,
    'fixed:',
    sanitize.fixed,
    'repaired:',
    repair.repaired,
    'failed:',
    repair.failed,
    'quarantine left:',
    out.quarantineRemaining
  );

  appendRepairLog({ type: 'auto_repair_run', ...out });
  return out;
}

function getRepairStatus() {
  return {
    repairQueue: listRepairQueue(),
    repairQueueCount: listRepairQueue().length,
    lastRuns: (readJson(REPAIR_LOG_PATH, { runs: [] }).runs || []).slice(0, 5)
  };
}

module.exports = {
  REPAIR_QUEUE_PATH,
  schedulePlayerRepair,
  dequeuePlayerRepair,
  listRepairQueue,
  repairPlayer,
  repairAllQuarantined,
  clearStaleQuarantines,
  sanitizePlayerInStore,
  sanitizeAllPlayersInStore,
  runAutoRepair,
  getRepairStatus
};
