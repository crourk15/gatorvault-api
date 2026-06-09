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

module.exports = {
  commitPlayerId,
  commitSchool,
  commitDateKey,
  commitFingerprint,
  feedDedupeKeyForCommit
};
