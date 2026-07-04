/** Player Intelligence — staleness thresholds and tier config. */

const MS_DAY = 24 * 60 * 60 * 1000;

const STALE_RANKINGS_MS = Number(process.env.PLAYER_INTEL_STALE_RANKINGS_MS || 30 * MS_DAY);
const STALE_RPM_MS = Number(process.env.PLAYER_INTEL_STALE_RPM_MS || 14 * MS_DAY);
const TIER_B_MENTION_MS = Number(process.env.PLAYER_INTEL_TIER_B_MS || 14 * MS_DAY);

const GOLDEN_SLUGS = Object.freeze([
  'drakeford',
  'ryan-drakeford',
  'robinson',
  'man-robinson',
  'willingham',
  'bryce-willingham',
  'ham',
  'merrick-ham'
]);

module.exports = {
  MS_DAY,
  STALE_RANKINGS_MS,
  STALE_RPM_MS,
  TIER_B_MENTION_MS,
  GOLDEN_SLUGS
};
