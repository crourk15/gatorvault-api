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
  assert.match(src, /4-1 · SEC home Saturday/);
  assert.match(src, /South Carolina in the Swamp — 12:45 PM · SEC Network/);
  assert.match(src, /Samuel Bailey commits to Florida/);
  assert.match(src, /if \(isTickerPath\(url\.pathname\) && !upstream\.ok\)/);
  assert.equal(/1\.0\.29 is live/.test(src), false);
});

test('ticker edge rewrites leftover Missouri ESPN to ABC', () => {
  assert.match(src, /pinMissouriAbcNow/);
  assert.match(src, /MISSOURI_ESPN_NOW_RE/);
  assert.match(src, /replace\(\/\\bESPN\\b\/g, 'ABC'\)/);
});

test('ticker edge rewrites leftover Missouri week to South Carolina', () => {
  assert.match(src, /pinLeftoverMissouriNow/);
  assert.match(src, /LEFTOVER_MISSOURI_NOW_RE/);
  assert.match(src, /4-0 heading into saturday/);
  assert.match(src, /South Carolina in the Swamp — 12:45 PM · SEC Network/);
});

test('ticker edge one-shot busts iOS URLCache and pins the SC week pack', () => {
  assert.match(src, /pinCurrentScarNow/);
  assert.match(src, /applyNowCacheBust/);
  assert.match(src, /NOW_BUST_COOKIE = 'gv-now-bust'/);
  assert.match(src, /NOW_BUST_VALUE = 'scar-w6-secn'/);
  assert.match(src, /isSchedulePath/);
  assert.match(src, /isPingPath/);
  const toml = fs.readFileSync(path.join(__dirname, '../../../netlify.toml'), 'utf8');
  assert.match(toml, /path = "\/api\/schedule"/);
  assert.match(toml, /path = "\/api\/ping"/);
});

test('ticker edge rewrites leftover Cyion NOW News to Samuel Bailey', () => {
  assert.match(src, /pinBaileyNowNews/);
  assert.match(src, /STALE_NOW_NEWS_RE/);
  assert.match(src, /cyion\\s\+smith/);
  assert.match(src, /lorenzo\\s\+mcmullen/);
});

test('hub edge pins 2028 hero at 3 commits and drops verified commits from battles', () => {
  assert.match(src, /hero-edge-fallback/);
  assert.match(src, /3 commits locked for 2028/);
  assert.match(src, /battleBoard/);
  assert.match(src, /cyion-smith/);
  assert.match(src, /samuel-bailey/);
});
