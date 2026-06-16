const fetch = require('node-fetch');
const { pinFromReq, verifyAdminPin } = require('./admin-pin');

async function purgeNetlifyCdn(cacheTags) {
  const token = process.env.NETLIFY_AUTH_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID;
  const siteSlug = process.env.NETLIFY_SITE_SLUG || 'stupendous-paprenjak-bedb92';
  if (!token) {
    return { ok: false, skipped: true, error: 'NETLIFY_AUTH_TOKEN not configured' };
  }
  const body = siteId ? { site_id: siteId } : { site_slug: siteSlug };
  if (Array.isArray(cacheTags) && cacheTags.length) body.cache_tags = cacheTags;
  const res = await fetch('https://api.netlify.com/api/v1/purge', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let payload = text;
  try {
    payload = JSON.parse(text);
  } catch {
    /* raw */
  }
  return { ok: res.ok, status: res.status, payload, scope: cacheTags?.length ? cacheTags : 'site' };
}

function requireOpsAuth(req, res) {
  const secret = pinFromReq(req);
  if (!verifyAdminPin(secret)) {
    res.status(401).json({ ok: false, error: 'Admin PIN required' });
    return false;
  }
  return true;
}

module.exports = (app) => {
  app.post('/api/ops/purge-cdn', async (req, res) => {
    if (!requireOpsAuth(req, res)) return;
    try {
      const purge = await purgeNetlifyCdn(req.body?.cacheTags);
      return res.status(purge.ok ? 202 : 502).json({ ok: purge.ok, purge });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

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
        const hookUrl = netlifyHook.includes('?')
          ? `${netlifyHook}&clear_cache=true`
          : `${netlifyHook}?clear_cache=true`;
        const result = await fetch(hookUrl, { method: 'POST' });
        steps.push({ service: 'netlify', ok: result.ok, status: result.status, clearCache: true });
      } catch (err) {
        steps.push({ service: 'netlify', ok: false, error: err.message });
      }
    }

    try {
      const purge = await purgeNetlifyCdn(req.body?.cacheTags);
      steps.push({ service: 'netlify-cdn-purge', ...purge });
    } catch (err) {
      steps.push({ service: 'netlify-cdn-purge', ok: false, error: err.message });
    }

    if (!renderHook && !netlifyHook) {
      return res.status(503).json({
        ok: false,
        error: 'Neither RENDER_DEPLOY_HOOK_URL nor NETLIFY_BUILD_HOOK_URL is configured',
        steps,
      });
    }

    const ok = steps.some((s) => s.ok);
    return res.json({ ok, steps });
  });
};

module.exports.purgeNetlifyCdn = purgeNetlifyCdn;
