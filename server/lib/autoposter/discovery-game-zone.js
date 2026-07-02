const path = require('path');
const { intelFingerprint } = require('../commit-fingerprint');
const { DATA_DIR, readJson, writeJson, newsCandidateFromBuilt, SITE_URL } = require('./discovery-core');
const GAME_WEEK_SNAPSHOT_PATH = path.join(DATA_DIR, 'game-week-autopost-snapshot.json');
async function collectGameZoneCandidates() {
  if (process.env.X_AUTOPOST_GAME_ZONE_DISCOVERY === 'false') return [];
  let schedule = [];
  try { const bettingLines = require('../betting-lines'); const meta = bettingLines.getLinesMeta(); schedule = meta?.schedule || bettingLines.STATIC_LINES || []; } catch { return []; }
  const now = Date.now();
  const horizonMs = parseInt(process.env.X_AUTOPOST_GAME_WEEK_HORIZON_MS || String(21 * 24 * 60 * 60 * 1000), 10);
  const upcoming = schedule.filter((g) => { const t = new Date(g.date).getTime(); return Number.isFinite(t) && t > now && t - now <= horizonMs; }).sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  if (!upcoming?.id) return [];
  const snapshot = readJson(GAME_WEEK_SNAPSHOT_PATH, { posted: {} });
  const snapKey = upcoming.id + ':' + String(upcoming.date || '').slice(0, 10);
  if (snapshot.posted[snapKey]) return [];
  const copy = require('../x-autoposter-copy');
  const built = copy.buildTeamEventCopyFromSchedule(upcoming);
  if (!built?.text) return [];
  const spreadLine = upcoming.spread?.line ? ' Line: ' + upcoming.spread.line + '.' : '';
  const enhanced = { ...built, text: (built.text.replace(/\.\s*$/, '') + '.' + spreadLine).trim() };
  snapshot.posted[snapKey] = new Date().toISOString(); writeJson(GAME_WEEK_SNAPSHOT_PATH, snapshot);
  return [newsCandidateFromBuilt(enhanced, { topic: 'team', urgencyLabel: 'major_beat', triggerType: 'team_event', teamEventType: 'schedule', sourceEventType: 'game_week', sources: [{ label: 'GatorVault Game Week', url: SITE_URL + '/vault/game-week' }], source: 'auto:game-zone', intelFingerprint: intelFingerprint(upcoming.id, 'game_week_preview', upcoming.date), sourceEventCreatedAt: new Date().toISOString(), identityConfirmed: true })];
}
module.exports = { GAME_WEEK_SNAPSHOT_PATH, collectGameZoneCandidates };
