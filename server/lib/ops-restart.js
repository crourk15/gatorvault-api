const { pinFromReq, verifyAdminPin } = require('./ops-routes');

function requireOpsAuth(req, res) {
  const secret = pinFromReq(req);
  if (!verifyAdminPin(secret)) {
    res.status(401).json({ ok: false, error: 'Admin PIN required' });
    return false;
  }
  return true;
}

module.exports = (app) => {
  app.post('/api/ops/restart-worker', async (req, res) => {
    if (!requireOpsAuth(req, res)) return;
    console.log('[ops] Restarting worker...');
    res.json({ ok: true, restarting: true });
    setTimeout(() => process.exit(0), 150);
  });
};
