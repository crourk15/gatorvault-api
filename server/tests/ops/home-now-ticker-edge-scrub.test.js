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
  assert.match(src, /4-2 heading into Saturday/);
  assert.match(src, /Texas at DKR-Texas Memorial Stadium — 12:00 PM · ABC/);
  assert.match(src, /Easton Royal flips to Florida · No\. 5/);
  assert.match(src, /if \(isTickerPath\(url\.pathname\) && !upstream\.ok\)/);
  assert.equal(/1\.0\.29 is live/.test(src), false);
});

test('ticker edge rewrites leftover Missouri ESPN to ABC', () => {
  assert.match(src, /pinMissouriAbcNow/);
  assert.match(src, /MISSOURI_ESPN_NOW_RE/);
  assert.match(src, /replace\(\/\\bESPN\\b\/g, 'ABC'\)/);
});

test('ticker edge rewrites leftover Missouri and South Carolina week to Texas', () => {
  assert.match(src, /pinLeftoverMissouriNow/);
  assert.match(src, /LEFTOVER_MISSOURI_NOW_RE/);
  assert.match(src, /4-0 heading into saturday/);
  assert.match(src, /south carolina/);
  assert.match(src, /visitors\\s\*\[—–-\]\\s\*easton royal/);
  assert.doesNotMatch(src, /\|easton royal\/i/);
  assert.match(src, /Texas at DKR-Texas Memorial Stadium — 12:00 PM · ABC/);
});

test('ticker edge one-shot busts iOS URLCache and pins the Texas week pack', () => {
  assert.match(src, /pinCurrentTexasNow/);
  assert.match(src, /applyNowCacheBust/);
  assert.match(src, /NOW_BUST_COOKIE = 'gv-now-bust'/);
  assert.match(src, /NOW_BUST_VALUE = 'texas-abc-ios'/);
  assert.match(src, /isSchedulePath/);
  assert.match(src, /isPingPath/);
  const toml = fs.readFileSync(path.join(__dirname, '../../../netlify.toml'), 'utf8');
  assert.match(toml, /path = "\/api\/schedule"/);
  assert.match(toml, /path = "\/api\/ping"/);
  assert.match(toml, /function = "now-ios-bust"/);
  assert.match(toml, /path = "\/api\/push\/device"/);
  assert.match(toml, /path = "\/api\/member-activity\/ping"/);
});

test('ticker edge rewrites leftover Cyion / Bailey NOW News to the Texas road line', () => {
  assert.match(src, /pinBaileyNowNews/);
  assert.match(src, /STALE_NOW_NEWS_RE/);
  assert.match(src, /cyion\\s\+smith/);
  assert.match(src, /lorenzo\\s\+mcmullen/);
  assert.match(src, /samuel\\s\+bailey/);
  assert.match(src, /News — \$\{TEXAS_NOW_NEWS\}/);
  assert.match(src, /NOW_BUST_VALUE = 'texas-abc-ios'/);
  assert.match(src, /pinEastonRoyalHub/);
  assert.match(src, /HUB_BUST_VALUE = 'royal-2027'/);
});

test('iOS launch edge busts URLCache without rewriting the POST body', () => {
  const bust = fs.readFileSync(
    path.join(__dirname, '../../../netlify/edge-functions/now-ios-bust.js'),
    'utf8'
  );
  assert.match(bust, /NOW_BUST_VALUE = 'texas-abc-ios'/);
  assert.match(bust, /context\.next\(\)/);
  assert.match(bust, /clear-site-data/);
  assert.doesNotMatch(bust, /upstream\.json\(\)/);
});

test('hub edge pins 2028 hero at 3 commits and drops verified commits from battles', () => {
  assert.match(src, /hero-edge-fallback/);
  assert.match(src, /3 commits locked for 2028/);
  assert.match(src, /battleBoard/);
  assert.match(src, /cyion-smith/);
  assert.match(src, /samuel-bailey/);
});
