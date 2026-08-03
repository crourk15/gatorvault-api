#!/usr/bin/env node
/**
 * Guard: native cold start must open Sign in (App Review 2.1 login completeness).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const checks = [
  {
    file: 'lib/native-app-entry.ts',
    mustInclude: ["/join/?mode=signin&next=/vault/"],
    mustNotInclude: ["mode=signup", "hasRememberedEmail"],
  },
  {
    file: 'lib/native-boot-script.ts',
    mustInclude: ["'/join/?mode=signin&next=/vault/'"],
    mustNotInclude: ["mode=signup&next=/vault/"],
  },
];

let failed = false;
for (const check of checks) {
  const abs = path.join(root, check.file);
  const text = fs.readFileSync(abs, 'utf8');
  for (const needle of check.mustInclude) {
    if (!text.includes(needle)) {
      console.error(`[verify-native-login-entry] FAIL — ${check.file} missing ${needle}`);
      failed = true;
    }
  }
  for (const needle of check.mustNotInclude) {
    if (text.includes(needle)) {
      console.error(`[verify-native-login-entry] FAIL — ${check.file} still contains ${needle}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}
console.log('[verify-native-login-entry] OK — native cold start opens Sign in');
