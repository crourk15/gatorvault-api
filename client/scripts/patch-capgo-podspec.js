const fs = require('fs');
const path = require('path');

const MARKER = '# gatorvault: static storekit flags';
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

if (src.includes(MARKER)) {
  console.log('[patch-capgo-podspec] already patched');
  process.exit(0);
}

// Drop partial patches from earlier attempts
src = src.replace(/\nstorekit_swift_flags = has_storekit_265_sdk\?[^\n]*\n\n?/g, '\n');
src = src.replace(
  /def has_storekit_265_sdk\?[\s\S]*?^end\n/m,
  ''
);

const xcconfigBlock =
  "  s.pod_target_xcconfig = {\n" +
  `    'OTHER_SWIFT_FLAGS' => '$(inherited)' ${MARKER}\n` +
  '  }';

if (!src.match(/s\.pod_target_xcconfig\s*=\s*\{/)) {
  console.error('[patch-capgo-podspec] unexpected podspec — missing pod_target_xcconfig');
  process.exit(1);
}

src = src.replace(/s\.pod_target_xcconfig\s*=\s*\{[\s\S]*?\n  \}/m, xcconfigBlock);

fs.writeFileSync(podspecPath, src, 'utf8');
console.log('[patch-capgo-podspec] OK — static OTHER_SWIFT_FLAGS for CocoaPods CI');