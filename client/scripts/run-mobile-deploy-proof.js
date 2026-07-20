#!/usr/bin/env node
/**
 * Full pre-deploy proof pipeline:
 *   1. Warm Render API
 *   2. Ensure local Netlify mirror is serving server/
 *   3. Capture proof package (screenshots, recordings, checklist)
 *   4. Run 3-pass full mobile verification
 *   5. Optionally verify production Netlify build (--verify-production)
 *
 * Blocks push/deploy when any step fails.
 */
const http = require('http');
const https = require('https');
const { spawn, spawnSync } = require('child_process');
const path = require('path');

const BASE = process.env.PROOF_BASE || process.env.VERIFY_BASE || 'http://127.0.0.1:8787';
const API_ORIGIN = process.env.API_ORIGIN || 'https://gatorvault-api.onrender.com';
/** User policy: minimum 3 consecutive full-mobile passes before deploy. */
const VERIFY_PASSES = Math.max(3, Number(process.env.VERIFY_PASSES || 3));
const VERIFY_PRODUCTION = process.argv.includes('--verify-production');

const WARM_PATHS = [
  '/api/health',
  '/api/recruiting/board',
  '/api/recruiting/heat-index',
  '/api/roster/players',
  '/api/futurecast/home',
  '/api/futurecast/master-board',
];

function fetchOk(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 25_000 }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
  });
}

async function warmApi() {
  console.log('[deploy-proof] warming API…');
  for (let i = 0; i < 20; i += 1) {
    const results = await Promise.all(WARM_PATHS.map((p) => fetchOk(`${API_ORIGIN}${p}`)));
    if (results.every(Boolean)) {
      console.log('[deploy-proof] API warm');
      return;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.warn('[deploy-proof] API warm incomplete — proof may show cold-start failures');
}

function isRemoteBase(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || (u.hostname !== '127.0.0.1' && u.hostname !== 'localhost');
  } catch {
    return false;
  }
}

function pingBase() {
  return new Promise((resolve) => {
    const lib = BASE.startsWith('https:') ? https : http;
    const req = lib.get(`${BASE}/vault/`, { timeout: 10_000 }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

function killListenersOnPort(port) {
  // After build:netlify, a stale serve-local-netlify can keep serving old chunk
  // hashes and flake FutureCast/NIL verify with ChunkLoadError. Always clear.
  try {
    spawnSync('fuser', ['-k', `${port}/tcp`], { stdio: 'ignore' });
  } catch {
    /* fuser optional */
  }
  try {
    const listed = spawnSync('lsof', ['-t', `-iTCP:${port}`, '-sTCP:LISTEN'], {
      encoding: 'utf8',
    });
    const pids = String(listed.stdout || '')
      .split(/\s+/)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n > 0);
    for (const pid of pids) {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        /* already gone */
      }
    }
  } catch {
    /* lsof optional */
  }
}

async function ensureServer() {
  // Production / remote HTTPS — never kill or spawn local static server.
  if (isRemoteBase(BASE)) {
    if (!(await pingBase())) {
      throw new Error(`remote PROOF_BASE not reachable: ${BASE}`);
    }
    console.log(`[deploy-proof] using remote proof base ${BASE}`);
    return null;
  }

  const port = Number(new URL(BASE).port || 8787);
  // Deploy proof always restarts so the just-built server/ tree is what we verify.
  if (await pingBase()) {
    console.log(`[deploy-proof] restarting local server on ${port} for fresh build…`);
    killListenersOnPort(port);
    await new Promise((r) => setTimeout(r, 800));
  }
  const script = path.join(__dirname, 'serve-local-netlify.js');
  const child = spawn(process.execPath, [script], {
    stdio: 'inherit',
    env: { ...process.env, PORT: String(port) },
  });
  for (let i = 0; i < 60; i += 1) {
    if (await pingBase()) return child;
    await new Promise((r) => setTimeout(r, 500));
  }
  child.kill();
  throw new Error('local server failed to start');
}

function runNode(script, extraEnv = {}) {
  const result = spawnSync(process.execPath, [script], {
    stdio: 'inherit',
    env: { ...process.env, PROOF_BASE: BASE, VERIFY_BASE: BASE, ...extraEnv },
  });
  return result.status === 0;
}

async function main() {
  await warmApi();
  const serverChild = await ensureServer();

  console.log('\n[deploy-proof] === Step 1: capture proof package ===');
  const proofOk = runNode(path.join(__dirname, 'capture-mobile-deploy-proof.js'));

  console.log('\n[deploy-proof] === Step 2: full mobile verification (3 passes) ===');
  const verifyOk = runNode(path.join(__dirname, 'run-full-mobile-verify.js'), {
    VERIFY_PASSES: String(VERIFY_PASSES),
  });

  let netlifyOk = true;
  if (VERIFY_PRODUCTION) {
    console.log('\n[deploy-proof] === Step 3: Netlify production build match ===');
    netlifyOk = runNode(path.join(__dirname, 'verify-netlify-build-match.js'));
  }

  if (serverChild) serverChild.kill();

  if (!proofOk || !verifyOk || !netlifyOk) {
    console.error('\n[deploy-proof] BLOCKED — proof package incomplete or checks failed');
    console.error('[deploy-proof] Review: proof/mobile-deploy-proof/');
    process.exit(1);
  }

  console.log('\n[deploy-proof] OK — full proof package ready');
  console.log('[deploy-proof] Artifacts: proof/mobile-deploy-proof/');
  if (!VERIFY_PRODUCTION) {
    console.log('[deploy-proof] After Netlify deploy, run: npm run verify:netlify:build');
  }
}

main().catch((err) => {
  console.error('[deploy-proof] fatal:', err);
  process.exit(1);
});
