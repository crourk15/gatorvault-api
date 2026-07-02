/**
 * UF Premium autoposter mode — env bundle for full pipeline activation.
 * Viewport-safe: uses env only, no device detection.
 */
const ONE_HOUR_MS = 60 * 60 * 1000;
const FOUR_HOURS_MS = 4 * ONE_HOUR_MS;

const UF_PREMIUM_AUTOPOSTER_ENV = Object.freeze({
  X_PIPELINES_ENABLED: 'true',
  X_AUTOPOST_ENABLED: 'true',
  X_GM2_REWRITE_ENABLED: 'true',
  X_INTEL_REWRITE_ENABLED: 'true',
  X_AUTOPROMPT_ENABLED: 'true',
  X_AUTOPOST_REPLY_ENABLED: 'true',
  X_AUTOPOST_ELITE_MODE: 'true',
  X_SCHEDULED_JOBS_ENABLED: 'true',
  X_AUTOPOST_REWRITE_FALLBACK: 'true',
  X_AUTOPOST_GV_CTA_ENABLED: 'true',
  RIVALS_PM_INGEST_ENABLED: 'true',
  ON3_INGEST_ENABLED: 'true',
  X_AUTOPOST_MAX_INTEL_AGE_MS: String(FOUR_HOURS_MS),
  X_AUTOPOST_INTEL_FRESHNESS_MS: String(FOUR_HOURS_MS),
  X_AUTOPOST_MAX_BEAT_AGE_MS: String(FOUR_HOURS_MS),
  X_AUTOPOST_BEAT_FIRST: 'true',
  X_AUTOPOST_CLUSTER_FALLBACK: 'true',
  X_AUTOPOST_ELITE_COMPOSE: 'true',
  X_AUTOPOST_SUBTLE_GV_HOOKS: 'true',
  X_AUTOPOST_BEAT_CACHE_STALE_MS: String(15 * 60 * 1000),
  X_AUTOPOST_ELITE_BRAND_BEAT: 'true',
  X_AUTOPOST_ELITE_BRAND_ALL: 'true',
  X_AUTOPOST_ALLOW_MONITORING_FALLBACK: 'false',
  X_AUTOPOST_HEAT_METER: 'false',
  X_AUTOPOST_CONFIDENCE_METER: 'false',
  X_AUTOPOST_MIN_REWRITE_WORDS: '40',
  X_AUTOPOST_QUOTE_OVERLAP_MAX: '0.2',
  X_AUTOPOST_QUOTE_REGEN_ATTEMPTS: '4',
  X_AUTOPOST_REFILL_MIN_PENDING: '6',
  X_AUTOPOST_REFILL_MAX_ENQUEUE: '10',
  X_AUTOPOST_COOLDOWN_MS: String(30 * 60 * 1000),
  X_AUTOPOST_RPM_CLOSE_GAP: '8',
  X_AUTOPOST_ARTICLE_HARVEST_LIMIT: '8',
  X_AUTOPOST_POST_FLOOR_MS: String(2 * 60 * 60 * 1000),
  X_AUTOPOST_TOPIC_ROTATION: 'true',
  X_AUTOPOST_ON3_NEWS_FALLBACK: 'true',
  X_AUTOPOST_EMPTY_QUEUE_FALLBACK: 'true',
  X_AUTOPOST_DISCOVERY_ENABLED: 'true',
  X_AUTOPOST_UF_OFFICIAL_NEWS: 'true',
  X_AUTOPOST_ROSTER_DELTA: 'true',
  X_AUTOPOST_SCOUTING_UPDATES: 'true',
  X_AUTOPOST_GAME_ZONE_DISCOVERY: 'true'
});

function isUfPremiumMode() {
  return process.env.X_AUTOPOST_ELITE_MODE === 'true' && process.env.X_GM2_REWRITE_ENABLED === 'true';
}

function applyToProcessEnv() {
  for (const [key, value] of Object.entries(UF_PREMIUM_AUTOPOSTER_ENV)) {
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}

module.exports = {
  ONE_HOUR_MS,
  FOUR_HOURS_MS,
  UF_PREMIUM_AUTOPOSTER_ENV,
  isUfPremiumMode,
  applyToProcessEnv
};
