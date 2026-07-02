const path = require('path');
const rosterStore = require('../roster-store');
const { intelFingerprint } = require('../commit-fingerprint');
const { DATA_DIR, readJson, writeJson, newsCandidateFromBuilt, SITE_URL } = require('./discovery-core');
const ROSTER_SNAPSHOT_PATH = path.join(DATA_DIR, 'roster-delta-snapshot.json');
const ROSTER_PENDING_PATH = path.join(DATA_DIR, 'roster-delta-pending.json');
function rosterPlayerSnap(p) { return { depthChartTier: p.depthChartTier || null, pos: p.pos || p.position || null, injury: p.injury || null, jersey: p.jersey || null, unit: p.unit || null, name: p.name || null }; }
function scanRosterDeltas() {
  const players = rosterStore.getAllRosterPlayers();
  const prev = readJson(ROSTER_SNAPSHOT_PATH, { initialized: false, players: {} });
  const events = [];
  const next = { initialized: true, players: {}, updatedAt: new Date().toISOString() };
  for (const p of players) {
    if (!p?.slug) continue;
    next.players[p.slug] = rosterPlayerSnap(p);
    if (!prev.initialized) continue;
    const old = prev.players[p.slug];
    if (!old) continue;
    if (p.injury && String(p.injury) !== String(old.injury || '')) events.push({ rosterEventType: 'injury', player: p, at: next.updatedAt });
    if (p.depthChartTier && String(p.depthChartTier) !== String(old.depthChartTier || '')) events.push({ rosterEventType: 'depth_chart', player: p, previous: old.depthChartTier, current: p.depthChartTier, at: next.updatedAt });
    if (p.pos && old.pos && String(p.pos).toUpperCase() !== String(old.pos).toUpperCase()) events.push({ rosterEventType: 'position_change', player: p, previous: old.pos, current: p.pos, at: next.updatedAt });
  }
  writeJson(ROSTER_SNAPSHOT_PATH, next);
  if (events.length) { const pending = readJson(ROSTER_PENDING_PATH, { events: [] }); pending.events = [...events, ...(pending.events || [])].slice(0, 40); pending.updatedAt = next.updatedAt; writeJson(ROSTER_PENDING_PATH, pending); }
  return events.length;
}
function consumePendingRosterEvents() {
  const pending = readJson(ROSTER_PENDING_PATH, { events: [] });
  const events = Array.isArray(pending.events) ? pending.events : [];
  if (!events.length) return [];
  writeJson(ROSTER_PENDING_PATH, { events: [], updatedAt: new Date().toISOString() });
  return events;
}
async function buildNewsFromRosterEvent(event) {
  const p = event.player || {};
  const name = p.name || 'Florida Gator';
  const pos = p.pos || p.position || '';
  let beatText = '', teamEventType = event.rosterEventType || 'roster';
  if (event.rosterEventType === 'depth_chart') beatText = name + (pos ? ' (' + pos + ')' : '') + ' moves to ' + event.current + ' on the Florida depth chart.';
  else if (event.rosterEventType === 'injury') beatText = name + (pos ? ' (' + pos + ')' : '') + ' injury update on the Florida roster.';
  else if (event.rosterEventType === 'position_change') beatText = name + ' listed at ' + event.current + ' on the updated Florida roster.';
  else return null;
  const playerContext = require('../x-autoposter-player-context');
  const built = playerContext.buildTeamEventPost({ beatText, source: 'GatorVault Roster', teamEventType, postUrl: SITE_URL + '/vault/depth-chart' });
  return newsCandidateFromBuilt(built, { topic: 'team', urgencyLabel: teamEventType === 'injury' ? 'breaking' : 'major_beat', postUrgency: teamEventType === 'injury' ? 'breaking' : null, triggerType: 'team_event', teamEventType, sourceEventType: 'roster_delta', sources: [{ label: 'GatorVault Roster', url: SITE_URL + '/vault/depth-chart' }], source: 'auto:roster-delta', intelFingerprint: intelFingerprint(p.slug, 'roster_' + teamEventType, event.at), playerName: name, playerSlug: p.slug, sourceEventCreatedAt: event.at, identityConfirmed: true });
}
async function collectRosterDeltaCandidates() {
  if (process.env.X_AUTOPOST_ROSTER_DELTA === 'false') return [];
  try { scanRosterDeltas(); } catch (err) { console.warn('[discovery] roster scan failed:', err.message); }
  const candidates = [];
  for (const event of consumePendingRosterEvents().slice(0, 4)) { const row = await buildNewsFromRosterEvent(event); if (row) candidates.push(row); }
  return candidates;
}
module.exports = { ROSTER_SNAPSHOT_PATH, scanRosterDeltas, consumePendingRosterEvents, buildNewsFromRosterEvent, collectRosterDeltaCandidates };
