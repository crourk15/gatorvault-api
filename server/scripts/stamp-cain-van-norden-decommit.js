#!/usr/bin/env node
/**
 * Editorial stamp: Cain Van Norden decommits from Florida (2027 DL).
 * On3 Corey Bender + Hayes Fawcett, Nov 17 2026. Class now 27.
 * Does not queue X or member email. Does not rebuild 2026 hub from live store.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DECOMMIT_DATE = '2026-11-17';
const SLUG = 'cain-van-norden';
const ON3_ID = '251040';
const SOURCE_URL =
  'https://www.on3.com/teams/florida-gators/news/florida-gators-part-ways-with-2027-dl-cain-van-norden/';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function stripMeta(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const { ok, status, meta, ...rest } = value;
  return rest;
}

function patch2027ClassLine(node, line) {
  if (!node || typeof node !== 'object') return;
  if (node.classOverview && typeof node.classOverview === 'object') {
    if (String(node.classOverview.commits) === '28' || Number(node.year) === 2027) {
      Object.assign(node.classOverview, line);
    }
  }
  const all = node.classOverviewAll;
  if (all && typeof all === 'object') {
    for (const key of ['2027', 2027]) {
      if (all[key] && typeof all[key] === 'object') Object.assign(all[key], line);
    }
  }
}

function dropVanNordenFromCommits(list) {
  if (!Array.isArray(list)) return list;
  return list.filter((row) => String(row?.id || row?.slug || '').toLowerCase() !== SLUG);
}

async function main() {
  delete process.env.SUPABASE_URL;
  delete process.env.DATABASE_URL;

  const store = require('../lib/recruiting-store');
  const { persistAllowlistPlayerToJson } = require('../lib/allowlist-school-persist');
  const intel = require('../lib/recruiting-intel-store');
  const on3Client = require('../lib/on3-client');

  const existing = await store.findBySlug(SLUG);
  if (!existing) throw new Error('Cain Van Norden player row missing');

  const skinny = 'DL · 3★ · St. Frances Academy · MD';
  const profileNote =
    'Cain Van Norden decommitted from Florida on November 17, 2026. 2027 DL, Bishop McNamara / St. Frances Academy (District Heights, MD), 6-7 / 299. On3 Corey Bender; Hayes Fawcett. Class now 27.';

  const player = {
    ...existing,
    slug: SLUG,
    id: SLUG,
    name: 'Cain Van Norden',
    pos: 'DL',
    classYear: 2027,
    status: 'decommitted',
    committedTo: null,
    fromSchool: 'Florida',
    skinny,
    profileNote,
    on3Id: Number(ON3_ID),
    on3Source: 'charles_editorial',
    protected: false,
    verifiedCommit: false,
    pipelineState: 'target',
    ufProbability: null,
    updatedAt: new Date().toISOString(),
  };

  const verification = {
    sourceType: 'beat_writer',
    source: 'beat_writer',
    explicitDecommit: true,
    previousCommit: 'Florida',
    currentCommit: 'Open',
    sourceUrl: SOURCE_URL,
    detail:
      'Cain Van Norden decommitted from Florida (2026-11-17). On3 Corey Bender: Florida Gators part ways with 2027 DL Cain Van Norden / 2027 DL Cain Van Norden de-commits from Florida. Hayes Fawcett. Class now 27 commitments.',
  };

  const fired = await store.fireRecruitingEvent({
    eventType: 'decommit',
    player,
    skinny,
    detail: verification.detail,
    source: 'manual',
    verification,
  });

  await store.upsertPlayer(player, { subsystem: 'stamp-cain-van-norden-decommit' });
  persistAllowlistPlayerToJson(SLUG, player);

  const snapshotPath = path.join(__dirname, '..', 'data', 'recruiting', 'on3-snapshot.json');
  const snapshot = readJson(snapshotPath);
  const key = on3Client.playerKey(player);
  const bucket = snapshot.years && snapshot.years['2027'] && snapshot.years['2027'].commits;
  if (bucket) {
    delete bucket[key];
    delete bucket[`on3:${ON3_ID}`];
    delete bucket[SLUG];
  }
  fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

  const intelRow = {
    id: `intel_${SLUG}_decommit_${DECOMMIT_DATE}`,
    playerId: ON3_ID,
    playerSlug: SLUG,
    playerName: 'Cain Van Norden',
    classYear: 2027,
    pos: 'DL',
    eventType: 'decommit',
    status: 'Decommitted · Florida',
    commitDate: existing.commitDate || '2026-05-15',
    timestamp: `${DECOMMIT_DATE}T23:00:00.000Z`,
    source: 'manual',
    sourceHandle: null,
    sourceType: 'beat_writer',
    detail: verification.detail,
    text: '3★ DL Cain Van Norden has decommitted from Florida.',
    ufRelevant: true,
    reportedAt: `${DECOMMIT_DATE}T23:00:00.000Z`,
    fingerprint: `manual_decommit_${SLUG}_${DECOMMIT_DATE}`,
    alertPosted: false,
    xPostQueued: false,
    xPosted: false,
    stars: 3,
    natlRank: existing.natlRank,
    school: existing.school,
    hometownState: 'MD',
    htWt: existing.htWt,
    identityConfirmed: true,
    surfaced: true,
    createdAt: new Date().toISOString(),
    committedTo: null,
    payload: {
      player: {
        slug: SLUG,
        name: 'Cain Van Norden',
        committedTo: null,
        status: 'decommitted',
        stars: 3,
        natlRank: existing.natlRank,
        fromSchool: 'Florida',
      },
      verifiedDecommit: true,
      verification,
    },
  };
  const intelOut = await intel.addIntel(intelRow);

  const fcPath = path.join(__dirname, '..', 'data', 'players.json');
  const fcPlayers = readJson(fcPath);
  const fcIdx = fcPlayers.findIndex((p) => String(p.slug || '').toLowerCase() === SLUG);
  if (fcIdx >= 0) {
    fcPlayers[fcIdx] = {
      ...fcPlayers[fcIdx],
      committed_to: null,
      high_school_profile: {
        ...(fcPlayers[fcIdx].high_school_profile || {}),
        recruiting_notes: profileNote,
      },
    };
    fs.writeFileSync(fcPath, `${JSON.stringify(fcPlayers, null, 2)}\n`, 'utf8');
  }

  const fc2027Path = path.join(__dirname, '..', 'data', 'futurecast', 'futurecast-2027.json');
  if (fs.existsSync(fc2027Path)) {
    const fc2027 = readJson(fc2027Path);
    const rows = Array.isArray(fc2027) ? fc2027 : fc2027.players || fc2027.items;
    if (Array.isArray(rows)) {
      const idx = rows.findIndex((p) => String(p.slug || '').toLowerCase() === SLUG);
      if (idx >= 0) {
        rows[idx] = { ...rows[idx], committed_to: null };
        if (Array.isArray(fc2027)) writeJson(fc2027Path, rows);
        else {
          if (fc2027.players) fc2027.players = rows;
          else fc2027.items = rows;
          writeJson(fc2027Path, fc2027);
        }
      }
    }
  }

  require('../lib/on3-snapshot-commits').clearSnapshotCommitKeyCache?.();
  const { clearSnapshotCommitKeyCache } = require('../lib/recruiting-verified-commits');
  if (typeof clearSnapshotCommitKeyCache === 'function') clearSnapshotCommitKeyCache();

  const elite = require('../lib/recruiting-hub-elite');
  const cache = require('../lib/recruiting-hub-cache');

  const overview2027 = await elite.buildHubClassOverview(2027);
  const commits = await elite.buildHubCommits(2027);
  const footprint = await elite.buildHubFootprint(2027);
  const ticker = await elite.buildHubTicker(2027);
  const battles = await elite.buildHubBattles(2027);
  const positions = await elite.buildHubPositions(2027);
  const heatIndex = await elite.buildHubHeatIndex(2027);
  const movementFeed = await elite.buildHubMovementFeed(2027);
  const battleBoard = await elite.buildHubBattleBoard(2027);

  const overview2026 = stripMeta(cache.readHubDiskSnapshot('class-overview', 2026) || {});
  const overview2028 = stripMeta(cache.readHubDiskSnapshot('class-overview', 2028) || {});
  const allOverview = {
    2026: overview2026,
    2027: overview2027,
    2028: overview2028,
  };

  cache.writeHubDiskSnapshot('commits', 2027, commits);
  cache.writeHubDiskSnapshot('footprint', 2027, footprint);
  cache.writeHubDiskSnapshot('ticker', 2027, ticker);
  cache.writeHubDiskSnapshot('class-overview', 2027, overview2027);
  cache.writeHubDiskSnapshot('class-overview-all', null, allOverview);

  const hero = {
    year: 2027,
    title: 'Florida Recruiting',
    subtitle: elite.hubHeroSubtitle(2027),
    classYears: [2026, 2027, 2028],
    ticker,
    classOverview: overview2027,
    classOverviewAll: allOverview,
  };
  cache.writeHubDiskSnapshot('hero', 2027, hero);

  const bundle = {
    year: 2027,
    subtitle: elite.hubHeroSubtitle(2027),
    ticker,
    classOverview: overview2027,
    classOverviewAll: allOverview,
    commits,
    battles,
    positions,
    heatIndex,
    movementFeed,
    battleBoard,
    footprint,
  };
  cache.writeHubDiskSnapshot('bundle', 2027, bundle);

  const line = {
    classRank: overview2027.classRank,
    blueChip: overview2027.blueChip,
    commits: overview2027.commits,
    commitLabel: overview2027.commitLabel,
    avgRating: overview2027.avgRating,
  };

  for (const year of [2026, 2028]) {
    const bundlePath = path.join(
      __dirname,
      '..',
      'data',
      'recruiting',
      'hub-runtime',
      String(year),
      'bundle.json'
    );
    if (!fs.existsSync(bundlePath)) continue;
    const doc = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
    patch2027ClassLine(doc, line);
    fs.writeFileSync(bundlePath, JSON.stringify(doc), 'utf8');
    const heroPath = path.join(
      __dirname,
      '..',
      'data',
      'recruiting',
      'hub-runtime',
      String(year),
      'hero.json'
    );
    if (!fs.existsSync(heroPath)) continue;
    const heroDoc = JSON.parse(fs.readFileSync(heroPath, 'utf8'));
    patch2027ClassLine(heroDoc, line);
    fs.writeFileSync(heroPath, JSON.stringify(heroDoc), 'utf8');
  }

  const heroSeedPath = path.join(__dirname, '..', '..', 'client', 'lib', 'recruiting-hub-hero-seed.json');
  const heroSeed = readJson(heroSeedPath);
  Object.assign(heroSeed.classOverview, line);
  patch2027ClassLine(heroSeed, line);
  heroSeed.generatedAt = new Date().toISOString();
  writeJson(heroSeedPath, heroSeed);

  const bundleSeedPath = path.join(
    __dirname,
    '..',
    '..',
    'client',
    'lib',
    'recruiting-hub-bundle-seed.json'
  );
  const bundleSeed = JSON.parse(fs.readFileSync(bundleSeedPath, 'utf8'));
  const y2027 = bundleSeed.byYear && bundleSeed.byYear['2027'];
  if (y2027) {
    Object.assign(y2027.classOverview || {}, line);
    patch2027ClassLine(y2027, line);
    y2027.commits = dropVanNordenFromCommits(y2027.commits);
    y2027.ticker = ticker.slice(0, 12);
  }
  for (const year of ['2026', '2028']) {
    if (bundleSeed.byYear && bundleSeed.byYear[year]) {
      patch2027ClassLine(bundleSeed.byYear[year], line);
    }
  }
  bundleSeed.generatedAt = new Date().toISOString();
  fs.writeFileSync(bundleSeedPath, `${JSON.stringify(bundleSeed)}\n`, 'utf8');

  const saved = await store.findBySlug(SLUG);
  const hub = await store.getHubHsCommits(2027);

  console.log(
    JSON.stringify(
      {
        ok: true,
        slug: SLUG,
        status: saved && saved.status,
        committedTo: saved && saved.committedTo,
        protected: saved && saved.protected,
        on3Source: saved && saved.on3Source,
        hubHasVanNorden: hub.some((p) => p.slug === SLUG),
        hubHasGrant: hub.some((p) => p.slug === 'terrance-grant'),
        hubCount2027: hub.length,
        intelCreated: Boolean(intelOut?.created || intelOut?.item),
        intelReason: intelOut?.reason || null,
        firedEvent: Boolean(fired?.event),
        classOverview: line,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
