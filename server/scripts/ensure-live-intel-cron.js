/**
 * Ensure live intel stays fresh on Render:
 * - Verify beat-ingest + platform-ops cron services
 * - Sync MONITORING_CRON_SECRET onto those crons from gatorvault-api
 * - Hub mode ON / auto-scheduler OFF on web service
 * - PLATFORM_OPS_JOBS without x-autoposter-run; include live-refresh
 * Does not print secret values.
 *
 * Usage: node server/scripts/ensure-live-intel-cron.js
 *        node server/scripts/ensure-live-intel-cron.js --deploy
 *        node server/scripts/ensure-live-intel-cron.js --trigger
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const API = 'https://api.render.com/v1';
const WEB_NAME = 'gatorvault-api';
const BEAT_CRON = 'gatorvault-api-beat-ingest';
const PLATFORM_CRON = 'gatorvault-api-platform-ops';
const KEEPALIVE_CRON = 'gatorvault-api-keepalive';
const EXTRA_CRONS = ['gatorvault-api-recruiting-ingest', 'gatorvault-api-hub-refresh'];
const PROD_API = 'https://gatorvault-api.onrender.com';
const PLATFORM_OPS_JOBS =
  'live-refresh,portal-ingest,depth-chart-refresh,game-zone-refresh,nil-refresh';

function saveLocalSecret(secret) {
  let text = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  if (/^MONITORING_CRON_SECRET=/m.test(text)) {
    text = text.replace(/^MONITORING_CRON_SECRET=.*$/m, `MONITORING_CRON_SECRET=${secret}`);
  } else {
    text = `${text.trimEnd()}\n\nMONITORING_CRON_SECRET=${secret}\n`;
  }
  fs.writeFileSync(ENV_PATH, text);
}

function loadEnv(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

async function renderApi(key, pathname, opts = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(
      `${opts.method || 'GET'} ${pathname} -> ${res.status}: ${
        typeof body === 'string' ? body : JSON.stringify(body)
      }`
    );
  }
  return body;
}

async function listServices(key) {
  const rows = await renderApi(key, '/services?limit=50');
  return (rows || []).map((r) => r.service || r);
}

function envMap(rows) {
  const map = {};
  for (const row of rows || []) {
    const e = row.envVar || row;
    if (e && e.key) map[e.key] = e.value == null ? '' : String(e.value);
  }
  return map;
}

async function upsertEnv(key, serviceId, envKey, value) {
  await renderApi(key, `/services/${serviceId}/env-vars/${encodeURIComponent(envKey)}`, {
    method: 'PUT',
    body: JSON.stringify({ value: String(value) }),
  });
}

async function latestCronRun(key, serviceId) {
  try {
    const rows = await renderApi(key, `/services/${serviceId}/jobs?limit=3`);
    return (rows || []).slice(0, 3).map((r) => {
      const j = r.job || r;
      return {
        status: j.status,
        startedAt: j.startedAt || j.createdAt || null,
        finishedAt: j.finishedAt || null,
      };
    });
  } catch {
    return [];
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const env = loadEnv(ENV_PATH);
  const key = (process.env.RENDER_API_KEY || env.RENDER_API_KEY || '').trim();
  if (!key) throw new Error('Missing RENDER_API_KEY');

  const services = await listServices(key);
  const byName = Object.fromEntries(services.map((s) => [s.name, s]));

  const web = byName[WEB_NAME];
  if (!web) throw new Error(`${WEB_NAME} not found`);

  const report = {
    web: { id: web.id, suspended: web.suspended, autoDeploy: web.autoDeploy },
    crons: {},
    actions: [],
  };

  for (const name of [BEAT_CRON, PLATFORM_CRON, KEEPALIVE_CRON, ...EXTRA_CRONS]) {
    const svc = byName[name];
    if (!svc) {
      report.crons[name] = { exists: false };
      continue;
    }
    report.crons[name] = {
      exists: true,
      id: svc.id,
      suspended: svc.suspended,
      schedule: svc.serviceDetails && svc.serviceDetails.schedule,
      recentJobs: await latestCronRun(key, svc.id),
    };
  }

  const webEnvs = envMap(await renderApi(key, `/services/${web.id}/env-vars`));
  let secret = (
    webEnvs.MONITORING_CRON_SECRET ||
    webEnvs.INGEST_CRON_SECRET ||
    env.MONITORING_CRON_SECRET ||
    ''
  ).trim();
  if (!secret) {
    secret = crypto.randomBytes(24).toString('hex');
    report.actions.push('generated new MONITORING_CRON_SECRET');
  }

  report.webEnv = {
    X_BEARER_TOKEN: webEnvs.X_BEARER_TOKEN ? `SET len=${webEnvs.X_BEARER_TOKEN.length}` : 'MISSING',
    X_SCHEDULED_JOBS_ENABLED: webEnvs.X_SCHEDULED_JOBS_ENABLED || '(unset)',
    X_AUTOPOST_HUB_MODE: webEnvs.X_AUTOPOST_HUB_MODE || '(unset)',
    X_AUTOPOST_SCHEDULER_ENABLED: webEnvs.X_AUTOPOST_SCHEDULER_ENABLED || '(unset)',
    X_AUTOPOST_ENABLED: webEnvs.X_AUTOPOST_ENABLED || '(unset)',
    X_PIPELINES_ENABLED: webEnvs.X_PIPELINES_ENABLED || '(unset)',
    MONITORING_CRON_SECRET: 'SET',
  };

  // Hub mode: drafts/compose OK, no auto-tweet. Cron secret required for beat-ingest.
  const webUpdates = {
    MONITORING_CRON_SECRET: secret,
    X_AUTOPOST_HUB_MODE: 'true',
    X_AUTOPOST_SCHEDULER_ENABLED: 'false',
    X_PIPELINES_ENABLED: 'true',
    // Keep in-process heavy schedulers off (Starter); rely on Render beat-ingest cron.
    X_SCHEDULED_JOBS_ENABLED: 'false',
  };
  for (const [k, v] of Object.entries(webUpdates)) {
    if (String(webEnvs[k] || '') !== v) {
      await upsertEnv(key, web.id, k, v);
      report.actions.push(`web upsert ${k}`);
    }
  }
  saveLocalSecret(secret);
  report.actions.push('saved MONITORING_CRON_SECRET to server/.env (gitignored)');

  for (const name of [BEAT_CRON, PLATFORM_CRON, ...EXTRA_CRONS]) {
    const svc = byName[name];
    if (!svc) {
      report.actions.push(`WARN missing cron service ${name} — create from render.yaml blueprint`);
      continue;
    }
    if (svc.suspended === 'suspended') {
      report.actions.push(`WARN ${name} is suspended — resume in Render dashboard`);
    }
    const cronEnvs = envMap(await renderApi(key, `/services/${svc.id}/env-vars`));
    if (String(cronEnvs.MONITORING_CRON_SECRET || '') !== secret) {
      await upsertEnv(key, svc.id, 'MONITORING_CRON_SECRET', secret);
      report.actions.push(`${name} synced MONITORING_CRON_SECRET`);
    } else {
      report.actions.push(`${name} MONITORING_CRON_SECRET already matches`);
    }
    if (String(cronEnvs.NEXT_PUBLIC_API_BASE || '') !== PROD_API) {
      await upsertEnv(key, svc.id, 'NEXT_PUBLIC_API_BASE', PROD_API);
      report.actions.push(`${name} set NEXT_PUBLIC_API_BASE`);
    }
    if (name === PLATFORM_CRON) {
      if (String(cronEnvs.PLATFORM_OPS_JOBS || '') !== PLATFORM_OPS_JOBS) {
        await upsertEnv(key, svc.id, 'PLATFORM_OPS_JOBS', PLATFORM_OPS_JOBS);
        report.actions.push(`${name} PLATFORM_OPS_JOBS -> live-refresh (+ops), no x-autoposter-run`);
      }
    }
  }

  if (args.has('--deploy')) {
    const deploy = await renderApi(key, `/services/${web.id}/deploys`, {
      method: 'POST',
      body: JSON.stringify({ clearCache: 'do_not_clear' }),
    });
    const row = deploy.deploy || deploy;
    report.deploy = { id: row.id, status: row.status || 'started' };
    console.log('Waiting for deploy', row.id, '...');
    let live = false;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 10000));
      const rows = await renderApi(key, `/services/${web.id}/deploys?limit=5`);
      const cur = ((rows || []).map((x) => x.deploy || x).find((x) => x.id === row.id)) || {};
      console.log('deploy poll', i, cur.status || '?');
      if (cur.status === 'live') { live = true; break; }
      if (['build_failed', 'update_failed', 'canceled', 'deactivated'].includes(cur.status)) {
        throw new Error('deploy failed: ' + cur.status);
      }
    }
    if (!live) throw new Error('deploy not live in time');
    report.deploy.status = 'live';
  }

  if (args.has('--trigger')) {
    const pin = env.OPS_ADMIN_PIN || env.MONITORING_CRON_SECRET || secret;
    const headers = {
      'Content-Type': 'application/json',
      'x-ops-pin': pin,
      'x-cron-secret': secret,
      'x-monitoring-cron': secret,
      'X-Ingest-Secret': secret,
    };
    const live = await fetch(`${PROD_API}/api/ops/run-job`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jobId: 'live-refresh' }),
    });
    const liveText = await live.text();
    report.triggerLiveRefresh = { status: live.status, body: liveText.slice(0, 240) };

    const beat = await fetch(`${PROD_API}/api/recruiting/beat-writer/ingest`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ force: true }),
    });
    const beatText = await beat.text();
    report.triggerBeatWriter = { status: beat.status, body: beatText.slice(0, 240) };
  }

  const status = await fetch(`${PROD_API}/api/live/beat/status`).then((r) => r.json());
  const health = await fetch(`${PROD_API}/api/live/pipeline/health`).then((r) => r.json());
  report.verify = {
    beat: {
      configured: status?.status?.configured,
      ok: status?.status?.ok,
      postCount: status?.cache?.postCount,
      source: status?.cache?.source,
      fetchedAt: status?.cache?.fetchedAt,
      error: status?.cache?.error || null,
    },
    pipeline: {
      lastLiveRefresh: health?.health?.lastLiveRefresh || null,
      lastBeatPull: health?.health?.lastBeatPull || null,
      liveRefreshStale: health?.checks?.liveRefreshStale,
      beatPullStale: health?.checks?.beatPullStale,
      beatError: health?.checks?.beatError || null,
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
