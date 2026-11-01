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
  assert.match(src, /5-3 · SEC home Saturday/);
  assert.match(src, /Oklahoma in the Swamp — 7:45 PM · SEC Network/);
  assert.match(src, /Florida 8, Georgia 27/);
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
  assert.match(src, /texas at dkr/);
  assert.match(src, /Oklahoma in the Swamp — 7:45 PM · SEC Network/);
});

test('ticker edge one-shot busts iOS URLCache and pins the Oklahoma week pack', () => {
  assert.match(src, /pinCurrentOklahomaNow/);
  assert.match(src, /pinOklahomaWeek/);
  assert.match(src, /applyNowCacheBust/);
  assert.match(src, /NOW_BUST_COOKIE = 'gv-now-bust'/);
  assert.match(src, /NOW_BUST_VALUE = 'ou-pred-50'/);
  assert.match(src, /lockScheduleBroadcast/);
  assert.match(src, /pinTexasJonesCard/);
  assert.match(src, /Tramell Jones starts/);
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
  assert.match(src, /News — \$\{OU_NOW_NEWS\}/);
  assert.match(src, /NOW_BUST_VALUE = 'ou-pred-50'/);
  assert.match(src, /lockScheduleBroadcast/);
  assert.match(src, /lockAbcOnlyString/);
  assert.match(src, /pinEastonRoyalHub/);
  assert.match(src, /HUB_BUST_VALUE = 'class-rank-5'/);
  const hubBust = src.slice(src.indexOf('function applyHubCacheBust'), src.indexOf('function isAppStoreUpdateLine'));
  assert.match(hubBust, /headers\.delete\('clear-site-data'\)/);
  assert.doesNotMatch(hubBust, /headers\.set\('clear-site-data'/);
  assert.doesNotMatch(src, /ROYAL_2027_CLASS_LINE/);
  assert.doesNotMatch(src, /pin2027ClassLine/);
  assert.match(src, /isClassMetricsPath/);
});

test('iOS launch edge does not clear the cache while the vault page opens', () => {
  const bust = fs.readFileSync(
    path.join(__dirname, '../../../netlify/edge-functions/now-ios-bust.js'),
    'utf8'
  );
  assert.match(bust, /NOW_BUST_VALUE = 'ou-pred-50'/);
  assert.match(bust, /context\.next\(\)/);
  assert.match(bust, /headers\.delete\('clear-site-data'\)/);
  assert.doesNotMatch(bust, /headers\.set\('clear-site-data'/);
  assert.doesNotMatch(bust, /upstream\.json\(\)/);
  const nowBust = src.slice(src.indexOf('function applyNowCacheBust'), src.indexOf('function pinCurrentOklahomaNow'));
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

test('2027 hub edge keeps the commit list and leaves the live class line alone', () => {
  const start = src.indexOf('const EASTON_ROYAL_HUB_SUBTITLE');
  const end = src.indexOf('function needsHubCacheBust');
  assert.ok(start > 0 && end > start);
  const { pinEastonRoyalHub } = new Function(
    `${src.slice(start, end)}; return { pinEastonRoyalHub };`
  )();
  const players = [
    { id: 'maxwell-hiller', name: 'Maxwell Hiller' },
    { id: 'easton-royal', name: 'Easton Royal' },
  ];
  const bundle = {
    year: 2027,
    commits: players,
    classOverview: { classRank: '#4', blueChip: '70%', commits: '28', avgRating: '90.4' },
    classOverviewAll: { 2027: { classRank: '#4', commits: '28', avgRating: '90.4' } },
  };
  const pinned = pinEastonRoyalHub(bundle, 2027);
  assert.equal(Array.isArray(pinned.data.commits), true);
  assert.equal(pinned.data.commits.length, 2);
  assert.equal(pinned.data.commits[0].id, 'easton-royal');
  assert.equal(pinned.data.commits[0].name, 'Easton Royal');
  assert.equal(pinned.data.classOverview.classRank, '#4');
  assert.equal(pinned.data.classOverview.blueChip, '70%');
  assert.equal(pinned.data.classOverview.commits, '28');
  assert.equal(pinned.data.classOverview.avgRating, '90.4');
  assert.equal(pinned.data.classOverviewAll['2027'].classRank, '#4');
  assert.equal(pinned.data.classOverviewAll['2027'].commits, '28');
});

test('schedule edge pins Charles Oklahoma 3 Keys over an empty iOS last-good board', () => {
  const start = src.indexOf('const OU_KEY_TITLES');
  const end = src.indexOf('const HUB_BUST_COOKIE');
  assert.ok(start > 0 && end > start);
  const { pinOklahomaWeek } = new Function(`${src.slice(start, end)}; return { pinOklahomaWeek };`)();
  const empty = {
    currentGameId: 'oklahoma',
    games: [
      {
        id: 'oklahoma',
        tv: 'SEC Network',
        date: 'November 7, 2026 · 7:45 PM ET',
        keys: [],
        swing: [],
      },
    ],
  };
  const pinned = pinOklahomaWeek(empty);
  const ou = pinned.data.games[0];
  assert.equal(pinned.changed, true);
  assert.deepEqual(ou.keys, [
    'Make Them One-Dimensional',
    'Find the Explosive',
    'Get to Third-and-Long',
  ]);
  assert.equal(ou.swing[0].name, 'Myles Graham');
  assert.equal(ou.swing[1].name, 'Tramell Jones Jr.');
  assert.equal(ou.swing[2].name, 'Jayden Woods');
  assert.match(ou.howUFWins[0], /137th nationally in rush EPA/);
  assert.match(ou.howUFWins[1], /111th in explosiveness allowed/);
  assert.match(ou.howUFWins[2], /24\.5% success and -0\.56 EPA, 134th/);
  assert.equal(ou.swing[0].role, ou.howUFWins[0]);
  assert.equal(ou.swing[1].role, ou.howUFWins[1]);
  assert.equal(ou.swing[2].role, ou.howUFWins[2]);
  assert.equal(ou.ufPct, 50);
  assert.equal(ou.pred, 'UF 27 · Oklahoma 24');
  assert.equal(ou.predUF, 27);
  assert.equal(ou.predOpp, 24);
  assert.equal(ou.radar[0].label, 'Run Game');
  assert.equal(ou.radar[0].uf, 66);
  assert.equal(ou.radar[0].opp, 48);
  assert.equal(ou.radar[3].label, 'Secondary');
  assert.equal(ou.radar[3].uf, 54);
  assert.equal(ou.radar[3].opp, 70);

  const live = pinOklahomaWeek({
    currentGameId: 'oklahoma',
    games: [{ ...ou }],
  });
  assert.equal(live.changed, false);
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
