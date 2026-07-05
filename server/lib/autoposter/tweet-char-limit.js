/** X post character budget — 280 default, up to 500 for Premium/verified long posts. */

const DEFAULT_TWEET_CHAR_LIMIT = 280;
const EXTENDED_TWEET_CHAR_LIMIT = 500;

function getTweetCharLimit() {
  const raw = process.env.X_CHAR_LIMIT || process.env.VOICE_CHAR_LIMIT || String(DEFAULT_TWEET_CHAR_LIMIT);
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < DEFAULT_TWEET_CHAR_LIMIT) return DEFAULT_TWEET_CHAR_LIMIT;
  return Math.min(n, EXTENDED_TWEET_CHAR_LIMIT);
}

function isExtendedTweetLimit(limit = getTweetCharLimit()) {
  return limit > DEFAULT_TWEET_CHAR_LIMIT;
}

module.exports = {
  DEFAULT_TWEET_CHAR_LIMIT,
  EXTENDED_TWEET_CHAR_LIMIT,
  getTweetCharLimit,
  isExtendedTweetLimit
};
