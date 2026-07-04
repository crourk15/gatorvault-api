/** PR-6 soft launch — golden four beat allowlist (slug match only). */

const PR6_SOFT_LAUNCH_SLUGS = Object.freeze(['drakeford', 'robinson', 'willingham', 'ham']);

function slugFromPlayerUrl(url = '') {
  const m = String(url).match(/\/player\/([a-z0-9-]+)/i);
  return m ? m[1].toLowerCase() : null;
}

function resolveGoldenBeatId(signal = {}) {
  const direct = String(signal.playerSlug || '').toLowerCase();
  if (PR6_SOFT_LAUNCH_SLUGS.includes(direct)) return direct;

  const fromUrl = slugFromPlayerUrl(signal.links?.playerUrl || '');
  if (fromUrl && PR6_SOFT_LAUNCH_SLUGS.includes(fromUrl)) return fromUrl;

  try {
    const { slugify } = require('../../slug');
    const name = signal.player?.name;
    if (name) {
      const slug = slugify(name);
      if (PR6_SOFT_LAUNCH_SLUGS.includes(slug)) return slug;
    }
  } catch {
    /* slug helper optional in some contexts */
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
  return (
    process.env.X_AUTOPOST_PR789_ANGLE_ENABLED === 'true' &&
    isPr6GoldenBeat(signal) &&
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
