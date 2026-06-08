const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { slugify } = require('./slug');

const DATA_DIR = path.join(__dirname, '..', 'data', 'media-ingest');
const SERVER_ROOT = path.join(__dirname, '..');
const SOURCES_PATH = path.join(DATA_DIR, 'sources.json');
const QUEUE_PATH = path.join(DATA_DIR, 'queue.json');
const SEEN_PATH = path.join(DATA_DIR, 'seen.json');
const LOG_PATH = path.join(DATA_DIR, 'log.json');
const HIGHLIGHTS_PATH = path.join(__dirname, '..', 'data', 'highlights', 'clips.json');
const INTERVIEWS_PATH = path.join(__dirname, '..', 'data', 'interviews', 'clips.json');

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

function hashId(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex').slice(0, 16);
}

function loadSources() {
  const cfg = readJson(SOURCES_PATH, { sources: [] });
  return (cfg.sources || []).filter((s) => s.enabled !== false);
}

function loadAllSources() {
  return readJson(SOURCES_PATH, { sources: [] }).sources || [];
}

function loadQueue() {
  return readJson(QUEUE_PATH, []);
}

function saveQueue(queue) {
  writeJson(QUEUE_PATH, queue);
}

function loadSeen() {
  return readJson(SEEN_PATH, []);
}

function saveSeen(seen) {
  writeJson(SEEN_PATH, seen.slice(-5000));
}

function isSeen(id) {
  return loadSeen().includes(id);
}

function markSeen(id) {
  const seen = loadSeen();
  if (!seen.includes(id)) {
    seen.push(id);
    saveSeen(seen);
  }
}

function pushLog(entry) {
  const log = readJson(LOG_PATH, []);
  log.unshift({ ts: new Date().toISOString(), ...entry });
  writeJson(LOG_PATH, log.slice(0, 200));
}

function upsertQueueItem(item) {
  const queue = loadQueue();
  const idx = queue.findIndex((q) => q.id === item.id);
  if (idx >= 0) queue[idx] = { ...queue[idx], ...item };
  else queue.push(item);
  saveQueue(queue);
  return item;
}

function updateQueueItem(id, patch) {
  const queue = loadQueue();
  const idx = queue.findIndex((q) => q.id === id);
  if (idx < 0) return null;
  queue[idx] = { ...queue[idx], ...patch, updatedAt: new Date().toISOString() };
  saveQueue(queue);
  return queue[idx];
}

function resolveServerPath(rel) {
  return path.join(SERVER_ROOT, String(rel).replace(/^\//, ''));
}

function uniqueSlug(base, existingSlugs) {
  let slug = slugify(base);
  if (!existingSlugs.has(slug)) return slug;
  let i = 2;
  while (existingSlugs.has(`${slug}-${i}`)) i += 1;
  return `${slug}-${i}`;
}

function loadHighlightSlugs() {
  return new Set(readJson(HIGHLIGHTS_PATH, []).map((c) => c.slug));
}

function loadInterviewSlugs() {
  return new Set(readJson(INTERVIEWS_PATH, []).map((c) => c.slug));
}

function appendHighlight(clip) {
  const clips = readJson(HIGHLIGHTS_PATH, []);
  const idx = clips.findIndex((c) => c.slug === clip.slug || c.ingestId === clip.ingestId);
  if (idx >= 0) clips[idx] = { ...clips[idx], ...clip, updatedAt: new Date().toISOString() };
  else clips.push({ ...clip, publishedAt: clip.publishedAt || new Date().toISOString() });
  writeJson(HIGHLIGHTS_PATH, clips);
  return clip;
}

function appendInterview(clip) {
  const clips = readJson(INTERVIEWS_PATH, []);
  const idx = clips.findIndex((c) => c.slug === clip.slug || c.ingestId === clip.ingestId);
  if (idx >= 0) clips[idx] = { ...clips[idx], ...clip, updatedAt: new Date().toISOString() };
  else clips.push({ ...clip, publishedAt: clip.publishedAt || new Date().toISOString() });
  writeJson(INTERVIEWS_PATH, clips);
  return clip;
}

function getIngestStatus() {
  const queue = loadQueue();
  const highlights = readJson(HIGHLIGHTS_PATH, []);
  const interviews = readJson(INTERVIEWS_PATH, []);
  const ingestedHighlights = highlights.filter((c) => c.ingestId).length;
  const ingestedInterviews = interviews.filter((c) => c.ingestId).length;
  return {
    queue: {
      total: queue.length,
      pending: queue.filter((q) => q.status === 'pending').length,
      processing: queue.filter((q) => q.status === 'processing').length,
      ready: queue.filter((q) => q.status === 'ready').length,
      failed: queue.filter((q) => q.status === 'failed').length
    },
    catalog: {
      highlights: highlights.length,
      interviews: interviews.length,
      ingestedHighlights,
      ingestedInterviews
    },
    sources: loadAllSources().map((s) => ({ id: s.id, type: s.type, kind: s.kind, enabled: !!s.enabled })),
    recentLog: readJson(LOG_PATH, []).slice(0, 20)
  };
}

module.exports = {
  DATA_DIR,
  SERVER_ROOT,
  SOURCES_PATH,
  HIGHLIGHTS_PATH,
  INTERVIEWS_PATH,
  loadSources,
  loadAllSources,
  loadQueue,
  saveQueue,
  isSeen,
  markSeen,
  pushLog,
  upsertQueueItem,
  updateQueueItem,
  hashId,
  resolveServerPath,
  uniqueSlug,
  loadHighlightSlugs,
  loadInterviewSlugs,
  appendHighlight,
  appendInterview,
  getIngestStatus,
  readJson,
  writeJson
};
