/**
 * UF Premium autoposter mode — env bundle for full pipeline activation.
 * Viewport-safe: uses env only, no device detection.
 */
const ONE_HOUR_MS = 60 * 60 * 1000;

const UF_PREMIUM_AUTOPOSTER_ENV = Object.freeze({
  X_PIPELINES_ENABLED: 'true',
  X_AUTOPOST_ENABLED: 'true',
  X_GM2_REWRITE_ENABLED: 'true',
  X_INTEL_REWRITE_ENABLED: 'true',
  X_AUTOPOST_REPLY_ENABLED: 'true',
  X_AUTOPOST_ELITE_MODE: 'true',
  X_SCHEDULED_JOBS_ENABLED: 'true',
  RIVALS_PM_INGEST_ENABLED: 'true',
  ON3_INGEST_ENABLED: 'true',
  X_AUTOPOST_MAX_INTEL_AGE_MS: String(ONE_HOUR_MS),
  X_AUTOPOST_INTEL_FRESHNESS_MS: String(ONE_HOUR_MS),
  X_AUTOPOST_MAX_BEAT_AGE_MS: String(ONE_HOUR_MS),
  X_AUTOPOST_MIN_REWRITE_WORDS: '40',
  X_AUTOPOST_QUOTE_OVERLAP_MAX: '0.2',
  X_AUTOPOST_QUOTE_REGEN_ATTEMPTS: '4'
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
  UF_PREMIUM_AUTOPOSTER_ENV,
  isUfPremiumMode,
  applyToProcessEnv
};
