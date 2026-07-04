/** PR-6 soft launch — golden four beat allowlist (slug match only). */

const { isGoldenFourRankingComplete } = require('../../player-intelligence/golden-four-on3');

const PR6_SOFT_LAUNCH_SLUGS = Object.freeze(['drakeford', 'robinson', 'willingham', 'ham']);

function slugFromPlayerUrl(url = '') {
  const m = String(url).match(/\/player\/([a-z0-9-]+)/i);
  return m ? m[1].toLowerCase() : null;
}

function slugMatchesGolden(slug, goldenId) {
  const s = String(slug || '').toLowerCase();
  const g = String(goldenId || '').toLowerCase();
  if (!s || !g) return false;
  return s === g || s.endsWith(`-${g}`);
}

function resolveGoldenBeatId(signal = {}) {
  const candidates = [
    String(signal.playerSlug || '').toLowerCase(),
    slugFromPlayerUrl(signal.links?.playerUrl || '')
  ];

  try {
    const { slugify } = require('../../slug');
    const name = signal.player?.name;
    if (name) candidates.push(String(slugify(name)).toLowerCase());
  } catch {
    /* slug helper optional in some contexts */
  }

  for (const goldenId of PR6_SOFT_LAUNCH_SLUGS) {
    if (candidates.some((slug) => slug && slugMatchesGolden(slug, goldenId))) {
      return goldenId;
    }
  }

  return null;
}

function isPr6GoldenBeat(signal = {}) {
  return resolveGoldenBeatId(signal) !== null;
}

function shouldUsePr6Live(signal = {}, pr6Shadow = {}) {
  return (
    process.env.X_AUTOPOST_PR6_ENABLED === 'true' &&
    isPr6GoldenBeat(signal) &&
    pr6Shadow?.ok === true &&
    typeof pr6Shadow.rewrittenTweet === 'string' &&
    pr6Shadow.rewrittenTweet.length > 0
  );
}

function shouldUsePr789Live(signal = {}, pr789 = {}) {
  return (
    process.env.X_AUTOPOST_PR7_8_9_ENABLED === 'true' &&
    isPr6GoldenBeat(signal) &&
    pr789?.ok === true &&
    typeof pr789.rewrittenTweet === 'string' &&
    pr789.rewrittenTweet.length > 0
  );
}

function shouldUsePr789AngleLive(signal = {}, anglePack = {}) {
  if (!isPr6GoldenBeat(signal)) return false;
  if (!isGoldenFourRankingComplete()) return false;
  const goldenAngleLive =
    process.env.X_AUTOPOST_PR789_ANGLE_ENABLED === 'true' ||
    (process.env.X_AUTOPOST_PR7_8_9_ENABLED === 'true' &&
      process.env.X_AUTOPOST_PR789_ANGLE_GOLDEN_LIVE !== 'false');
  return (
    goldenAngleLive &&
    anglePack?.ok === true &&
    typeof anglePack.rewrittenTweet === 'string' &&
    anglePack.rewrittenTweet.length > 0
  );
}

module.exports = {
  PR6_SOFT_LAUNCH_SLUGS,
  resolveGoldenBeatId,
  isPr6GoldenBeat,
  shouldUsePr6Live,
  shouldUsePr789Live,
  shouldUsePr789AngleLive
};
