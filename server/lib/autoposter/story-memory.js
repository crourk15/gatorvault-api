/** Phase 3 — 7-day story-unit dedupe. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('./discovery-core');
const STORY_PATH = path.join(DATA_DIR, 'autoposter-story-memory.json');
const STORY_WINDOW_MS = parseInt(process.env.X_AUTOPOST_STORY_WINDOW_MS || String(7 * 24 * 60 * 60 * 1000), 10);
function storyMemoryEnabled() { return process.env.X_AUTOPOST_STORY_MEMORY !== 'false'; }
function normalizeSlug(raw) { return String(raw || '').trim().toLowerCase(); }
function headlineHash(text) { return crypto.createHash('sha256').update(String(text || '').trim().toLowerCase().slice(0, 120)).digest('hex').slice(0, 12); }
function normalizeStoryArc(c) {
  c = c || {};
  if (c.situation) return String(c.situation).toLowerCase();
  if (c.programNewsType) return 'program:' + c.programNewsType;
  if (c.teamEventType) return 'team:' + c.teamEventType;
  const et = String(c.sourceEventType || c.eventType || '').toLowerCase();
  if (et) return et;
  const text = (c.playerName || '') + ' ' + (c.text || '');
  if (/commit|flip|pledge/i.test(text)) return 'commitment';
  if (/portal|transfer/i.test(text)) return 'portal';
  if (/\b(ov|uv|visit)\b/i.test(text)) return 'visit';
  if (/offer/i.test(text)) return 'offer';
  if (/depth chart|injury|roster/i.test(text)) return 'roster';
  if (/hall of fame|hof/i.test(text)) return 'hall_of_fame';
  return 'general';
}
function computeStoryUnitKey(c) {
  if (!c) return null;
  const arc = normalizeStoryArc(c);
  const slug = normalizeSlug(c.playerSlug || c.playerName);
  if (slug) return slug + '|' + arc;
  const headline = (c.validationMeta && c.validationMeta.officialHeadline) || String(c.text || '').split('\n')[0] || '';
  if (c.programNewsType) return 'program|' + c.programNewsType + '|' + headlineHash(headline);
  return 'story|' + arc + '|' + headlineHash(headline);
}
function readStore() { try { return JSON.parse(fs.readFileSync(STORY_PATH, 'utf8')); } catch { return { entries: [] }; } }
function writeStore(doc) { fs.mkdirSync(path.dirname(STORY_PATH), { recursive: true }); doc.updatedAt = new Date().toISOString(); fs.writeFileSync(STORY_PATH, JSON.stringify(doc, null, 2), 'utf8'); }
function hasRecentStoryUnit(c) {
  if (!storyMemoryEnabled()) return { hit: false };
  const key = computeStoryUnitKey(c);
  if (!key) return { hit: false };
  const cutoff = Date.now() - STORY_WINDOW_MS;
  for (const e of readStore().entries || []) {
    if (e.storyUnitKey !== key) continue;
    if (new Date(e.postedAt || 0).getTime() >= cutoff) return { hit: true, reason: 'story_unit', storyUnitKey: key };
  }
  return { hit: false, storyUnitKey: key };
}
function recordStoryUnit(item) {
  if (!storyMemoryEnabled() || !item) return null;
  const key = computeStoryUnitKey(item);
  if (!key) return null;
  const row = { storyUnitKey: key, storyArc: normalizeStoryArc(item), playerSlug: normalizeSlug(item.playerSlug), source: item.source, tweetId: item.tweetId, postedAt: item.sentAt || new Date().toISOString() };
  const doc = readStore();
  doc.entries = [row, ...(doc.entries || [])].filter((e) => new Date(e.postedAt || 0).getTime() >= Date.now() - STORY_WINDOW_MS).slice(0, 400);
  writeStore(doc);
  return row;
}
function clearStoryUnitsForPlayer(slug, { storyArc = null } = {}) {
  const key = normalizeSlug(slug);
  if (!key) return 0;
  const doc = readStore();
  const before = (doc.entries || []).length;
  doc.entries = (doc.entries || []).filter((entry) => {
    const unitKey = String(entry.storyUnitKey || '');
    if (storyArc) return unitKey !== `${key}|${storyArc}`;
    return !unitKey.startsWith(`${key}|`);
  });
  if (doc.entries.length !== before) writeStore(doc);
  return before - doc.entries.length;
}

function getStoryMemorySummary() {
  const entries = readStore().entries || [];
  return { enabled: storyMemoryEnabled(), recentCount: entries.length, windowMs: STORY_WINDOW_MS };
}
module.exports = {
  storyMemoryEnabled,
  normalizeStoryArc,
  computeStoryUnitKey,
  hasRecentStoryUnit,
  recordStoryUnit,
  clearStoryUnitsForPlayer,
  getStoryMemorySummary
};
