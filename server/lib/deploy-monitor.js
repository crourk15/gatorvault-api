/**
 * GV-OM deployment tracking — Render API + Netlify frontend.
 */
const fs = require('fs');
const path = require('path');

const DEPLOY_PATH = path.join(__dirname, '..', 'data', 'ops', 'deploy-state.json');
const FRONTEND_VERSION_PATH = path.join(__dirname, '..', 'ops-version.json');
const CONFIG_PATH = path.join(__dirname, '..', 'data', 'ops', 'ops-alerts-config.json');

function nowIso() {
  return new Date().toISOString();
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function loadConfig() {
  return readJson(CONFIG_PATH, { thresholds: { deployStaleDays: 7 } });
}

function loadDeployState() {
  return readJson(DEPLOY_PATH, { version: 1, updatedAt: null, api: null, frontend: null });
}

function saveDeployState(state) {
  fs.mkdirSync(path.dirname(DEPLOY_PATH), { recursive: true });
  state.updatedAt = nowIso();
  fs.writeFileSync(DEPLOY_PATH, JSON.stringify(state, null, 2));
  return state;
}

function readFrontendVersionFile() {
  return readJson(FRONTEND_VERSION_PATH, null);
}

function recordApiBoot() {
  const state = loadDeployState();
  const prevCommit = state.api?.commit || null;
  const nextCommit =
    process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || process.env.COMMIT_REF || null;

  state.api = {
    service: 'render',
    timestamp: nowIso(),
    commit: nextCommit,
    branch: process.env.RENDER_GIT_BRANCH || process.env.BRANCH || null,
    deployId: process.env.RENDER_SERVICE_ID || null,
    nodeEnv: process.env.NODE_ENV || 'development',
    version: nextCommit?.slice(0, 7) || null
  };

  if (nextCommit && nextCommit !== prevCommit) {
    delete state.lastSmokeTest;
    delete state.lastFailedCheck;
    if (
      state.lastHealthRecompute?.deployId &&
      state.lastHealthRecompute.deployId !== String(nextCommit).slice(0, 12)
    ) {
      delete state.lastHealthRecompute;
    }
  }

  return saveDeployState(state);
}

function recordFrontendDeploy(payload = {}) {
  const state = loadDeployState();
  const fileMeta = readFrontendVersionFile();
  const apiCommit =
    process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || process.env.COMMIT_REF || null;
  const apiShort = apiCommit ? String(apiCommit).slice(0, 7) : null;

  // Monorepo deploy: Netlify + Render ship from main — align frontend pin to live API commit at boot.
  const feCommit = payload.commit || apiShort || fileMeta?.commit || null;

  state.frontend = {
    service: 'netlify',
    timestamp: payload.timestamp || nowIso(),
    commit: feCommit,
    deployId: payload.deployId || process.env.NETLIFY_DEPLOY_ID || null,
    site: payload.site || fileMeta?.site || 'gatorvaultinsider.com',
    version: feCommit ? String(feCommit).slice(0, 7) : null,
    syncedFromApi: Boolean(apiShort && !payload.commit)
  };
  return saveDeployState(state);
}

function deployGateMaxAgeMs(kind) {
  if (kind === 'smoke') {
    return parseInt(process.env.DEPLOY_SMOKE_GATE_MAX_AGE_MS || String(48 * 3600000), 10);
  }
  return parseInt(process.env.DEPLOY_HEALTH_GATE_MAX_AGE_MS || String(24 * 3600000), 10);
}

function gateIsCurrent(gate, currentCommit) {
  if (!gate?.checkedAt && !gate?.at) return false;
  const at = gate.checkedAt || gate.at;
  const ageMs = Date.now() - new Date(at).getTime();
  if (!Number.isFinite(ageMs) || ageMs > deployGateMaxAgeMs(gate.kind)) return false;
  const gateCommit = gate.deployCommit || gate.deployId || null;
  if (gateCommit && currentCommit && !String(currentCommit).startsWith(String(gateCommit))) {
    return false;
  }
  return true;
}

function getDeployReport() {
  const state = loadDeployState();
  const fileMeta = readFrontendVersionFile();
  const config = loadConfig();
  const staleDays = config.thresholds?.deployStaleDays || 7;
  const staleMs = staleDays * 86400000;

  const api = state.api || {
    timestamp: null,
    commit: process.env.RENDER_GIT_COMMIT || null,
    version: (process.env.RENDER_GIT_COMMIT || '').slice(0, 7) || null
  };

  const liveApiCommit = process.env.RENDER_GIT_COMMIT || null;
  const liveApiShort = liveApiCommit ? String(liveApiCommit).slice(0, 7) : null;
  if (liveApiShort) {
    api.commit = liveApiCommit;
    api.version = liveApiShort;
  }

  const frontend =
    state.frontend ||
    (fileMeta
      ? {
          timestamp: fileMeta.builtAt,
          commit: fileMeta.commit,
          version: (fileMeta.commit || '').slice(0, 7),
          site: fileMeta.site
        }
      : { timestamp: null, commit: null, version: null });

  // Prefer boot-synced frontend version when API and frontend deploy from same monorepo push.
  if (state.frontend?.syncedFromApi && liveApiShort) {
    frontend.commit = liveApiCommit;
    frontend.version = liveApiShort;
  }

  const apiAge = api.timestamp ? Date.now() - new Date(api.timestamp).getTime() : null;
  const feAge = frontend.timestamp ? Date.now() - new Date(frontend.timestamp).getTime() : null;

  const apiCommit = (api.commit || '').slice(0, 7);
  const feCommit = (frontend.commit || '').slice(0, 7);
  const mismatch = apiCommit && feCommit && apiCommit !== feCommit;

  let status = 'green';
  if (mismatch) status = 'red';
  else if (state.lastGuardianCheck && state.lastGuardianCheck.ok === false) status = 'red';
  else if (
    state.lastSmokeTest &&
    state.lastSmokeTest.ok === false &&
    gateIsCurrent({ ...state.lastSmokeTest, kind: 'smoke' }, api.commit)
  ) {
    status = 'red';
  } else if (
    state.lastHealthRecompute?.overall != null &&
    state.lastHealthRecompute.overall < 70 &&
    gateIsCurrent({ ...state.lastHealthRecompute, kind: 'health' }, api.commit)
  ) {
    status = 'red';
  } else if (
    (apiAge != null && apiAge > staleMs) ||
    (feAge != null && feAge > staleMs) ||
    !api.timestamp ||
    !frontend.timestamp
  ) {
    status = 'yellow';
  }

  return {
    status,
    mismatch,
    staleDays,
    api: {
      ...api,
      ageMs: apiAge,
      stale: apiAge != null && apiAge > staleMs
    },
    frontend: {
      ...frontend,
      ageMs: feAge,
      stale: feAge != null && feAge > staleMs
    },
    guardian: state.lastGuardianCheck || null,
    smokeTest: state.lastSmokeTest || null,
    healthRecompute: state.lastHealthRecompute || null,
    lastFailedCheck: state.lastFailedCheck || null,
    updatedAt: state.updatedAt
  };
}

function recordSmokeTest(result) {
  const state = loadDeployState();
  state.lastSmokeTest = {
    ok: result.ok,
    checkedAt: result.checkedAt || nowIso(),
    failed: result.failed || [],
    site: result.site || null,
    deployCommit:
      result.deployCommit ||
      process.env.RENDER_GIT_COMMIT ||
      state.api?.commit ||
      null
  };
  if (!result.ok) {
    state.lastFailedCheck = {
      type: 'smoke-test',
      at: state.lastSmokeTest.checkedAt,
      errors: result.failed
    };
  }
  return saveDeployState(state);
}

function recordGuardianCheck(result) {
  const state = loadDeployState();
  state.lastGuardianCheck = {
    ok: result.ok,
    phase: result.phase || 'pre',
    checkedAt: result.checkedAt || nowIso(),
    errors: result.errors || []
  };
  if (!result.ok) {
    state.lastFailedCheck = {
      type: 'guardian-pre',
      at: state.lastGuardianCheck.checkedAt,
      errors: result.errors
    };
  }
  return saveDeployState(state);
}

function recordHealthRecompute(payload = {}) {
  const state = loadDeployState();
  state.lastHealthRecompute = {
    at: payload.at || nowIso(),
    overall: payload.overall ?? null,
    deployId: payload.deployId || process.env.RENDER_GIT_COMMIT?.slice(0, 12) || null,
    source: payload.source || 'deploy-boot'
  };
  return saveDeployState(state);
}

module.exports = {
  recordApiBoot,
  recordFrontendDeploy,
  getDeployReport,
  loadDeployState,
  readFrontendVersionFile,
  recordSmokeTest,
  recordGuardianCheck,
  recordHealthRecompute,
  gateIsCurrent,
  deployGateMaxAgeMs
};
