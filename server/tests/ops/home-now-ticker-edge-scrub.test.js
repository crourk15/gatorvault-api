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
  assert.match(src, /7-4 heading into Friday/);
  assert.match(src, /Florida State at Doak Campbell Stadium — 3:30 PM · ABC/);
  assert.match(src, /Vanderbilt in the Swamp — 12:00 PM/);
  assert.match(src, /Terrance Grant flips to Florida/);
  assert.match(src, /Kentucky at Kroger Field — 6:15 PM · ESPN/);
  assert.match(src, /Moreno Fisher commits to Florida/);
  assert.match(src, /finalUF: 7/);
  assert.match(src, /finalOpp: 23/);
  assert.match(src, /finalUF: 21/);
  assert.match(src, /finalOpp: 14/);
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
  assert.match(src, /oklahoma in the swamp/);
  assert.match(src, /Kentucky at Kroger Field — 6:15 PM · ESPN/);
});

test('ticker edge one-shot busts iOS URLCache and pins the Vanderbilt week pack', () => {
  assert.match(src, /pinCurrentVanderbiltNow/);
  assert.match(src, /pinVanderbiltWeek/);
  assert.match(src, /applyNowCacheBust/);
  assert.match(src, /NOW_BUST_COOKIE = 'gv-now-bust'/);
  assert.match(src, /NOW_BUST_VALUE = 'fsu-week-74'/);
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
  assert.match(src, /florida 7,\\s\*oklahoma 23/);
  assert.match(src, /News — \$\{FSU_NOW_NEWS\}/);
  assert.match(src, /NOW_BUST_VALUE = 'fsu-week-74'/);
  assert.match(src, /lockScheduleBroadcast/);
  assert.match(src, /lockAbcOnlyString/);
  assert.match(src, /pinEastonRoyalHub/);
  assert.match(src, /HUB_BUST_VALUE = 'commits-natl-rank'/);
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
  assert.match(bust, /NOW_BUST_VALUE = 'fsu-week-74'/);
  assert.match(bust, /context\.next\(\)/);
  assert.match(bust, /headers\.delete\('clear-site-data'\)/);
  assert.doesNotMatch(bust, /headers\.set\('clear-site-data'/);
  assert.doesNotMatch(bust, /upstream\.json\(\)/);
  const nowBust = src.slice(src.indexOf('function applyNowCacheBust'), src.indexOf('function pinCurrentVanderbiltNow'));
  assert.match(nowBust, /headers\.delete\('clear-site-data'\)/);
  assert.doesNotMatch(nowBust, /headers\.set\('clear-site-data'/);
  assert.doesNotMatch(src, /headers\.set\('clear-site-data'/);
});

test('recruiting page edge drops a cached 8th or 5th and stamps 6th', () => {
  const htmlEdge = fs.readFileSync(
    path.join(__dirname, '../../../netlify/edge-functions/hero-class-rank.js'),
    'utf8'
  );
  assert.equal(htmlEdge.includes('\u0000'), false);
  assert.match(htmlEdge, /"classRank":"#6"/);
  assert.match(htmlEdge, /"commits":"27"/);
  assert.match(htmlEdge, /"blueChip":"63%"/);
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
  assert.equal(pinned.data.commits[0].id, 'maxwell-hiller');
  assert.equal(pinned.data.commits[1].id, 'easton-royal');
  assert.equal(pinned.data.classOverview.classRank, '#4');
  assert.equal(pinned.data.classOverview.blueChip, '70%');
  assert.equal(pinned.data.classOverview.commits, '28');
  assert.equal(pinned.data.classOverview.avgRating, '90.4');
  assert.equal(pinned.data.classOverviewAll['2027'].classRank, '#4');
  assert.equal(pinned.data.classOverviewAll['2027'].commits, '28');
});

test('2027 hub edge drops Van Norden and stamps Grant-week 28 / 61% to 27 / 63%', () => {
  const start = src.indexOf('const EASTON_ROYAL_HUB_SUBTITLE');
  const end = src.indexOf('function needsHubCacheBust');
  const { pinEastonRoyalHub } = new Function(
    `${src.slice(start, end)}; return { pinEastonRoyalHub };`
  )();
  const pinned = pinEastonRoyalHub(
    {
      commits: [
        { id: 'maxwell-hiller', name: 'Maxwell Hiller' },
        { id: 'cain-van-norden', name: 'Cain Van Norden' },
        { id: 'easton-royal', name: 'Easton Royal' },
        { id: 'terrance-grant', name: 'Terrance Grant' },
      ],
      classOverview: { classRank: '#6', blueChip: '61%', commits: '28', avgRating: '90.1' },
      classOverviewAll: { 2027: { classRank: '#6', blueChip: '61%', commits: '28', avgRating: '90.1' } },
    },
    2027
  );
  assert.equal(
    pinned.data.commits.some((p) => p.id === 'cain-van-norden'),
    false
  );
  assert.equal(pinned.data.commits[0].id, 'maxwell-hiller');
  assert.equal(pinned.data.commits[1].id, 'easton-royal');
  assert.equal(pinned.data.classOverview.commits, '27');
  assert.equal(pinned.data.classOverview.blueChip, '63%');
  assert.equal(pinned.data.classOverviewAll[2027].commits, '27');
});

test('schedule edge pins FSU week over an empty iOS last-good board', () => {
  const start = src.indexOf('const TEXAS_BOX');
  const end = src.indexOf('const HUB_BUST_COOKIE');
  assert.ok(start > 0 && end > start);
  const { pinVanderbiltWeek } = new Function(`${src.slice(start, end)}; return { pinVanderbiltWeek };`)();
  const empty = {
    currentGameId: 'vandy',
    games: [
      {
        id: 'oklahoma',
        tv: 'SEC Network',
        date: 'November 7, 2026 · 7:45 PM ET',
        keys: [],
        swing: [],
      },
      {
        id: 'kentucky',
        tv: 'TBD',
        date: 'November 14, 2026 · 6:00–8:00 PM ET',
        keys: ['Physical run fits', 'Win the trenches', 'Finish in red zone'],
        swing: [{ name: 'Jadan Baugh', role: 'Wear down front' }],
        film: 'Kentucky power run and play-action on the road.',
      },
      {
        id: 'vandy',
        tv: 'TBD',
        date: 'November 21, 2026 · 12:00–1:00 PM ET',
        keys: ['Execute early', 'Avoid complacency', 'Develop depth'],
        swing: [{ name: 'Backup units', role: 'Rep evaluation' }],
        film: 'Vanderbilt improving — treat as SEC test.',
      },
      {
        id: 'fsu',
        tv: 'ABC',
        date: 'November 27, 2026 · 3:30 PM ET',
        keys: ['Win field position battle', 'Avoid penalties', 'Win turnover margin'],
        swing: [{ name: 'QB1', role: 'Composure in hostile environment' }],
        film: 'Everything on the line. UF takes Doak — finish drives and win the turnover battle.',
      },
    ],
  };
  const pinned = pinVanderbiltWeek(empty);
  assert.equal(pinned.changed, true);
  assert.equal(pinned.data.currentGameId, 'fsu');
  const ou = pinned.data.games[0];
  const ky = pinned.data.games[1];
  const vu = pinned.data.games[2];
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
  assert.equal(ou.finalUF, 7);
  assert.equal(ou.finalOpp, 23);
  assert.equal(ou.finalSource, 'official');
  assert.equal(ou.ufPct, 50);
  assert.equal(ou.pred, 'UF 27 · Oklahoma 24');
  assert.deepEqual(
    ou.expectedVisitors.visitors.map((v) => v.slug),
    ['moreno-fisher', 'nathan-holston', 'lee-steele', 'tyler-boyd']
  );
  assert.equal(ky.tv, 'ESPN');
  assert.equal(ky.date, 'November 14, 2026 · 6:15 PM ET');
  assert.deepEqual(ky.keys, [
    'Take Away the Run',
    'Stay Alive on Third',
    "Don't Give Them the Ball",
  ]);
  assert.equal(ky.swing[0].name, 'Myles Graham');
  assert.equal(ky.swing[1].name, 'Tramell Jones Jr.');
  assert.equal(ky.swing[2].name, 'Jadan Baugh');
  assert.match(ky.howUFWins[0], /choke off Baxter/);
  assert.match(ky.film, /Take Away the Run/);
  assert.equal(ky.pred, 'UF 22 · Kentucky 23');
  assert.equal(ky.predUF, 22);
  assert.equal(ky.predOpp, 23);
  assert.equal(ky.predSat, true);
  assert.equal(ky.ufPct, 48);
  assert.equal(ky.radar[0].label, 'Run Game');
  assert.equal(ky.radar[0].uf, 52);
  assert.equal(ky.radar[0].opp, 66);
  assert.equal(ky.radar[1].uf, 68);
  assert.equal(ky.radar[3].uf, 50);
  assert.equal(ky.radar[3].opp, 64);
  assert.equal(ky.radar[5].uf, 48);
  assert.equal(ky.radar[5].opp, 58);
  assert.equal(ky.finalUF, 21);
  assert.equal(ky.finalOpp, 14);
  assert.equal(ky.finalSource, 'official');
  assert.equal(vu.date, 'November 21, 2026 · 12:00 PM ET');
  assert.deepEqual(vu.keys, [
    'Make the Freshman Beat You',
    'Take Away the One Guy',
    'Make the Drive Worth Seven',
  ]);
  assert.equal(vu.swing[0].name, 'Jayden Woods');
  assert.equal(vu.swing[1].name, 'Cormani McClain');
  assert.equal(vu.swing[2].name, 'Jadan Baugh');
  assert.match(vu.howUFWins[0], /133rd nationally in rushing yards/);
  assert.match(vu.howUFWins[1], /37 percent of Vanderbilt/);
  assert.match(vu.howUFWins[2], /Senior Day is not a field-goal game/);
  assert.match(vu.film, /Make the Freshman Beat You/);
  assert.equal(vu.pred, 'UF 24 · Vanderbilt 17');
  assert.equal(vu.predUF, 24);
  assert.equal(vu.predOpp, 17);
  assert.equal(vu.predSat, true);
  assert.equal(vu.ufPct, 62);
  assert.equal(vu.radar[0].label, 'Run Game');
  assert.equal(vu.radar[0].uf, 66);
  assert.equal(vu.radar[0].opp, 46);
  assert.equal(vu.radar[1].uf, 68);
  assert.equal(vu.radar[3].uf, 54);
  assert.equal(vu.radar[3].opp, 56);
  assert.equal(vu.radar[4].opp, 72);
  assert.equal(vu.radar[5].uf, 56);
  assert.equal(vu.finalUF, 34);
  assert.equal(vu.finalOpp, 27);
  assert.equal(vu.finalSource, 'official');
  const fsu = pinned.data.games[3];
  assert.equal(fsu.date, 'November 27, 2026 · 3:30 PM ET');
  assert.equal(fsu.tv, 'ABC');
  assert.deepEqual(fsu.keys, [
    'Take Away the Keep',
    'Make Him Give It to You',
    'Get Off the Field',
  ]);
  assert.equal(fsu.swing[0].name, 'Myles Graham');
  assert.equal(fsu.swing[1].name, 'Jayden Woods');
  assert.equal(fsu.swing[2].name, 'Aaron Philo');
  assert.match(fsu.howUFWins[0], /13 rushing touchdowns/);
  assert.match(fsu.howUFWins[1], /12 interceptions/);
  assert.match(fsu.howUFWins[2], /Doak on Friday is not a field-goal game/);
  assert.match(fsu.film, /Take Away the Keep/);
  assert.equal(fsu.pred, 'UF 27 · FSU 23');
  assert.equal(fsu.predUF, 27);
  assert.equal(fsu.predOpp, 23);
  assert.equal(fsu.predSat, true);
  assert.equal(fsu.ufPct, 58);
  assert.equal(fsu.radar[0].uf, 58);
  assert.equal(fsu.radar[0].opp, 66);
  assert.equal(fsu.radar[2].uf, 68);
  assert.equal(fsu.radar[5].opp, 58);

  const live = pinVanderbiltWeek({
    currentGameId: 'fsu',
    games: [{ ...ou }, { ...ky }, { ...vu }, { ...fsu }],
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
