const fs = require('fs');
const path = require('path');

const iconPath = path.join(
  __dirname,
  '..',
  'ios',
  'App',
  'App',
  'Assets.xcassets',
  'AppIcon.appiconset',
  'AppIcon-512@2x.png'
);

if (!fs.existsSync(iconPath)) {
  console.error('[verify-ios-app-icon] missing AppIcon-512@2x.png');
  process.exit(1);
}

const buf = fs.readFileSync(iconPath);
if (buf.length < 24 || buf.toString('ascii', 12, 16) !== 'IHDR') {
  console.error('[verify-ios-app-icon] not a valid PNG');
  process.exit(1);
}

const width = buf.readUInt32BE(16);
const height = buf.readUInt32BE(20);

if (width !== 1024 || height !== 1024) {
  console.error(`[verify-ios-app-icon] expected 1024x1024, got ${width}x${height}`);
  process.exit(1);
}

console.log('[verify-ios-app-icon] OK 1024x1024');