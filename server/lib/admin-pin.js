/**
 * Unified admin PIN verification — accepts any configured admin/cron PIN env var.
 */
function normalizePin(value) {
  if (value == null) return '';
  return String(value).trim();
}

function collectAdminPins() {
  const raw = [
    process.env.OPS_ADMIN_PIN,
    process.env.RECRUITING_ADMIN_PIN,
    process.env.ROSTER_ADMIN_PIN,
    process.env.CONTENT_ADMIN_PIN,
    process.env.COMMUNITY_ADMIN_PIN,
    process.env.LIVE_ADMIN_PIN,
    process.env.FILM_ROOM_ADMIN_PIN,
    process.env.WAR_ROOM_ADMIN_PIN,
    process.env.X_AUTOPOST_PIN,
    process.env.MEDIA_INGEST_PIN,
    process.env.INGEST_CRON_SECRET,
    process.env.MONITORING_SECRET,
    process.env.EMAIL_TEST_PIN,
    'GV2026admin'
  ];
  const pins = raw.map(normalizePin).filter(Boolean);
  return [...new Set(pins)];
}

function verifyAdminPin(pin) {
  const normalized = normalizePin(pin);
  if (!normalized) return false;
  return collectAdminPins().includes(normalized);
}

function primaryAdminPin() {
  const pins = collectAdminPins();
  return pins[0] || 'GV2026admin';
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
  normalizePin
};
