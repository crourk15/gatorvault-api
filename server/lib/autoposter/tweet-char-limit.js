/** X post character budget — 500 default for Premium elite copy; up to 4000 via env. */

/** Legacy free-account ceiling (used only for extended-mode detection). */
const STANDARD_TWEET_CHAR_LIMIT = 280;
/** Default for @gatorvault Premium — full rank line + beat quote + RPM + takeaway. */
const DEFAULT_TWEET_CHAR_LIMIT = 500;
/** Safe upper cap for recruiting insider posts (X Premium allows far more). */
const MAX_TWEET_CHAR_LIMIT = 4000;

function getTweetCharLimit() {
  const raw =
    process.env.X_CHAR_LIMIT || process.env.VOICE_CHAR_LIMIT || String(DEFAULT_TWEET_CHAR_LIMIT);
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < STANDARD_TWEET_CHAR_LIMIT) return DEFAULT_TWEET_CHAR_LIMIT;
  return Math.min(n, MAX_TWEET_CHAR_LIMIT);
}

function isExtendedTweetLimit(limit = getTweetCharLimit()) {
  return limit > STANDARD_TWEET_CHAR_LIMIT;
}

module.exports = {
  STANDARD_TWEET_CHAR_LIMIT,
  DEFAULT_TWEET_CHAR_LIMIT,
  MAX_TWEET_CHAR_LIMIT,
  /** @deprecated use MAX_TWEET_CHAR_LIMIT */
  get EXTENDED_TWEET_CHAR_LIMIT() {
    return MAX_TWEET_CHAR_LIMIT;
  },
  getTweetCharLimit,
  isExtendedTweetLimit
};
