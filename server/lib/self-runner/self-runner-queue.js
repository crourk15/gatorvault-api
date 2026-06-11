/**
 * Self-Runner — pending fix queue persistence.
 * server/data/ops/self-runner-queue.json
 */
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'ops', 'self-runner-queue.json');
const MAX_ITEMS = 100;

function emptyDoc() {
  return {
    version: 1,
    updatedAt: null,
    items: [],
    log: []
  };
}

function readDoc() {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch {
    return emptyDoc();
  }
}

function writeDoc(doc) {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA_PATH, JSON.stringify(doc, null, 2));
  return doc;
}

function appendLog(doc, entry) {
  doc.log = [{ ...entry, at: new Date().toISOString() }, ...(doc.log || [])].slice(0, 200);
  return doc;
}

function listByStatus(status) {
  const doc = readDoc();
  const items = doc.items || [];
  if (!status) return items;
  return items.filter((i) => i.status === status);
}

function getById(id) {
  return (readDoc().items || []).find((i) => i.id === id) || null;
}

function upsertItem(item) {
  let doc = readDoc();
  const items = doc.items || [];
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx >= 0) items[idx] = { ...items[idx], ...item, updatedAt: new Date().toISOString() };
  else items.unshift({ ...item, createdAt: item.createdAt || new Date().toISOString() });
  doc.items = items.slice(0, MAX_ITEMS);
  doc = writeDoc(doc);
  return item;
}

function addPending(fix) {
  const existing = getById(fix.id);
  if (existing && ['pending', 'approved', 'applying'].includes(existing.status)) {
    return existing;
  }
  return upsertItem({ ...fix, status: fix.status || 'pending' });
}

function markStatus(id, status, extra = {}) {
  const item = getById(id);
  if (!item) return null;
  const patch = { ...item, status, ...extra, updatedAt: new Date().toISOString() };
  if (status === 'approved') patch.approvedAt = extra.approvedAt || new Date().toISOString();
  if (status === 'rejected') patch.rejectedAt = extra.rejectedAt || new Date().toISOString();
  if (status === 'completed') patch.completedAt = extra.completedAt || new Date().toISOString();
  if (status === 'failed') patch.failedAt = extra.failedAt || new Date().toISOString();
  upsertItem(patch);
  let doc = readDoc();
  doc = appendLog(doc, { action: status, fixId: id, ...extra });
  writeDoc(doc);
  return patch;
}

function summary() {
  const items = readDoc().items || [];
  const counts = { pending: 0, approved: 0, rejected: 0, completed: 0, failed: 0, applying: 0 };
  items.forEach((i) => {
    if (counts[i.status] != null) counts[i.status] += 1;
  });
  return { total: items.length, counts, updatedAt: readDoc().updatedAt };
}

module.exports = {
  DATA_PATH,
  readDoc,
  writeDoc,
  listByStatus,
  getById,
  addPending,
  markStatus,
  upsertItem,
  appendLog,
  summary
};
