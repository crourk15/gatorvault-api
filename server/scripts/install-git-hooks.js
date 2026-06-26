#!/usr/bin/env node
/**
 * Install repo git hooks (pre-commit encoding + FutureCast mount guard).
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const HOOK_SRC = path.join(__dirname, 'git-hooks', 'pre-commit');
const HOOK_DST = path.join(ROOT, '.git', 'hooks', 'pre-commit');

function main() {
  if (!fs.existsSync(path.join(ROOT, '.git'))) {
    console.error('[hooks] Not a git repository — skipped');
    process.exit(1);
  }
  if (!fs.existsSync(HOOK_SRC)) {
    console.error('[hooks] Missing template:', HOOK_SRC);
    process.exit(1);
  }

  const body = fs.readFileSync(HOOK_SRC, 'utf8');
  fs.mkdirSync(path.dirname(HOOK_DST), { recursive: true });
  fs.writeFileSync(HOOK_DST, body, { encoding: 'utf8', mode: 0o755 });
  console.log('[hooks] Installed pre-commit -> .git/hooks/pre-commit');
  console.log('[hooks] Runs: node server/scripts/encoding-check.js --staged --mount');
}

main();