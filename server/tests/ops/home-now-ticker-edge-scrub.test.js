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
  assert.match(src, /NOW_BUST_VALUE = 'texas-abc-only'/);
  assert.match(src, /lockScheduleBroadcast/);
  assert.match(src, /lockAbcOnlyString/);
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
  assert.match(src, /NOW_BUST_VALUE = 'texas-abc-only'/);
  assert.match(src, /lockScheduleBroadcast/);
  assert.match(src, /lockAbcOnlyString/);
  assert.match(src, /pinEastonRoyalHub/);
  assert.match(src, /HUB_BUST_VALUE = 'class-rank-5'/);
  const hubBust = src.slice(src.indexOf('function applyHubCacheBust'), src.indexOf('function isAppStoreUpdateLine'));
  assert.match(hubBust, /headers\.delete\('clear-site-data'\)/);
  assert.doesNotMatch(hubBust, /headers\.set\('clear-site-data'/);
  assert.match(src, /ROYAL_2027_CLASS_LINE/);
  assert.match(src, /classRank: '#5'/);
  assert.match(src, /isClassMetricsPath/);
});

test('iOS launch edge does not clear the cache while the vault page opens', () => {
  const bust = fs.readFileSync(
    path.join(__dirname, '../../../netlify/edge-functions/now-ios-bust.js'),
    'utf8'
  );
  assert.match(bust, /NOW_BUST_VALUE = 'texas-abc-only'/);
  assert.match(bust, /context\.next\(\)/);
  assert.match(bust, /headers\.delete\('clear-site-data'\)/);
  assert.doesNotMatch(bust, /headers\.set\('clear-site-data'/);
  assert.doesNotMatch(bust, /upstream\.json\(\)/);
  const nowBust = src.slice(src.indexOf('function applyNowCacheBust'), src.indexOf('function pinCurrentTexasNow'));
  assert.match(nowBust, /headers\.delete\('clear-site-data'\)/);
  assert.doesNotMatch(nowBust, /headers\.set\('clear-site-data'/);
  assert.doesNotMatch(src, /headers\.set\('clear-site-data'/);
});

test('recruiting page edge drops a cached 8th and stamps 5th', () => {
  const htmlEdge = fs.readFileSync(
    path.join(__dirname, '../../../netlify/edge-functions/hero-class-rank.js'),
    'utf8'
  );
  assert.equal(htmlEdge.includes('\u0000'), false);
  assert.match(htmlEdge, /"classRank":"#5"/);
  assert.match(htmlEdge, /headers\.delete\('clear-site-data'\)/);
  assert.doesNotMatch(htmlEdge, /headers\.set\('clear-site-data'/);
  const toml = fs.readFileSync(path.join(__dirname, '../../../netlify.toml'), 'utf8');
  assert.match(toml, /function = "hero-class-rank"/);
  assert.match(toml, /path = "\/api\/recruiting\/class-metrics"/);
});

test('2027 class pin keeps the hub commit list and still stamps the class line', () => {
  const start = src.indexOf('const EASTON_ROYAL_HUB_SUBTITLE');
  const end = src.indexOf('function needsHubCacheBust');
  assert.ok(start > 0 && end > start);
  const { apply2027ClassLine, pinEastonRoyalHub } = new Function(
    `${src.slice(start, end)}; return { apply2027ClassLine, pinEastonRoyalHub };`
  )();
  const players = [
    { id: 'maxwell-hiller', name: 'Maxwell Hiller' },
    { id: 'easton-royal', name: 'Easton Royal' },
  ];
  const bundle = {
    year: 2027,
    commits: players,
    classOverview: { classRank: '#8', blueChip: '65%', commits: '26', avgRating: '89.7' },
    classOverviewAll: { 2027: { classRank: '#8', commits: '26' } },
  };
  const pinned = pinEastonRoyalHub(bundle, 2027);
  assert.equal(Array.isArray(pinned.data.commits), true);
  assert.equal(pinned.data.commits.length, 2);
  assert.equal(pinned.data.commits[0].id, 'easton-royal');
  assert.equal(pinned.data.commits[0].name, 'Easton Royal');
  assert.equal(pinned.data.classOverview.classRank, '#5');
  assert.equal(pinned.data.classOverview.blueChip, '67%');
  assert.equal(pinned.data.classOverview.commits, '27');
  assert.equal(pinned.data.classOverview.avgRating, '90.1');
  assert.equal(pinned.data.classOverviewAll['2027'].classRank, '#5');
  assert.equal(pinned.data.classOverviewAll['2027'].commits, '27');

  const metrics = apply2027ClassLine({
    ok: true,
    classRank: '#8',
    blueChip: '65%',
    commits: '26',
    avgRating: '89.7',
  });
  assert.equal(metrics.data.classRank, '#5');
  assert.equal(metrics.data.blueChip, '67%');
  assert.equal(metrics.data.commits, '27');
  assert.equal(metrics.data.avgRating, '90.1');
  assert.equal(typeof metrics.data.commits, 'string');
});

test('vault hydration boot script parses', () => {
  const { VAULT_HYDRATION_BOOT_SCRIPT } = require('../../../client/lib/vault-hydration-guard');
  assert.equal(VAULT_HYDRATION_BOOT_SCRIPT.includes('\u0000'), false);
  assert.match(VAULT_HYDRATION_BOOT_SCRIPT, /pageshow/);
  new Function(VAULT_HYDRATION_BOOT_SCRIPT);
});

test('hub edge pins 2028 hero at 3 commits and drops verified commits from battles', () => {
  assert.match(src, /hero-edge-fallback/);
  assert.match(src, /3 commits locked for 2028/);
  assert.match(src, /battleBoard/);
  assert.match(src, /cyion-smith/);
  assert.match(src, /samuel-bailey/);
});
