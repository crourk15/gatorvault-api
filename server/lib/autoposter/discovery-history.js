/** Phase 5 — program history + on-this-day milestones. */
const path = require('path');
const { intelFingerprint } = require('../commit-fingerprint');
const { readJson, writeJson, SITE_URL, DATA_DIR } = require('./discovery-core');
const HISTORY_PATH = path.join(DATA_DIR, 'autoposter-history-library.json');
const SNAPSHOT_PATH = path.join(DATA_DIR, 'autoposter-history-snapshot.json');
function historyDiscoveryEnabled() { return process.env.X_AUTOPOST_HISTORY_DISCOVERY !== 'false'; }
function defaultLibrary() { return { version: 1, items: [
  { id: 'swamp-1930', month: 11, day: 4, headline: 'On this day — Ben Hill Griffin Stadium legacy began.', context: 'The Swamp remains one of college football\'s toughest home environments.', angle: 'history' },
  { id: 'sec-championship-culture', month: 12, day: 7, headline: 'Championship standard — Florida built modern SEC success on roster depth.', context: 'Program history still shapes how recruits view the Gators.', angle: 'history' },
  { id: 'spring-practice', month: 3, day: 15, headline: 'Spring football matters — depth chart intel starts here.', context: 'GatorVault tracks roster movement from spring through fall.', angle: 'program' },
  { id: 'hof-tradition', headline: 'Florida football Hall of Fame tradition runs deep.', context: 'Legends built this program — the roster keeps writing the next chapter.', angle: 'hall_of_fame' },
  { id: 'gator-nation', headline: 'Gator Nation spans coast to coast — recruiting footprint is national.', context: 'FutureCast tracks UF probability and movement for every priority target.', angle: 'program' },
]}; }
function loadLibrary() { const doc = readJson(HISTORY_PATH, null); if (doc && doc.items && doc.items.length) return doc; const seeded = defaultLibrary(); writeJson(HISTORY_PATH, seeded); return seeded; }
function todayKey(date) { date = date || new Date(); return (date.getMonth() + 1) + '-' + date.getDate(); }
function buildHistoryCandidate(item) {
  if (!item || !item.headline) return null;
  const identity = 'Florida Gators Football';
  const text = [identity, item.headline, item.context, item.sourceUrl || SITE_URL].join('\n');
  return { text, category: 'news', topic: 'program', urgencyLabel: 'analysis', sourceEventType: 'program_history', triggerType: 'program_news', programNewsType: item.angle === 'hall_of_fame' ? 'hall_of_fame' : item.angle === 'history' ? 'history' : 'program_update', sources: [{ label: 'GatorVault', url: item.sourceUrl || SITE_URL }], source: 'auto:program-history', intelFingerprint: intelFingerprint(item.id, 'history', todayKey()), sourceEventCreatedAt: new Date().toISOString(), identityConfirmed: true, validationMeta: { programNews: true, history: true, eliteCompose: true, angle: item.angle }, templateBlocks: { identity, context: item.headline, insider: item.context } };
}
function collectHistoryCandidates(opts) {
  opts = opts || {}; if (!historyDiscoveryEnabled()) return [];
  const lib = loadLibrary(); const snapshot = readJson(SNAPSHOT_PATH, { posted: {} }); const out = [];
  const now = new Date(); const m = now.getMonth() + 1; const d = now.getDate();
  const dated = (lib.items || []).filter((item) => item.month === m && item.day === d);
  const pool = dated.length ? dated : (lib.items || []).filter((item) => !item.month);
  for (const item of pool) { if (out.length >= (opts.limit || 2)) break; if (snapshot.posted[item.id]) continue; const row = buildHistoryCandidate(item); if (row) { out.push(row); snapshot.posted[item.id] = new Date().toISOString(); } }
  if (out.length) writeJson(SNAPSHOT_PATH, snapshot); return out;
}
module.exports = { historyDiscoveryEnabled, collectHistoryCandidates, buildHistoryCandidate };
