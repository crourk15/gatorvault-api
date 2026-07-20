#!/usr/bin/env node
/**
 * Load gitignored proof credentials into process.env, then run a script.
 * Usage: node client/scripts/load-proof-env.js client/scripts/run-mobile-deploy-proof.js --verify-production
 *
 * Looks for (first match wins for each key):
 *   - existing process.env
 *   - .env.proof.local (repo root)
 *   - .cursor/secrets.local.env
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const FILES = [
  path.join(ROOT, '.env.proof.local'),
  path.join(ROOT, '.cursor', 'secrets.local.env'),
];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const text = fs.readFileSync(filePath, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  }
  return out;
}

const loaded = {};
for (const file of FILES) {
  Object.assign(loaded, parseEnvFile(file));
}

for (const [k, v] of Object.entries(loaded)) {
  if (process.env[k] == null || process.env[k] === '') {
    process.env[k] = v;
  }
}

const present = Boolean(process.env.APP_REVIEW_PASSWORD);
console.log(
  present
    ? '[load-proof-env] APP_REVIEW_PASSWORD present'
    : '[load-proof-env] APP_REVIEW_PASSWORD missing (set Cursor Personal secret or .env.proof.local)'
);

const args = process.argv.slice(2);
if (!args.length) {
  process.exit(present ? 0 : 1);
}

const script = path.resolve(ROOT, args[0]);
const scriptArgs = args.slice(1);
const result = spawnSync(process.execPath, [script, ...scriptArgs], {
  stdio: 'inherit',
  env: process.env,
  cwd: ROOT,
});
process.exit(result.status == null ? 1 : result.status);
