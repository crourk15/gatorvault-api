/**
 * X AutoPoster reply engine — thread replies, beat writer engagement, trending Gator tweets.
 */
const store = require('./x-autoposter-store');
const policy = require('./x-autoposter-policy');
const { getBeatPosts } = require('./live-beat');
const beatFilters = require('./beat-writer-filters');
const { intelFingerprint } = require('./commit-fingerprint');

const SITE_URL = process.env.SITE_URL || 'https://gatorvaultinsider.com';
const REPLY_ENABLED = process.env.X_AUTOPOST_REPLY_ENABLED === 'true';
const MAX_BEAT_REPLIES = parseInt(process.env.X_AUTOPOST_MAX_BEAT_REPLIES || '2', 10);

function isReplyEnabled() {
  return REPLY_ENABLED;
}

function extractTweetIdFromPost(post) {
  const url = String(post.url || '');
  const m = url.match(/status\/(\d+)/);
  if (m) return m[1];
  const id = String(post.id || '');
  if (id.startsWith('x_')) return id.slice(2);
  return null;
}

function extractPlayerFromText(text) {
  return beatFilters.extractPlayerFromText(text);
}

function isTrustedBeatPost(post) {
  if (!beatFilters.shouldIncludeBeatPost(post)) return false;
  return beatFilters.isTrustedBeatWriter(post);
}

function replyFingerprint(parentTweetId, kind) {
  return `reply:${parentTweetId}:${kind}`;
}

function replyAlreadyQueued(parentId, kind, items) {
  const fp = replyFingerprint(parentId, kind);
  return items.some(
    (i) =>
      i.action === 'reply' &&
      (i.replyFingerprint === fp ||
        (i.inReplyToStatusId === String(parentId) && i.source === `auto:reply-${kind}`)) &&
      (i.status === 'pending' || i.status === 'sent')
  );
}

function buildThreadReply(item) {
  const player = item.playerName || extractPlayerFromText(item.text);
  const text = String(item.text || '').toLowerCase();
  if (/commit|flip|decommit/.test(text) && player) {
    return `Full ${player} intel + film in the Vault 🐊 ${SITE_URL}`;
  }
  if (item.intelType === 'official_visit' && player) {
    return `${player} visit tracked live — Heat Check + recruiting board updated 🐊 ${SITE_URL}`;
  }
  if (/official visit|visit to gainesville|gainesville/.test(text)) {
    return `Visit intel live in GatorVault Heat Check 🐊 ${SITE_URL}`;
  }
  return `More Gators recruiting intel in the Vault 🐊 ${SITE_URL}`;
}

function buildBeatReply(post, context) {
  const player = context?.playerName;
  if (player) {
    const last = player.split(' ').pop().toLowerCase();
    if (!String(post.text || '').toLowerCase().includes(last)) return null;
  }
  return `Tracking in GatorVault — Heat Check updated 🐊 ${SITE_URL}`;
}

function matchesGatorRecruiting(text) {
  return beatFilters.matchesGatorFootballIntel(text);
}

function enqueueReply({ text, inReplyToStatusId, kind, item, scheduledDelayMin = 3 }) {
  const doc = store.loadQueue();
  if (replyAlreadyQueued(inReplyToStatusId, kind, doc.items)) {
    return null;
  }
  const replyText = String(text || '').trim();
  if (!replyText || replyText.length > 280) return null;

  const check = policy.validatePostContent({
    text: replyText,
    category: 'engagement',
    action: 'reply',
    sources: [{ label: 'GatorVault', url: SITE_URL }]
  });
  if (!check.valid) return null;

  const fp = replyFingerprint(inReplyToStatusId, kind);
  return store.enqueuePost({
    text: replyText,
    category: 'engagement',
    action: 'reply',
    inReplyToStatusId: String(inReplyToStatusId),
    topic: item?.topic || 'recruiting',
    sources: [{ label: 'GatorVault', url: SITE_URL }],
    source: `auto:reply-${kind}`,
    replyFingerprint: fp,
    intelFingerprint: item?.intelFingerprint || null,
    playerName: item?.playerName || null,
    scheduledAt: new Date(Date.now() + scheduledDelayMin * 60 * 1000).toISOString(),
    status: 'pending'
  });
}

async function scheduleRepliesForSentPost({ item, tweetId }) {
  if (!REPLY_ENABLED || !tweetId || item.action !== 'post') {
    return { scheduled: 0, skipped: !REPLY_ENABLED ? 'disabled' : 'not_post' };
  }

  const scheduled = [];
  const isRecruiting =
    item.topic === 'recruiting' ||
    item.intelFingerprint ||
    /commit|visit|flip|recruit|official/.test(String(item.text || '').toLowerCase());

  if (!isRecruiting) return { scheduled: 0, skipped: 'not_recruiting' };

  const threadReply = buildThreadReply(item);
  const threadOut = enqueueReply({
    text: threadReply,
    inReplyToStatusId: tweetId,
    kind: 'thread',
    item,
    scheduledDelayMin: 2
  });
  if (threadOut?.item) scheduled.push(threadOut.item);

  const playerName = item.playerName || extractPlayerFromText(item.text);
  const beat = getBeatPosts(50);
  let beatCount = 0;

  for (const post of beat.posts || []) {
    if (beatCount >= MAX_BEAT_REPLIES) break;
    if (!isTrustedBeatPost(post)) continue;
    const tid = extractTweetIdFromPost(post);
    if (!tid || tid === tweetId) continue;
    if (playerName && !String(post.text || '').toLowerCase().includes(playerName.split(' ').pop().toLowerCase())) {
      continue;
    }
    const replyText = buildBeatReply(post, { playerName });
    if (!replyText) continue;
    const out = enqueueReply({
      text: replyText,
      inReplyToStatusId: tid,
      kind: 'beat',
      item: { ...item, playerName },
      scheduledDelayMin: 4 + beatCount * 3
    });
    if (out?.item) {
      scheduled.push(out.item);
      beatCount += 1;
    }
  }

  return { scheduled: scheduled.length, items: scheduled };
}

async function scanTrendingEngagementReplies() {
  if (!REPLY_ENABLED) return { scanned: 0, queued: 0 };

  const beat = getBeatPosts(40);
  const doc = store.loadQueue();
  let queued = 0;

  for (const post of beat.posts || []) {
    if (queued >= 1) break;
    if (!isTrustedBeatPost(post)) continue;
    if (!matchesGatorRecruiting(post.text)) continue;

    const tid = extractTweetIdFromPost(post);
    if (!tid) continue;
    if (replyAlreadyQueued(tid, 'trending', doc.items)) continue;

    const ageMs = Date.now() - new Date(post.publishedAt).getTime();
    if (ageMs > 6 * 60 * 60 * 1000) continue;

    const out = enqueueReply({
      text: `On it — live in GatorVault Heat Check 🐊 ${SITE_URL}`,
      inReplyToStatusId: tid,
      kind: 'trending',
      item: { topic: 'recruiting', playerName: extractPlayerFromText(post.text) },
      scheduledDelayMin: 1
    });
    if (out?.item) {
      queued += 1;
      doc.items.push(out.item);
    }
  }

  return { scanned: (beat.posts || []).length, queued };
}

module.exports = {
  isReplyEnabled,
  isTrustedBeatPost,
  scheduleRepliesForSentPost,
  scanTrendingEngagementReplies,
  extractTweetIdFromPost,
  intelFingerprint
};
