/**
 * Unified admin PIN verification — accepts any configured admin/cron PIN env var.
 */
function normalizePin(value) {
  if (value == null) return '';
  return String(value).trim();
}

function collectAdminPins() {
  // Env-configured pins only. Hardcoded fallback is last-resort when nothing is set
  // (local/dev or misconfigured Render) — never accepted alongside real env pins.
  const raw = [
    process.env.ADMIN_PASSWORD,
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
    process.env.MONITORING_CRON_SECRET,
    process.env.MONITORING_SECRET,
    process.env.EMAIL_TEST_PIN
  ];
  const pins = [...new Set(raw.map(normalizePin).filter(Boolean))];
  if (pins.length > 0) return pins;
  if (process.env.ALLOW_DEFAULT_ADMIN_PIN === 'true' || process.env.NODE_ENV !== 'production') {
    return ['GV2026admin'];
  }
  // Production with zero env pins: keep legacy fallback so ops is not locked out,
  // but prefer setting OPS_ADMIN_PIN (see docs/ADMIN_HUB.md).
  return ['GV2026admin'];
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
