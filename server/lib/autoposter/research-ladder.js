/** Phase 3/5 — dig deeper when gates block enqueue (scouting → article → research → evergreen). */
const { SITE_URL } = require('./discovery-core');
const { intelFingerprint } = require('../commit-fingerprint');
function ladderEnabled() { return process.env.X_AUTOPOST_RESEARCH_LADDER !== 'false'; }
const ANGLES = ['fit_analysis', 'visit_intel', 'competition', 'scheme_fit', 'momentum'];
function pickAngle(used) { const set = new Set((used || []).map(String)); for (const a of ANGLES) { if (!set.has(a)) return a; } return ANGLES[0]; }
async function buildScoutingLadderCandidate(raw) {
  const slug = raw && raw.playerSlug; if (!slug) return null;
  try {
    const entry = require('../scouting-database').getEntryBySlug(slug);
    if (!entry || !entry.scoutingSummary) return null;
    const identity = raw.playerName || entry.playerName || 'Florida target';
    const contextLine = 'GV Scout read — verified evaluation on the Florida board.';
    const insider = String(entry.scoutingSummary).trim().slice(0, 140);
    const url = SITE_URL + '/vault/scouting';
    const text = [identity, contextLine, insider, url].join('\n');
    return Object.assign({}, raw, { text, source: 'auto:research-ladder', intelFingerprint: intelFingerprint(slug, 'ladder_scout', new Date().toISOString().slice(0, 10)), validationMeta: Object.assign({}, raw.validationMeta || {}, { eliteCompose: true, ladderAngle: 'scouting', researchLadder: true }), templateBlocks: { identity, context: contextLine, insider } });
  } catch { return null; }
}
async function buildArticleLadderCandidate(raw) {
  try {
    const fill = require('../x-autoposter-fill');
    const slug = raw && raw.playerSlug; const name = raw && raw.playerName;
    for (const row of fill.collectArticlePostCandidates({ limit: 8, forcePost: true })) {
      if (slug && row.playerSlug && row.playerSlug !== slug) continue;
      if (!slug && name && row.playerName && row.playerName !== name) continue;
      if (row && row.text) return Object.assign({}, raw, row, { source: 'auto:research-ladder', validationMeta: Object.assign({}, row.validationMeta || {}, { researchLadder: true, ladderAngle: 'article' }) });
    }
  } catch { /* optional */ }
  return null;
}
async function buildResearchLadderCandidate(raw, reason) {
  if (!ladderEnabled() || !raw) return null;
  if (!['gm2_filter', 'quality_gate', 'policy', 'topic_angle'].includes(reason)) return null;
  const slug = raw.playerSlug; const name = raw.playerName;
  if (slug || name) {
    const scout = await buildScoutingLadderCandidate(raw); if (scout) return scout;
    const article = await buildArticleLadderCandidate(raw); if (article) return article;
    const topicMemory = require('./topic-memory');
    const story = require('./story-memory');
    const angle = pickAngle(topicMemory.listRecentAnglesForPlayer(slug || name, story.normalizeStoryArc(raw)));
    let insider = '';
    try { const research = require('../x-autoposter-elite-research'); const pack = await research.researchUpdate({ playerSlug: slug, playerName: name, beatText: raw.text || '', eventType: raw.sourceEventType || 'recruiting' }); insider = String(pack && pack.insiderLine || pack && pack.contextLine || '').trim(); } catch {}
    const identity = name || 'Florida target';
    const contextLine = 'GatorVault dig-deeper — ' + angle.replace(/_/g, ' ') + ' on the Florida board.';
    const url = slug ? SITE_URL + '/vault/futurecast/player/' + slug : SITE_URL;
    const text = [identity, contextLine, insider || 'Full intel on FutureCast.', url].join('\n');
    return Object.assign({}, raw, { text, source: 'auto:research-ladder', intelFingerprint: intelFingerprint(slug || name, 'ladder_' + angle, new Date().toISOString().slice(0, 10)), validationMeta: Object.assign({}, raw.validationMeta || {}, { eliteCompose: true, ladderAngle: angle, researchLadder: true }), templateBlocks: { identity, context: contextLine, insider: insider || 'Full intel on FutureCast.' } });
  }
  if (reason === 'quality_gate' || reason === 'gm2_filter') {
    const rows = require('./evergreen-library').collectEvergreenCandidates({ limit: 1, forcePost: true });
    if (rows[0]) return rows[0];
  }
  return null;
}
async function buildAlternateFromResearch(item) { return buildResearchLadderCandidate(item, 'quality_gate'); }
module.exports = { ladderEnabled, buildResearchLadderCandidate, buildAlternateFromResearch, buildScoutingLadderCandidate, buildArticleLadderCandidate };
