const fs = require('fs');
const path = require('path');

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

let src = fs.readFileSync(podspecPath, 'utf8');

if (src.includes('storekit_swift_flags = has_storekit_265_sdk?')) {
  console.log('[patch-capgo-podspec] already patched');
  process.exit(0);
}

// Undo broken :: patch if present
src = src.replace(
  "'OTHER_SWIFT_FLAGS' => ::has_storekit_265_sdk? ? '$(inherited) -D STOREKIT_26_5' : '$(inherited)'",
  "'OTHER_SWIFT_FLAGS' => has_storekit_265_sdk? ? '$(inherited) -D STOREKIT_26_5' : '$(inherited)'"
);

const needle = "'OTHER_SWIFT_FLAGS' => has_storekit_265_sdk? ? '$(inherited) -D STOREKIT_26_5' : '$(inherited)'";
if (!src.includes(needle)) {
  console.error('[patch-capgo-podspec] unexpected podspec — manual check required');
  process.exit(1);
}

src = src.replace(
  'Pod::Spec.new do |s|',
  "storekit_swift_flags = has_storekit_265_sdk? ? '$(inherited) -D STOREKIT_26_5' : '$(inherited)'\n\nPod::Spec.new do |s|"
);
src = src.replace(needle, "'OTHER_SWIFT_FLAGS' => storekit_swift_flags");

fs.writeFileSync(podspecPath, src, 'utf8');
console.log('[patch-capgo-podspec] OK — hoisted StoreKit flags before Pod::Spec.new');