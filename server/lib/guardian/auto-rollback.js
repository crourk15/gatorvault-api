/**
 * Auto-rollback — roll back to last live Render deploy when health stays broken.
 */
const fetch = require('node-fetch');
const { alertGuardian } = require('./guardian-alerts');

const API = 'https://api.render.com/v1';
const SERVICE_ID = process.env.RENDER_SERVICE_ID || 'srv-d8i0t4btqb8s73akkbj0';

async function findLastLiveDeploy() {
  const key = process.env.RENDER_API_KEY;
  if (!key) return { ok: false, error: 'no_render_api_key' };

  const res = await fetch(`${API}/services/${SERVICE_ID}/deploys?limit=10`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }
  });
  if (!res.ok) return { ok: false, error: `deploys_list_${res.status}` };
  const rows = await res.json();
  const live = (rows || [])
    .map((r) => r.deploy || r)
    .find((d) => d.status === 'live' && d.id !== process.env.RENDER_DEPLOY_ID);
  if (!live) return { ok: false, error: 'no_previous_live_deploy' };
  return { ok: true, deploy: live };
}

async function triggerRollback(deployId) {
  const key = process.env.RENDER_API_KEY;
  if (!key) return { ok: false, error: 'no_render_api_key' };

  const res = await fetch(`${API}/services/${SERVICE_ID}/deploys/${deployId}/rollback`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text.slice(0, 500) };
}

async function attemptAutoRollback(reason) {
  if (process.env.GUARDIAN_AUTO_ROLLBACK !== 'true') {
    return { ok: false, skipped: true, reason: 'GUARDIAN_AUTO_ROLLBACK not enabled' };
  }

  await alertGuardian({
    type: 'auto_rollback_attempt',
    severity: 'critical',
    title: 'Attempting Render rollback',
    message: reason,
    dedupeKey: 'guardian:auto_rollback'
  });

  const last = await findLastLiveDeploy();
  if (!last.ok) return last;

  const result = await triggerRollback(last.deploy.id);
  await alertGuardian({
    type: 'auto_rollback_result',
    severity: result.ok ? 'warning' : 'critical',
    title: result.ok ? 'Rollback triggered' : 'Rollback failed',
    message: result.ok
      ? `Rolling back to deploy ${last.deploy.id} (${last.deploy.commit?.id?.slice(0, 7)})`
      : String(result.body || result.error),
    meta: { deployId: last.deploy.id, result }
  });
  return result;
}

module.exports = { attemptAutoRollback, findLastLiveDeploy, triggerRollback };
