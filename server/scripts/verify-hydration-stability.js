#!/usr/bin/env node
/**
 * Pre-deploy hydration stability gate — run before ANY Netlify publish.
 * Blocks deploy when HTML/JS mismatch, SSR markers, or CSS load order fail.
 *
 * Usage: node server/scripts/verify-hydration-stability.js
 */
const path = require('path');
const { runLocalHydrationChecks } = require('../lib/hydration/hydration-checks');

const ROOT = path.join(__dirname, '..');
const { ok, errors } = runLocalHydrationChecks(ROOT);

console.log('[hydration-stability] Pre-deploy checklist');
if (ok) {
  console.log('  ✓ A HTML/JS match + build ID');
  console.log('  ✓ B SSR markers on all pillar pages');
  console.log('  ✓ C vault-shell + layout CSS before scripts');
  console.log('  ✓ E no skeleton hydration gate in SSR');
  console.log('  ✓ F mobile Safari viewport + safe-area');
  process.exit(0);
}

console.error('[hydration-stability] FAIL — deploy blocked');
for (const err of errors) console.error('  ✗', err);
process.exit(1);
