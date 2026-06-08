const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data', 'x');
const QUEUE_PATH = path.join(DATA_DIR, 'autoposter-queue.json');

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return `xp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function defaultDoc() {
  return { version: 1, updatedAt: nowIso(), items: [] };
}

function loadQueue() {
  try {
    const raw = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
    if (!Array.isArray(raw.items)) return defaultDoc();
    return raw;
  } catch {
    return defaultDoc();
  }
}

function saveQueue(doc) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  doc.updatedAt = nowIso();
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(doc, null, 2));
  return doc;
}

function normalizeItem(raw) {
  const text = String(raw.text || '').trim();
  if (!text) throw new Error('Post text required');
  if (text.length > 280) throw new Error('Post text exceeds 280 characters');

  const scheduledAt = raw.scheduledAt ? new Date(raw.scheduledAt).toISOString() : nowIso();
  if (Number.isNaN(new Date(scheduledAt).getTime())) throw new Error('Invalid scheduledAt');

  return {
    id: raw.id || newId(),
    text,
    scheduledAt,
    status: raw.status || 'pending',
    mediaBase64: raw.mediaBase64 || null,
    mediaMime: raw.mediaMime || null,
    createdAt: raw.createdAt || nowIso(),
    sentAt: raw.sentAt || null,
    tweetId: raw.tweetId || null,
    tweetUrl: raw.tweetUrl || null,
    error: raw.error || null,
    source: raw.source || 'manual'
  };
}

function listQueue({ status = null, limit = 100 } = {}) {
  const doc = loadQueue();
  let items = [...doc.items];
  if (status) items = items.filter((i) => i.status === status);
  items.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  return items.slice(0, limit);
}

function getDuePosts(limit = 10) {
  const now = Date.now();
  return listQueue({ status: 'pending' })
    .filter((i) => new Date(i.scheduledAt).getTime() <= now)
    .slice(0, limit);
}

function enqueuePost(raw) {
  const doc = loadQueue();
  const item = normalizeItem(raw);
  doc.items.push(item);
  saveQueue(doc);
  return item;
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
  listQueue,
  getDuePosts,
  enqueuePost,
  updatePost,
  cancelPost,
  nowIso
};
