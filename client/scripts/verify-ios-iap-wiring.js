#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const checks = [
  ['client/lib/ios-iap.ts', 'purchaseIosSubscription'],
  ['client/lib/subscription-api.ts', 'verifyApplePurchase'],
  ['client/lib/native-shell.ts', 'initIosPurchaseListeners'],
  ['client/components/vault/AccountMembershipPage.tsx', 'handleSubscribe'],
  ['server/lib/apple-iap-verify.js', 'verifyStoreKitTransaction'],
  ['server/lib/subscription-routes.js', '/api/subscription/apple/verify'],
];

const pkg = JSON.parse(
  fs.readFileSync(path.join(root, 'client', 'package.json'), 'utf8')
);
const failures = [];

if (!pkg.dependencies?.['@capgo/native-purchases']) {
  failures.push('missing @capgo/native-purchases dependency in client/package.json');
}

for (const [rel, needle] of checks) {
  const file = path.join(root, rel.replace(/\//g, path.sep));
  if (!fs.existsSync(file)) {
    failures.push(`missing file: ${rel}`);
    continue;
  }
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(needle)) {
    failures.push(`${rel} missing: ${needle}`);
  }
}

if (failures.length) {
  console.error('[verify-ios-iap] FAIL');
  failures.forEach((f) => console.error(' -', f));
  process.exit(1);
}

console.log('[verify-ios-iap] OK');
