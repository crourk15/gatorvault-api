/** Phase 3 — curated UF football evergreen posts. */
const { intelFingerprint, stableIntelFingerprint } = require('../commit-fingerprint');
const { readJson, writeJson, SITE_URL } = require('./discovery-core');
const EVERGREEN_PATH = require('path').join(require('path').join(__dirname, '..', '..', 'data', 'x'), 'autoposter-evergreen.json');
const SNAPSHOT_PATH = require('path').join(require('path').join(__dirname, '..', '..', 'data', 'x'), 'autoposter-evergreen-snapshot.json');
function evergreenEnabled() { return process.env.X_AUTOPOST_EVERGREEN_ENABLED !== 'false'; }
function defaultLibrary() { return { version: 1, items: [
  { id: 'swamp-history', topic: 'program', angle: 'history', headline: 'The Swamp — one of college football\'s loudest venues.', context: 'Ben Hill Griffin Stadium has anchored Florida football since 1930 — a home-field edge SEC foes respect.', sourceUrl: 'https://floridagators.com/sports/football' },
  { id: 'uf-hof', topic: 'program', angle: 'hall_of_fame', headline: 'Florida football Hall of Fame tradition runs deep.', context: 'Legends built this program — roster and recruiting still writing the next chapter.', sourceUrl: 'https://floridagators.com/sports/football' },
  { id: 'futurecast-lab', topic: 'recruiting', angle: 'analysis', headline: 'FutureCast Lab — UF probability, movement, and fit scores.', context: 'GatorVault models commit likelihood and 7-day RPM movement for every top target.', sourceUrl: 'https://gatorvaultinsider.com/vault/futurecast' },
  { id: 'depth-chart', topic: 'team', angle: 'roster', headline: 'Depth chart intel — spring moves matter for fall.', context: 'Position battles and returns shape the roster — GatorVault tracks Florida live.', sourceUrl: 'https://gatorvaultinsider.com/vault/depth-chart' },
  { id: 'scout-db', topic: 'recruiting', angle: 'scouting', headline: 'GV Scout Database — verified reads on targets and roster.', context: 'Analyst evaluations feed the board — context rankings alone cannot provide.', sourceUrl: 'https://gatorvaultinsider.com/vault/scouting' },
  { id: 'game-week', topic: 'team', angle: 'schedule', headline: 'Game Week — schedule, spreads, and matchup intel.', context: 'Every Florida matchup with lines and context as the season approaches.', sourceUrl: 'https://gatorvaultinsider.com/vault/game-week' },
  { id: 'portal-watch', topic: 'portal', angle: 'portal', headline: 'Portal intel — who fits Florida\'s roster plan.', context: 'Transfer movement is roster construction — GatorVault tracks portal likelihood and UF fit.', sourceUrl: 'https://gatorvaultinsider.com/vault/portal' },
]}; }
function loadLibrary() { const doc = readJson(EVERGREEN_PATH, null); if (doc && doc.items && doc.items.length) return doc; const seeded = defaultLibrary(); writeJson(EVERGREEN_PATH, seeded); return seeded; }
function buildEvergreenCandidate(item) {
  if (!item || !item.headline) return null;
  const identity = 'Florida Gators Football';
  const text = [identity, item.headline, item.context, item.sourceUrl || SITE_URL].join('\n');
  return { text, category: 'news', topic: item.topic || 'program', urgencyLabel: 'analysis', sourceEventType: 'evergreen', triggerType: item.topic === 'program' ? 'program_news' : item.topic === 'team' ? 'team_event' : null, programNewsType: item.angle === 'hall_of_fame' ? 'hall_of_fame' : item.angle === 'history' ? 'history' : 'program_update', sources: [{ label: 'GatorVault', url: item.sourceUrl || SITE_URL }], source: 'auto:evergreen', intelFingerprint: stableIntelFingerprint(item.id, 'evergreen'), sourceEventCreatedAt: new Date().toISOString(), identityConfirmed: true, validationMeta: { programNews: true, evergreen: true, eliteCompose: true, angle: item.angle }, templateBlocks: { identity, context: item.headline, insider: item.context } };
}
function collectEvergreenCandidates(opts) { opts = opts || {}; if (!evergreenEnabled()) return []; const lib = loadLibrary(); const snapshot = readJson(SNAPSHOT_PATH, { posted: {} }); const out = []; for (const item of lib.items || []) { if (out.length >= (opts.limit || 4)) break; if (!opts.forcePost && snapshot.posted[item.id]) continue; const row = buildEvergreenCandidate(item); if (row) { out.push(row); snapshot.posted[item.id] = new Date().toISOString(); } } if (out.length) writeJson(SNAPSHOT_PATH, snapshot); return out; }
module.exports = { evergreenEnabled, collectEvergreenCandidates, buildEvergreenCandidate };
