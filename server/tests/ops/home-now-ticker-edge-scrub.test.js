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
  assert.match(src, /Missouri at Faurot Field — 3:30 PM · ESPN/);
  assert.match(src, /Samuel Bailey commits to Florida/);
  assert.match(src, /if \(isTickerPath\(url\.pathname\) && !upstream\.ok\)/);
  assert.equal(/1\.0\.29 is live/.test(src), false);
});

test('ticker edge rewrites leftover Cyion NOW News to Samuel Bailey', () => {
  assert.match(src, /pinBaileyNowNews/);
  assert.match(src, /STALE_NOW_NEWS_RE/);
  assert.match(src, /cyion\\s\+smith/);
});

test('hub edge pins 2028 hero at 3 commits and drops verified commits from battles', () => {
  assert.match(src, /hero-edge-fallback/);
  assert.match(src, /3 commits locked for 2028/);
  assert.match(src, /battleBoard/);
  assert.match(src, /cyion-smith/);
  assert.match(src, /samuel-bailey/);
});
