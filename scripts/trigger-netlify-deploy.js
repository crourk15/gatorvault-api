/**
 * Trigger a Netlify production build with cache cleared.
 * Usage: NETLIFY_BUILD_HOOK_URL=https://api.netlify.com/... node scripts/trigger-netlify-deploy.js
 */
const fs = require('fs');
const path = require('path');

function loadEnvFile(relPath) {
  const file = path.join(__dirname, '..', relPath);
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile('server/.env');
loadEnvFile('.env');

const hook = process.env.NETLIFY_BUILD_HOOK_URL;
if (!hook) {
  console.error('Set NETLIFY_BUILD_HOOK_URL to your Netlify build hook URL.');
  process.exit(1);
}

const url = hook.includes('?') ? `${hook}&clear_cache=true` : `${hook}?clear_cache=true`;

fetch(url, { method: 'POST' })
  .then((res) => {
    if (!res.ok) {
      throw new Error(`Netlify build hook failed (${res.status})`);
    }
    console.log('Netlify build triggered with clear_cache=true');
  })
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
