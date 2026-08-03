#!/usr/bin/env node
/**
 * Static iOS smoke aggregator — wiring that must stay green before TestFlight.
 * Device/StoreKit/APNs remain a manual checklist (printed at end).
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..', '..');
const steps = [
  ['verify-ios-iap-wiring.js', 'IAP wiring'],
  ['verify-ios-app-icon.js', 'App icon asset'],
  ['verify-native-deep-link.js', 'Native deep-link parsing'],
  ['verify-native-login-entry.js', 'Native Sign in cold start'],
];

let failed = false;
for (const [script, label] of steps) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], {
    stdio: 'inherit',
    cwd: root,
  });
  if (result.status !== 0) {
    console.error('[verify-ios-smoke] FAIL — ' + label);
    failed = true;
  } else {
    console.log('[verify-ios-smoke] OK — ' + label);
  }
}

const spa = spawnSync(process.execPath, [path.join(__dirname, 'check-native-spa-nav.mjs')], {
  stdio: 'inherit',
  cwd: root,
});
if (spa.status !== 0) {
  console.error('[verify-ios-smoke] FAIL — native SPA nav mapping');
  failed = true;
} else {
  console.log('[verify-ios-smoke] OK — native SPA nav mapping');
}

const presence = [
  ['client/components/vault/VaultAlertsPage.tsx', 'buildSeedAlerts'],
  ['client/components/vault/VaultFilmRoomPage.tsx', 'buildSeedFilmRoomCatalog'],
  ['client/components/vault/AccountMembershipPage.tsx', 'MembershipTierMarketing'],
  ['client/components/vault/AccountMembershipPage.tsx', 'handleSubscribe'],
  ['client/lib/auth-api.ts', 'verifyStoredSession'],
  ['client/lib/ios-iap.ts', 'purchaseIosSubscription'],
  ['client/lib/ios-iap.ts', 'getPurchases'],
  ['client/lib/native-shell.ts', 'appUrlOpen'],
  ['client/ios/App/App/App.entitlements', 'associated-domains'],
];
for (const [rel, needle] of presence) {
  const file = path.join(root, rel);
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(needle)) {
    console.error('[verify-ios-smoke] FAIL — ' + rel + ' missing ' + needle);
    failed = true;
  }
}

if (failed) {
  console.error('');
  console.error('[verify-ios-smoke] BLOCKED');
  process.exit(1);
}

console.log('[verify-ios-smoke] OK — static wiring green');
console.log('');
console.log('Manual TestFlight checklist (device):');
console.log('  1. Cold launch → Home / Recruiting / Team paint without blank shells');
console.log('  2. Sign in → Membership shows tier (not bare redirect)');
console.log('  3. Alerts → feed paints; push pref toggles persist');
console.log('  4. Film Room → catalog paints; locked items show Film tier CTA');
console.log('  5. IAP sandbox purchase + restore on Membership');
console.log('  6. Account delete panel reachable from Membership');
process.exit(0);
