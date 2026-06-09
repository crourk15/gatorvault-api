/**
 * Stable commit dedupe key: player_id + commit_school + commit_date
 */
function commitPlayerId(player) {
  if (!player) return '';
  return String(player.on3Id || player.id || player.slug || '').trim();
}

function commitSchool(player) {
  return String(player.committedTo || player.commitSchool || 'Florida')
    .trim()
    .toLowerCase();
}

function commitDateKey(player) {
  const raw = player?.commitDate || player?.commit_date || '';
  if (!raw) return '';
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return String(raw).trim().slice(0, 10);
}

function commitFingerprint(player) {
  const playerId = commitPlayerId(player);
  const school = commitSchool(player);
  const date = commitDateKey(player);
  if (!playerId) return null;
  return `${playerId}|${school}|${date}`;
}

function feedDedupeKeyForCommit(playerOrSlug, player) {
  const fp = commitFingerprint(player || { slug: playerOrSlug });
  if (fp) return `commit:${fp}`;
  if (playerOrSlug) return `commit:${playerOrSlug}`;
  return null;
}

/** Normalize timestamp to day precision for intel dedupe keys. */
function normalizeIntelTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return String(ts).trim().slice(0, 10);
}

/** General intel dedupe: player_id + event_type + timestamp */
function intelFingerprint(playerId, eventType, timestamp) {
  const id = String(playerId || '').trim();
  const et = String(eventType || '').trim().toLowerCase();
  const ts = normalizeIntelTimestamp(timestamp);
  if (!id || !et) return null;
  return `${id}|${et}|${ts}`;
}

function feedDedupeKeyForIntel(intel) {
  const fp = intelFingerprint(intel.playerId, intel.eventType, intel.timestamp || intel.reportedAt);
  if (fp) return `intel:${fp}`;
  if (intel.id) return `intel:${intel.id}`;
  return null;
}

module.exports = {
  commitPlayerId,
  commitSchool,
  commitDateKey,
  commitFingerprint,
  feedDedupeKeyForCommit,
  normalizeIntelTimestamp,
  intelFingerprint,
  feedDedupeKeyForIntel
};
