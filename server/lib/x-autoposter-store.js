const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const policy = require('./x-autoposter-policy');

const DATA_DIR = path.join(__dirname, '..', 'data', 'x');
const QUEUE_PATH = path.join(DATA_DIR, 'autoposter-queue.json');

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
    replyFingerprint: raw.replyFingerprint || null
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

function listQueue({ status = null, category = null, limit = 100 } = {}) {
  const doc = loadQueue();
  let items = [...doc.items];
  if (status) items = items.filter((i) => i.status === status);
  if (category) items = items.filter((i) => i.category === category);
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

function enqueuePost(raw) {
  const doc = loadQueue();
  const item = normalizeItem(raw, { validate: true });
  doc.items.push(item);
  saveQueue(doc);
  return { item, mix: getMixStats() };
}

function updatePost(id, patch) {
  const doc = loadQueue();
  const idx = doc.items.findIndex((i) => i.id === id);
  if (idx < 0) throw new Error('Queue item not found');
  doc.items[idx] = { ...doc.items[idx], ...patch };
  saveQueue(doc);
  return doc.items[idx];
}

function cancelPost(id) {
  return updatePost(id, { status: 'cancelled' });
}

module.exports = {
  QUEUE_PATH,
  loadQueue,
  saveQueue,
  normalizeItem,
  listQueue,
  getDuePosts,
  getMixStats,
  enqueuePost,
  updatePost,
  cancelPost,
  nowIso
};
