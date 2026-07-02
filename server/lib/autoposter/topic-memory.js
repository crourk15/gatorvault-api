/** Phase 3 — player + situation + angle cooldown. */
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./discovery-core');
const TOPIC_PATH = path.join(DATA_DIR, 'autoposter-topic-memory.json');
const TOPIC_WINDOW_MS = parseInt(process.env.X_AUTOPOST_TOPIC_MEMORY_MS || String(48 * 60 * 60 * 1000), 10);
function topicMemoryEnabled() { return process.env.X_AUTOPOST_TOPIC_MEMORY !== 'false'; }
function normalizeSlug(raw) { return String(raw || '').trim().toLowerCase(); }
function extractTopicAngle(c) { const m = (c && c.validationMeta) || {}; return String(m.angle || m.updateType || m.ladderAngle || c.programNewsType || c.teamEventType || c.sourceEventType || c.source || 'general').toLowerCase(); }
function extractSituation(c) { return require('./story-memory').normalizeStoryArc(c); }
function topicKey(c) { const slug = normalizeSlug(c && c.playerSlug); const s = extractSituation(c); const a = extractTopicAngle(c); return slug ? slug + '|' + s + '|' + a : 'program|' + s + '|' + a; }
function readStore() { try { return JSON.parse(fs.readFileSync(TOPIC_PATH, 'utf8')); } catch { return { entries: [] }; } }
function writeStore(doc) { fs.mkdirSync(path.dirname(TOPIC_PATH), { recursive: true }); doc.updatedAt = new Date().toISOString(); fs.writeFileSync(TOPIC_PATH, JSON.stringify(doc, null, 2), 'utf8'); }
function hasRecentTopicAngle(c) {
  if (!topicMemoryEnabled()) return { hit: false };
  const key = topicKey(c);
  const cutoff = Date.now() - TOPIC_WINDOW_MS;
  for (const e of readStore().entries || []) {
    if (e.topicKey === key && new Date(e.usedAt || 0).getTime() >= cutoff) return { hit: true, reason: 'topic_angle', topicKey: key };
  }
  return { hit: false, topicKey: key };
}
function recordTopicUsage(item) {
  if (!topicMemoryEnabled() || !item) return null;
  const row = { topicKey: topicKey(item), playerSlug: normalizeSlug(item.playerSlug), situation: extractSituation(item), angle: extractTopicAngle(item), usedAt: item.sentAt || new Date().toISOString() };
  const doc = readStore();
  doc.entries = [row, ...(doc.entries || [])].filter((e) => new Date(e.usedAt || 0).getTime() >= Date.now() - TOPIC_WINDOW_MS).slice(0, 500);
  writeStore(doc);
  return row;
}
function listRecentAnglesForPlayer(slug, situation) {
  const s = normalizeSlug(slug);
  const cutoff = Date.now() - TOPIC_WINDOW_MS;
  return (readStore().entries || []).filter((e) => s && String(e.topicKey || '').startsWith(s + '|') && (!situation || e.situation === situation) && new Date(e.usedAt || 0).getTime() >= cutoff).map((e) => e.angle);
}
function getTopicMemorySummary() {
  const entries = readStore().entries || [];
  return { enabled: topicMemoryEnabled(), recentCount: entries.length, windowMs: TOPIC_WINDOW_MS };
}
module.exports = { topicMemoryEnabled, extractTopicAngle, topicKey, hasRecentTopicAngle, recordTopicUsage, listRecentAnglesForPlayer, getTopicMemorySummary };
