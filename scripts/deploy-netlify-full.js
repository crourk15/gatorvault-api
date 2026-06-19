#!/usr/bin/env node
/**
 * Full Netlify recovery deploy:
 *   1. Clean all publish artifacts (_next, vault-chunks, client out)
 *   2. build:netlify (merge + chunk rewrite + build ID stamp)
 *   3. Trigger Netlify build with clear_cache=true (optional)
 *   4. Purge Netlify CDN (optional)
 *
 * Env (optional for steps 3–4):
 *   NETLIFY_BUILD_HOOK_URL
 *   NETLIFY_AUTH_TOKEN
 *   NETLIFY_SITE_ID or NETLIFY_SITE_SLUG
 *
 * Usage:
 *   node scripts/deploy-netlify-full.js
 *   node scripts/deploy-netlify-full.js --skip-deploy --skip-purge   # local clean build only
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const skipDeploy = process.argv.includes('--skip-deploy');
const skipPurge = process.argv.includes('--skip-purge');

function run(label, cmd, args, opts = {}) {
  console.log(`\n[deploy-full] ▶ ${label}`);
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: opts.cwd || root,
    shell: false,
    env: { ...process.env, ...opts.env },
  });
  if (res.status !== 0) {
    console.error(`[deploy-full] ✗ ${label} failed (exit ${res.status ?? 1})`);
    process.exit(res.status || 1);
  }
}

run('Clean publish artifacts', process.execPath, [path.join(root, 'scripts', 'clean-publish-artifacts.js')]);

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
run('Netlify build pipeline', npmCmd, ['run', 'build:netlify']);

if (!skipDeploy && process.env.NETLIFY_BUILD_HOOK_URL) {
  run('Trigger Netlify deploy (clear_cache=true)', process.execPath, [
    path.join(root, 'scripts', 'trigger-netlify-deploy.js'),
  ]);
} else if (!skipDeploy) {
  console.warn('[deploy-full] Skipping Netlify deploy — set NETLIFY_BUILD_HOOK_URL to trigger remote build.');
}

if (!skipPurge && process.env.NETLIFY_AUTH_TOKEN) {
  run('Purge Netlify CDN', process.execPath, [path.join(root, 'scripts', 'purge-netlify-cdn.js')]);
} else if (!skipPurge) {
  console.warn('[deploy-full] Skipping CDN purge — set NETLIFY_AUTH_TOKEN to purge edge cache.');
}

const manifestPath = path.join(root, 'server', 'build-manifest.json');
try {
  const manifest = require(manifestPath);
  console.log('\n[deploy-full] ✓ Ready — buildId:', manifest.buildId, 'builtAt:', manifest.builtAt);
} catch {
  console.log('\n[deploy-full] ✓ Local build complete (commit server/ or push to Netlify).');
}

console.log('[deploy-full] Verify: npm run verify:hydration:production');
