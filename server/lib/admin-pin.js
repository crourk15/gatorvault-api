/**
 * Unified admin PIN verification — accepts any configured ops/recruiting/roster pin.
 */
function collectAdminPins() {
  const raw = [
    process.env.OPS_ADMIN_PIN,
    process.env.RECRUITING_ADMIN_PIN,
    process.env.ROSTER_ADMIN_PIN,
    process.env.CONTENT_ADMIN_PIN,
    process.env.COMMUNITY_ADMIN_PIN,
    process.env.LIVE_ADMIN_PIN,
    process.env.EMAIL_TEST_PIN,
    'GV2026admin'
  ];
  return [...new Set(raw.filter(Boolean))];
}

function verifyAdminPin(pin) {
  if (!pin) return false;
  return collectAdminPins().includes(String(pin).trim());
}

function primaryAdminPin() {
  const pins = collectAdminPins();
  return pins[0] || 'GV2026admin';
}

function pinFromReq(req) {
  return (
    req.headers['x-ops-pin'] ||
    req.headers['x-recruiting-pin'] ||
    req.headers['x-roster-pin'] ||
    req.headers['x-monitoring-secret'] ||
    req.headers['x-ingest-secret'] ||
    req.body?.pin ||
    req.query?.pin
  );
}

module.exports = {
  collectAdminPins,
  verifyAdminPin,
  primaryAdminPin,
  pinFromReq
};
