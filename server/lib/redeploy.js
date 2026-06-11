const fetch = require('node-fetch');
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
  app.post('/api/ops/redeploy', async (req, res) => {
    if (!requireOpsAuth(req, res)) return;
    const hookUrl = process.env.RENDER_DEPLOY_HOOK_URL;
    if (!hookUrl) {
      return res.status(503).json({ ok: false, error: 'RENDER_DEPLOY_HOOK_URL is not configured' });
    }
    try {
      const result = await fetch(hookUrl, { method: 'POST' });
      return res.json({ ok: result.ok, status: result.status });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });
};
