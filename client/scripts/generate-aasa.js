/**
 * Write apple-app-site-association for iOS universal links (Step 8 prep).
 * Set APPLE_TEAM_ID in Netlify build env when the Apple Developer account is active.
 */
const fs = require('fs');
const path = require('path');

const BUNDLE_ID = 'com.gatorvaultinsider.app';
const serverDir = path.join(__dirname, '..', '..', 'server');
const teamId = String(process.env.APPLE_TEAM_ID || '').trim().toUpperCase();

const paths = [
  '/vault/*',
  '/privacy/*',
  '/terms/*',
  '/join/*',
  '/welcome/*',
  '/recruiting-hub/*',
  '/futurecast/*',
];

const doc = {
  applinks: {
    apps: [],
    details: teamId
      ? [
          {
            appIDs: [`${teamId}.${BUNDLE_ID}`],
            paths,
          },
        ]
      : [],
  },
  webcredentials: teamId
    ? {
        apps: [`${teamId}.${BUNDLE_ID}`],
      }
    : {
        apps: [],
      },
};

const json = JSON.stringify(doc, null, 2);
const targets = [
  path.join(serverDir, '.well-known', 'apple-app-site-association'),
  path.join(serverDir, 'apple-app-site-association'),
];

for (const target of targets) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, json, 'utf8');
}

if (teamId) {
  console.log(`[aasa] Wrote universal links for ${teamId}.${BUNDLE_ID}`);
} else {
  console.warn(
    '[aasa] APPLE_TEAM_ID not set — published empty AASA shell. Set env before App Store universal links go live.'
  );
}