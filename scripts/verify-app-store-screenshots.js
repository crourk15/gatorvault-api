#!/usr/bin/env node
/** Validate App Store screenshot assets (6.5" + optional iPad 13"). */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SHOT_DIR = path.join(ROOT, 'docs', 'app-store-screenshots');
const IPAD_DIR = path.join(SHOT_DIR, 'ipad-13');
const IPHONE_FILES = [
  '01-futurecast.png',
  '02-recruiting.png',
  '03-team.png',
  '04-community.png',
  '05-membership.png',
  '06-live-feed.png',
];
const IPHONE_W = 1284;
const IPHONE_H = 2778;
const IPAD_W = 2064;
const IPAD_H = 2752;
const MAX_AGE_DAYS = Number(process.env.APP_STORE_SCREENSHOT_MAX_AGE_DAYS || 30);

const results = [];
const pass = (name, message) => results.push({ name, status: 'PASS', message });
const fail = (name, message) => results.push({ name, status: 'FAIL', message });
const warn = (name, message) => results.push({ name, status: 'WARN', message });

function pngDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function checkPng(name, filePath, expectedW, expectedH) {
  if (!fs.existsSync(filePath)) {
    fail(name, 'missing file');
    return;
  }
  const dims = pngDimensions(filePath);
  if (!dims) {
    fail(name, 'invalid PNG');
    return;
  }
  if (dims.width !== expectedW || dims.height !== expectedH) {
    fail(name, `${dims.width}x${dims.height} (expected ${expectedW}x${expectedH})`);
    return;
  }
  pass(name, `${dims.width}x${dims.height}`);
}

function checkManifestAge() {
  const manifestPath = path.join(SHOT_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    warn('manifest', 'missing manifest.json');
    return;
  }
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const generatedAt = manifest.generatedAt ? Date.parse(manifest.generatedAt) : NaN;
    if (!Number.isFinite(generatedAt)) {
      warn('manifest-age', 'no generatedAt');
      return;
    }
    const ageDays = (Date.now() - generatedAt) / (24 * 60 * 60 * 1000);
    if (ageDays > MAX_AGE_DAYS) {
      warn('manifest-age', `${Math.floor(ageDays)}d old — recapture with npm run capture:app-store-screenshots`);
    } else {
      pass('manifest-age', `${Math.floor(ageDays)}d old`);
    }
  } catch {
    warn('manifest', 'could not parse manifest.json');
  }
}

function main() {
  for (const file of IPHONE_FILES) {
    checkPng(`iphone-${file}`, path.join(SHOT_DIR, file), IPHONE_W, IPHONE_H);
  }
  checkManifestAge();

  if (fs.existsSync(IPAD_DIR)) {
    for (const file of IPHONE_FILES) {
      const ipadName = file.replace('.png', '-ipad-13.png');
      checkPng(`ipad-${ipadName}`, path.join(IPAD_DIR, ipadName), IPAD_W, IPAD_H);
    }
  } else {
    warn('ipad-dir', 'ipad-13/ missing — run node scripts/generate-ipad-app-store-screenshots.js');
  }

  const summary = {
    pass: results.filter((r) => r.status === 'PASS').length,
    fail: results.filter((r) => r.status === 'FAIL').length,
    warn: results.filter((r) => r.status === 'WARN').length,
    results,
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.fail > 0 ? 1 : 0);
}

main();
