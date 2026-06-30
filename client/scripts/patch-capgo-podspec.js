const fs = require('fs');
const path = require('path');

/** Capgo podspec helper must be called at top level (::) inside Pod::Spec.new on CI. */
const podspecPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@capgo',
  'native-purchases',
  'CapgoNativePurchases.podspec'
);

if (!fs.existsSync(podspecPath)) {
  console.log('[patch-capgo-podspec] skip — @capgo/native-purchases not installed');
  process.exit(0);
}

const before = fs.readFileSync(podspecPath, 'utf8');
const needle = "'OTHER_SWIFT_FLAGS' => has_storekit_265_sdk? ?";
const replacement = "'OTHER_SWIFT_FLAGS' => ::has_storekit_265_sdk? ?";

if (before.includes(replacement)) {
  console.log('[patch-capgo-podspec] already patched');
  process.exit(0);
}

if (!before.includes(needle)) {
  console.error('[patch-capgo-podspec] unexpected podspec — manual check required');
  process.exit(1);
}

fs.writeFileSync(podspecPath, before.replace(needle, replacement), 'utf8');
console.log('[patch-capgo-podspec] OK — fixed StoreKit helper call for CocoaPods');