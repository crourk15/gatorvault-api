/**
 * Self-Runner — deploy after patch apply (redeploy hook + worker restart + health wait).
 */
const fetch = require('node-fetch');

const API_URL = (process.env.QA_API_URL || process.env.API_BASE_URL || 'http://localhost:3000').replace(
  /\/$/,
  ''
);

async function waitForHealth({ maxAttempts = 24, intervalMs = 5000, pin } = {}) {
  const url = `${API_URL}/api/health`;
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const r = await fetch(url, { timeout: 8000 });
      if (r.ok) {
        const body = await r.json();
        if (body.status === 'ok') {
          return { ok: true, attempt: i + 1, body };
        }
      }
    } catch {
      /* retry */
    }
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  return { ok: false, error: 'health_check_timeout' };
}

async function triggerRedeploy(pin) {
  const hookUrl = process.env.RENDER_DEPLOY_HOOK_URL;
  if (hookUrl) {
    try {
      const r = await fetch(hookUrl, { method: 'POST' });
      return { ok: r.ok, status: r.status, via: 'deploy_hook' };
    } catch (err) {
      return { ok: false, error: err.message, via: 'deploy_hook' };
    }
  }

  try {
    const r = await fetch(`${API_URL}/api/ops/redeploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Ops-Pin': pin || ''
      },
      body: JSON.stringify({ pin })
    });
    const body = await r.json().catch(() => ({}));
    return { ok: r.ok && body.ok !== false, status: r.status, via: 'ops_api', body };
  } catch (err) {
    return { ok: false, error: err.message, via: 'ops_api' };
  }
}

async function triggerWorkerRestart(pin) {
  try {
    const r = await fetch(`${API_URL}/api/ops/restart-worker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Ops-Pin': pin || ''
      },
      body: JSON.stringify({ pin })
    });
    const body = await r.json().catch(() => ({}));
    return { ok: r.ok, restarting: body.restarting === true, body };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function deployAfterPatch({ pin, skipRestart = false, waitHealth = true } = {}) {
  const steps = [];
  const redeploy = await triggerRedeploy(pin);
  steps.push({ step: 'redeploy', ...redeploy });

  if (!skipRestart && redeploy.ok) {
    await new Promise((r) => setTimeout(r, 2000));
  }

  let restart = { ok: true, skipped: true };
  if (!skipRestart) {
    restart = await triggerWorkerRestart(pin);
    steps.push({ step: 'restart-worker', ...restart });
  }

  let health = { ok: true, skipped: true };
  if (waitHealth) {
    await new Promise((r) => setTimeout(r, 3000));
    health = await waitForHealth({ pin });
    steps.push({ step: 'health-check', ...health });
  }

  return {
    ok: true,
    redeployOk: redeploy.ok,
    steps,
    note: !redeploy.ok
      ? 'Patch applied locally. Configure RENDER_DEPLOY_HOOK_URL for production redeploy; commit & push static changes for Netlify.'
      : redeploy.via === 'deploy_hook'
        ? 'Render deploy hook triggered. Commit & push static changes for Netlify if index.html/css was patched.'
        : null
  };
}

module.exports = {
  deployAfterPatch,
  waitForHealth,
  triggerRedeploy,
  triggerWorkerRestart
};
