#!/usr/bin/env node
/**
 * Orchestrator: warm API → ensure local server → run N full-mobile passes.
 * Default 3 passes (user requirement). Blocks deploy/push when any pass fails.
 */
const http = require('http');
const https = require('https');
const { spawn, spawnSync } = require('child_process');
const path = require('path');

const BASE = process.env.VERIFY_BASE || 'http://127.0.0.1:8787';
const PASSES = Number(process.env.VERIFY_PASSES || 3);
const API_ORIGIN = process.env.API_ORIGIN || 'https://gatorvault-api.onrender.com';
const WARM_TIMEOUT_MS = Number(process.env.VERIFY_WARM_MS || 120_000);

const WARM_PATHS = [
  '/api/health',
  '/api/recruiting/board',
  '/api/recruiting/heat-index',
  '/api/roster/players',
  '/api/futurecast/home',
  '/api/futurecast/master-board',
  '/api/articles/published?limit=5',
  '/api/film-room/catalog',
  '/api/live/dashboard',
];

function fetchJson(url, timeoutMs = 25_000) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode }));
    });
    req.on('error', () => resolve({ ok: false, status: 0 }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 0 });
    });
  });
}

async function warmApi() {
  console.log(`[run-full-mobile-verify] warming API (${API_ORIGIN})…`);
  const deadline = Date.now() + WARM_TIMEOUT_MS;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    const results = await Promise.all(WARM_PATHS.map((p) => fetchJson(`${API_ORIGIN}${p}`)));
    const okCount = results.filter((r) => r.ok).length;
    console.log(`  warm attempt ${attempt}: ${okCount}/${WARM_PATHS.length} endpoints ok`);
    if (okCount === WARM_PATHS.length) {
      console.log('[run-full-mobile-verify] API warm');
      return true;
    }
    await new Promise((r) => setTimeout(r, 3_000));
  }
  console.error('[run-full-mobile-verify] API did not warm in time — continuing (cold-start may fail routes)');
  return false;
}

function pingBase() {
  return new Promise((resolve) => {
    const req = http.get(`${BASE}/vault/`, { timeout: 5_000 }, (res) => {
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

async function ensureServer() {
  if (await pingBase()) {
    console.log(`[run-full-mobile-verify] server already up at ${BASE}`);
    return null;
  }

  console.log(`[run-full-mobile-verify] starting serve-local-netlify on ${BASE}…`);
  const script = path.join(__dirname, 'serve-local-netlify.js');
  const child = spawn(process.execPath, [script], {
    stdio: 'inherit',
    env: { ...process.env, PORT: String(new URL(BASE).port || 8787) },
  });

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await pingBase()) {
      console.log('[run-full-mobile-verify] local server ready');
      return child;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  child.kill();
  throw new Error('local server failed to start');
}

function runPass(passNum) {
  const script = path.join(__dirname, 'verify-full-mobile-app.js');
  const result = spawnSync(process.execPath, [script], {
    stdio: 'inherit',
    env: { ...process.env, VERIFY_BASE: BASE, VERIFY_PASS: String(passNum) },
  });
  return result.status === 0;
}

async function main() {
  await warmApi();
  const serverChild = await ensureServer();

  let allOk = true;
  for (let i = 1; i <= PASSES; i += 1) {
    console.log(`\n[run-full-mobile-verify] === pass ${i}/${PASSES} ===`);
    const ok = runPass(i);
    if (!ok) {
      allOk = false;
      break;
    }
  }

  if (serverChild) serverChild.kill();

  if (!allOk) {
    console.error(`\n[run-full-mobile-verify] BLOCKED — full mobile verification failed`);
    process.exit(1);
  }
  console.log(`\n[run-full-mobile-verify] OK — ${PASSES} consecutive passes`);
}

main().catch((err) => {
  console.error('[run-full-mobile-verify] fatal:', err);
  process.exit(1);
});
