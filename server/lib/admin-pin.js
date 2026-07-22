/**
 * Unified admin PIN verification — accepts configured operator pins + cron secrets.
 *
 * Operator pins (OPS_ADMIN_PIN, RECRUITING_ADMIN_PIN, …) are for hub login.
 * Cron/monitoring secrets also authorize API calls.
 * Legacy GV2026admin stays accepted unless DISABLE_DEFAULT_ADMIN_PIN=true —
 * cron secrets alone must never lock operators out of the hub.
 */
function normalizePin(value) {
  if (value == null) return '';
  return String(value).trim();
}

const OPERATOR_PIN_ENV = [
  'ADMIN_PASSWORD',
  'OPS_ADMIN_PIN',
  'RECRUITING_ADMIN_PIN',
  'ROSTER_ADMIN_PIN',
  'CONTENT_ADMIN_PIN',
  'COMMUNITY_ADMIN_PIN',
  'LIVE_ADMIN_PIN',
  'FILM_ROOM_ADMIN_PIN',
  'WAR_ROOM_ADMIN_PIN',
  'X_AUTOPOST_PIN',
  'MEDIA_INGEST_PIN',
  'EMAIL_TEST_PIN'
];

const SERVICE_SECRET_ENV = [
  'INGEST_CRON_SECRET',
  'MONITORING_CRON_SECRET',
  'MONITORING_SECRET'
];

const LEGACY_OPERATOR_PIN = 'GV2026admin';

function pinsFromEnv(keys) {
  return keys.map((key) => normalizePin(process.env[key])).filter(Boolean);
}

function isProductionRuntime() {
  return (
    String(process.env.NODE_ENV || '').toLowerCase() === 'production' ||
    String(process.env.RENDER || '').toLowerCase() === 'true'
  );
}

function collectAdminPins() {
  const operatorPins = [...new Set(pinsFromEnv(OPERATOR_PIN_ENV))];
  const serviceSecrets = [...new Set(pinsFromEnv(SERVICE_SECRET_ENV))];
  const disableLegacy = String(process.env.DISABLE_DEFAULT_ADMIN_PIN || '').toLowerCase() === 'true';
  const allowLegacy = String(process.env.ALLOW_LEGACY_ADMIN_PIN || '').toLowerCase() === 'true';

  // Production: never accept the published default PIN unless explicitly allowed.
  if (isProductionRuntime()) {
    if (allowLegacy && !disableLegacy) {
      operatorPins.push(LEGACY_OPERATOR_PIN);
    }
  } else if (!disableLegacy || operatorPins.length === 0) {
    operatorPins.push(LEGACY_OPERATOR_PIN);
  }

  return [...new Set([...operatorPins, ...serviceSecrets])];
}

function verifyAdminPin(pin) {
  const normalized = normalizePin(pin);
  if (!normalized) return false;
  return collectAdminPins().includes(normalized);
}

function primaryAdminPin() {
  const pins = collectAdminPins();
  return pins[0] || LEGACY_OPERATOR_PIN;
}

function pinFromReq(req) {
  if (!req) return '';
  const fromHeaders =
    req.headers['x-ops-pin'] ||
    req.headers['x-recruiting-pin'] ||
    req.headers['x-roster-pin'] ||
    req.headers['x-live-pin'] ||
    req.headers['x-content-pin'] ||
    req.headers['x-monitoring-secret'] ||
    req.headers['x-ingest-secret'];
  return normalizePin(fromHeaders || req.body?.pin || req.query?.pin);
}

module.exports = {
  collectAdminPins,
  verifyAdminPin,
  primaryAdminPin,
  pinFromReq,
  normalizePin,
  LEGACY_OPERATOR_PIN
};
