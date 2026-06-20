/**
 * Protected recruiting records — must never be removed by cleanup or ingest demotion.
 */
const { looksLikeFloridaCommit } = require('./recruiting-verified-commits');

function isProtectedRecord(record) {
  return record?.protected === true;
}

function isCommitEvent(evt) {
  const type = String(evt?.eventType || '').toLowerCase();
  return type === 'commit' || type === 'decommit' || type.includes('commit');
}

function markPlayerProtected(player) {
  if (!player) return player;
  if (looksLikeFloridaCommit(player)) {
    return { ...player, protected: true };
  }
  if (player.protected === true) return player;
  return player;
}

function markCommitEventProtected(evt) {
  if (!evt || !isCommitEvent(evt)) return evt;
  return { ...evt, protected: true };
}

function markAllCommitPlayersProtected(players) {
  return (players || []).map(markPlayerProtected);
}

function markAllCommitEventsProtected(events) {
  return (events || []).map(markCommitEventProtected);
}

module.exports = {
  isProtectedRecord,
  isCommitEvent,
  markPlayerProtected,
  markCommitEventProtected,
  markAllCommitPlayersProtected,
  markAllCommitEventsProtected,
};
