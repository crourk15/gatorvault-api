'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
  path.join(__dirname, '../../../netlify/edge-functions/scrub-denied-visits.js'),
  'utf8'
);

test('ticker edge strips the 1.0.29 App Store line and falls back when origin 502s', () => {
  assert.match(src, /APP_STORE_UPDATE_RE/);
  assert.match(src, /now-edge-fallback/);
  assert.match(src, /4-0 heading into Saturday/);
  assert.match(src, /Missouri at Faurot Field/);
  assert.match(src, /if \(isTickerPath\(url\.pathname\) && !upstream\.ok\)/);
  assert.equal(/1\.0\.29 is live/.test(src), false);
});
