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
    const renderHook = process.env.RENDER_DEPLOY_HOOK_URL;
    const netlifyHook = process.env.NETLIFY_BUILD_HOOK_URL;
    const steps = [];

    if (renderHook) {
      try {
        const result = await fetch(renderHook, { method: 'POST' });
        steps.push({ service: 'render', ok: result.ok, status: result.status });
      } catch (err) {
        steps.push({ service: 'render', ok: false, error: err.message });
      }
    }

    if (netlifyHook) {
      try {
        const result = await fetch(netlifyHook, { method: 'POST' });
        steps.push({ service: 'netlify', ok: result.ok, status: result.status });
      } catch (err) {
        steps.push({ service: 'netlify', ok: false, error: err.message });
      }
    }

    if (!renderHook && !netlifyHook) {
      return res.status(503).json({
        ok: false,
        error: 'Neither RENDER_DEPLOY_HOOK_URL nor NETLIFY_BUILD_HOOK_URL is configured'
      });
    }

    const ok = steps.some((s) => s.ok);
    return res.json({ ok, steps });
  });
};
