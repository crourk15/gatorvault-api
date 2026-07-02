const path = require('path');
const scoutingDb = require('../scouting-database');
const { intelFingerprint } = require('../commit-fingerprint');
const { DATA_DIR, readJson, writeJson, SITE_URL } = require('./discovery-core');
const SCOUTING_CURSOR_PATH = path.join(DATA_DIR, 'autoposter-scouting-cursor.json');
const UPDATE_LOG_PATH = path.join(__dirname, '..', '..', 'data', 'war-room', 'scouting-update-log.json');
function consumeScoutingUpdateEntries(limit = 6) {
  const log = readJson(UPDATE_LOG_PATH, { entries: [] });
  const cursor = readJson(SCOUTING_CURSOR_PATH, { consumedKeys: {} });
  const out = [];
  for (const entry of log.entries || []) {
    if (out.length >= limit) break;
    if (!entry?.updatesAdded || entry.updatesAdded <= 0 || !entry.playerSlug) continue;
    const key = entry.playerSlug + '|' + entry.at;
    if (cursor.consumedKeys[key]) continue;
    out.push(entry); cursor.consumedKeys[key] = new Date().toISOString();
  }
  writeJson(SCOUTING_CURSOR_PATH, cursor);
  return out;
}
async function buildScoutingUpdateCandidate(entry) {
  const dbEntry = scoutingDb.getEntryBySlug(entry.playerSlug);
  const latest = dbEntry?.updates?.[0];
  const snippet = String(latest?.content || dbEntry?.scoutingSummary || '').trim();
  if (!snippet || snippet.length < 40) return null;
  const identity = entry.playerName + (entry.playerType === 'roster' ? ' (Florida)' : '');
  const analyst = entry.analystName || latest?.analystName || 'Verified analyst';
  const updateType = latest?.type || 'Evaluation';
  const contextLine = 'GV Scout Update — new ' + updateType + ' from ' + analyst + '.';
  const insiderLine = snippet.split(/(?<=[.!?])\s+/)[0].slice(0, 140);
  const url = entry.sourceUrl || latest?.sourceUrl || SITE_URL + '/vault/scouting';
  return { text: [identity, contextLine, insiderLine, url].join('\n'), category: 'news', topic: entry.playerType === 'roster' ? 'team' : 'recruiting', urgencyLabel: 'analysis', sourceEventType: 'scouting_update', sources: [{ label: analyst, url }], source: 'auto:scouting-update', intelFingerprint: intelFingerprint(entry.playerSlug, 'scouting_update', entry.at), playerName: entry.playerName, playerSlug: entry.playerSlug, sourceEventCreatedAt: entry.at || new Date().toISOString(), identityConfirmed: true, validationMeta: { eliteCompose: true, scoutingUpdate: true, updateType }, templateBlocks: { identity, context: contextLine, insider: insiderLine } };
}
async function collectScoutingUpdateCandidates() {
  if (process.env.X_AUTOPOST_SCOUTING_UPDATES === 'false') return [];
  const candidates = [];
  for (const entry of consumeScoutingUpdateEntries()) { const row = await buildScoutingUpdateCandidate(entry); if (row) candidates.push(row); }
  return candidates;
}
module.exports = { SCOUTING_CURSOR_PATH, collectScoutingUpdateCandidates };
