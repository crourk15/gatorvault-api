const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const policy = require('./x-autoposter-policy');

const DATA_DIR = path.join(__dirname, '..', 'data', 'x');
const QUEUE_PATH = path.join(DATA_DIR, 'autoposter-queue.json');
const OPS_LOG_PATH = path.join(DATA_DIR, 'autoposter-ops-log.json');
const OPS_LOG_MAX = 200;

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return `xp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function defaultDoc() {
  return { version: 2, updatedAt: nowIso(), items: [] };
}

function loadQueue() {
  try {
    const raw = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
    if (!Array.isArray(raw.items)) return defaultDoc();
    return { ...defaultDoc(), ...raw, items: raw.items };
  } catch {
    return defaultDoc();
  }
}

function saveQueue(doc) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  doc.version = 2;
  doc.updatedAt = nowIso();
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(doc, null, 2));
  return doc;
}

function normalizeItem(raw, { validate = true } = {}) {
  const text = String(raw.text || '').trim();
  const category = String(raw.category || 'news').toLowerCase();
  const action = String(raw.action || 'post').toLowerCase();
  const sources = (raw.sources || []).map(policy.normalizeSource).filter(Boolean);

  const scheduledAt = raw.scheduledAt ? new Date(raw.scheduledAt).toISOString() : nowIso();
  if (Number.isNaN(new Date(scheduledAt).getTime())) throw new Error('Invalid scheduledAt');

  const item = {
    id: raw.id || newId(),
    text,
    category,
    action,
    topic: raw.topic ? String(raw.topic).toLowerCase() : null,
    sources,
    inReplyToStatusId: raw.inReplyToStatusId ? String(raw.inReplyToStatusId) : null,
    quoteTweetUrl: raw.quoteTweetUrl ? String(raw.quoteTweetUrl).trim() : null,
    quoteTweetId: raw.quoteTweetId ? String(raw.quoteTweetId) : null,
    promoLink: raw.promoLink ? String(raw.promoLink).trim() : null,
    scheduledAt,
    status: raw.status || 'pending',
    mediaBase64: raw.mediaBase64 || null,
    mediaMime: raw.mediaMime || null,
    createdAt: raw.createdAt || nowIso(),
    sentAt: raw.sentAt || null,
    tweetId: raw.tweetId || null,
    tweetUrl: raw.tweetUrl || null,
    error: raw.error || null,
    validationErrors: raw.validationErrors || [],
    source: raw.source || 'manual',
    commitFingerprint: raw.commitFingerprint || null,
    intelFingerprint: raw.intelFingerprint || raw.commitFingerprint || null,
    sourceEventId: raw.sourceEventId || null,
    sourceIntelId: raw.sourceIntelId || null,
    intelType: raw.intelType || null,
    playerName: raw.playerName || null,
    playerSlug: raw.playerSlug ? String(raw.playerSlug).toLowerCase() : null,
    replyFingerprint: raw.replyFingerprint || null,
    postUrgency: raw.postUrgency || null,
    urgencyLabel: raw.urgencyLabel || null,
    sourceEventType: raw.sourceEventType || null,
    sourceEventCreatedAt: raw.sourceEventCreatedAt || null,
    sourcePublishedAt: raw.sourcePublishedAt || null,
    eventTimestamp: raw.eventTimestamp || null,
    templateBlocks: raw.templateBlocks || null,
    validationMeta: raw.validationMeta || null,
    playerContext: raw.playerContext || null,
    qualityScore: raw.qualityScore != null ? Number(raw.qualityScore) : null,
    qualityBreakdown: raw.qualityBreakdown || null,
    sourceConfidence: raw.sourceConfidence != null ? Number(raw.sourceConfidence) : null,
    triggerType: raw.triggerType || null,
    teamEventType: raw.teamEventType || null,
    programNewsType: raw.programNewsType || null,
    identityConfirmed: raw.identityConfirmed === true ? true : raw.identityConfirmed === false ? false : undefined,
    verifiedCommit: raw.verifiedCommit === true || raw.validationMeta?.verifiedCommit === true,
    monitoringFallback: raw.monitoringFallback === true,
    clusterFingerprint: raw.clusterFingerprint || null,
    clusterMeta: raw.clusterMeta || null
  };

  if (validate) {
    const check = policy.validatePostContent(item);
    if (!check.valid) {
      const err = new Error(check.errors.map((e) => e.message).join(' '));
      err.validation = check;
      throw err;
    }
  }

  return item;
}

function listQueue({ status = null, category = null, triggerType = null, limit = 100 } = {}) {
  const doc = loadQueue();
  let items = [...doc.items];
  if (status) items = items.filter((i) => i.status === status);
  if (category) items = items.filter((i) => i.category === category);
  if (triggerType) {
    const tt = String(triggerType).toLowerCase();
    items = items.filter(
      (i) =>
        String(i.triggerType || '').toLowerCase() === tt ||
        String(i.sourceEventType || '').toLowerCase() === tt ||
        String(i.intelType || '').toLowerCase() === tt
    );
  }
  items.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  return items.slice(0, limit);
}

function getDuePosts(limit = 10) {
  const now = Date.now();
  return listQueue({ status: 'pending' })
    .filter((i) => new Date(i.scheduledAt).getTime() <= now)
    .slice(0, limit);
}

function getMixStats(options) {
  const doc = loadQueue();
  const sent = policy.getSentPosts(doc.items, options);
  return policy.computeMixStats(sent);
}

function appendOpsLog(entry) {
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(OPS_LOG_PATH, 'utf8'));
  } catch {
    doc = { version: 1, entries: [] };
  }
  doc.entries = doc.entries || [];
  doc.entries.unshift({ ts: nowIso(), ...entry });
  doc.entries = doc.entries.slice(0, OPS_LOG_MAX);
  doc.updatedAt = nowIso();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OPS_LOG_PATH, JSON.stringify(doc, null, 2));
  return doc.entries[0];
}

function logQueueOp(action, item, extra = {}) {
  const row = {
    action,
    itemId: item?.id || null,
    intelFingerprint: item?.intelFingerprint || item?.commitFingerprint || null,
    sourceIntelId: item?.sourceIntelId || null,
    playerName: item?.playerName || null,
    status: item?.status || null,
    queueLength: loadQueue().items.length,
    ...extra
  };
  appendOpsLog(row);
  const tag = `[x-autoposter-queue] ${action}`;
  if (extra.error) console.warn(tag, row);
  else console.log(tag, {
    itemId: row.itemId,
    fingerprint: row.intelFingerprint,
    player: row.playerName,
    pending: loadQueue().items.filter((i) => i.status === 'pending').length
  });
}

function findByIntel(idOrFingerprint) {
  const key = String(idOrFingerprint || '');
  const doc = loadQueue();
  return (
    doc.items.find(
      (i) =>
        i.sourceIntelId === key ||
        i.intelFingerprint === key ||
        i.commitFingerprint === key
    ) || null
  );
}

function hasActiveQueueItemForIntel(idOrFingerprint) {
  const key = String(idOrFingerprint || '');
  const doc = loadQueue();
  return doc.items.some(
    (i) =>
      (i.sourceIntelId === key || i.intelFingerprint === key) &&
      ['pending', 'sent'].includes(i.status)
  );
}

function enqueuePost(raw) {
  const doc = loadQueue();
  const item = normalizeItem(raw, { validate: true });
  doc.items.push(item);
  saveQueue(doc);
  logQueueOp('enqueue', item, { source: item.source || 'manual' });
  return { item, mix: getMixStats() };
}

function updatePost(id, patch) {
  const doc = loadQueue();
  const idx = doc.items.findIndex((i) => i.id === id);
  if (idx < 0) throw new Error('Queue item not found');
  doc.items[idx] = { ...doc.items[idx], ...patch };
  saveQueue(doc);
  logQueueOp('update', doc.items[idx], { patchKeys: Object.keys(patch || {}) });
  return doc.items[idx];
}

function cancelPost(id) {
  return updatePost(id, { status: 'cancelled' });
}

function isRecoverableFailedItem(item, { maxAgeMs = 30 * 24 * 60 * 60 * 1000 } = {}) {
  if (!item || item.status !== 'failed') return false;
  const err = String(item.error || '');
  if (/duplicate content/i.test(err)) return false;
  const ts = new Date(item.createdAt || item.sourceEventCreatedAt || item.scheduledAt || 0).getTime();
  if (Number.isFinite(ts) && ts > 0 && Date.now() - ts > maxAgeMs) return false;
  if (item.verifiedCommit || item.validationMeta?.verifiedCommit) return true;
  const check = policy.validatePostContent(item);
  if (check.valid) return true;
  if (/rewrite_failed|too_short|rewrite failed/i.test(err)) {
    return policy.validatePostContent(item).valid;
  }
  return false;
}

function rependFailedItem(item) {
  item.status = 'pending';
  item.error = null;
  item.validationErrors = [];
  item.sentAt = null;
  item.scheduledAt = nowIso();
}

/** Re-queue verified commits that failed GM2 rewrite — premade On3 copy is post-ready. */
function recoverFailedVerifiedCommits() {
  const doc = loadQueue();
  let recovered = 0;
  for (const item of doc.items) {
    if (item.status !== 'failed') continue;
    if (!(item.verifiedCommit || item.validationMeta?.verifiedCommit)) continue;
    if (/duplicate content/i.test(String(item.error || ''))) continue;
    rependFailedItem(item);
    recovered += 1;
  }
  if (recovered) {
    saveQueue(doc);
    logQueueOp('recover_verified', { id: 'batch', count: recovered }, { recovered });
  }
  return recovered;
}

/** Re-queue any recent failed item that still passes validation (force-post safety net). */
function recoverFailedPostableItems(opts = {}) {
  const doc = loadQueue();
  let recovered = 0;
  for (const item of doc.items) {
    if (!isRecoverableFailedItem(item, opts)) continue;
    rependFailedItem(item);
    recovered += 1;
  }
  if (recovered) {
    saveQueue(doc);
    logQueueOp('recover_postable', { id: 'batch', count: recovered }, { recovered });
  }
  return recovered;
}

module.exports = {
  QUEUE_PATH,
  OPS_LOG_PATH,
  loadQueue,
  saveQueue,
  normalizeItem,
  listQueue,
  getDuePosts,
  getMixStats,
  enqueuePost,
  updatePost,
  cancelPost,
  recoverFailedVerifiedCommits,
  recoverFailedPostableItems,
  isRecoverableFailedItem,
  appendOpsLog,
  logQueueOp,
  findByIntel,
  hasActiveQueueItemForIntel,
  nowIso
};
