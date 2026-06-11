const fs = require('fs');
const path = require('path');

const STAFF_PATH = path.join(__dirname, '..', 'data', 'coaching-staff.json');

const ADMIN_PIN =
  process.env.OPS_ADMIN_PIN ||
  process.env.RECRUITING_ADMIN_PIN ||
  process.env.EMAIL_TEST_PIN ||
  'GV2026admin';

function verifyAdminPin(pin) {
  return !!pin && pin === ADMIN_PIN;
}

function pinFromReq(req) {
  return (
    req.headers['x-ops-pin'] ||
    req.headers['x-recruiting-pin'] ||
    req.body?.pin ||
    req.query?.pin
  );
}

function readStaff() {
  try {
    return JSON.parse(fs.readFileSync(STAFF_PATH, 'utf8'));
  } catch (e) {
    return { version: 1, coaches: [], analysts: [], supportStaff: [] };
  }
}

function writeStaff(data) {
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(STAFF_PATH, JSON.stringify(data, null, 2), 'utf8');
  return data;
}

function mountTeamStaffRoutes(app) {
  app.get('/api/team/coaching-staff', (_req, res) => {
    res.json({ ok: true, ...readStaff() });
  });

  app.put('/api/team/coaching-staff', (req, res) => {
    const pin = pinFromReq(req);
    if (!verifyAdminPin(pin)) {
      return res.status(401).json({ ok: false, error: 'Admin PIN required' });
    }
    const body = req.body || {};
    const current = readStaff();
    const next = {
      version: body.version || current.version,
      coaches: Array.isArray(body.coaches) ? body.coaches : current.coaches,
      analysts: Array.isArray(body.analysts) ? body.analysts : current.analysts,
      supportStaff: Array.isArray(body.supportStaff) ? body.supportStaff : current.supportStaff
    };
    writeStaff(next);
    return res.json({ ok: true, ...next });
  });
}

module.exports = { mountTeamStaffRoutes, readStaff };
