#!/usr/bin/env node
/**
 * Editorial stamp: Moreno Fisher → Florida (2027 OT).
 * On3 Chad Simmons / Corey Bender, Nov 12, 2026.
 * Same path as Samuel Bailey / Cyion Smith. Does not queue X or member email.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const COMMIT_DATE = '2026-11-12';
const SLUG = 'moreno-fisher';
const ON3_ID = '285221';

function runVaultEval() {
  const script = path.join(__dirname, 'upsert-vault-film-eval.js');
  const file = path.join(__dirname, '..', 'data', 'war-room', 'vault-evals', `${SLUG}.json`);
  const out = spawnSync(process.execPath, [script, `--file=${file}`], {
    cwd: path.join(__dirname, '..', '..'),
    encoding: 'utf8',
  });
  if (out.status !== 0) {
    throw new Error(`upsert-vault-film-eval failed: ${out.stderr || out.stdout}`);
  }
  return out.stdout;
}

async function main() {
  delete process.env.SUPABASE_URL;
  delete process.env.DATABASE_URL;

  const store = require('../lib/recruiting-store');
  const { persistAllowlistPlayerToJson } = require('../lib/allowlist-school-persist');
  const { applyCommitTargetCleanup } = require('../lib/commit-target-cleanup');
  const { commitFingerprint } = require('../lib/commit-fingerprint');
  const on3Client = require('../lib/on3-client');
  const intel = require('../lib/recruiting-intel-store');
  const { pickWeeklyNowBreakIn } = require('../lib/weekly-now-breakin');

  const skinny = 'OT · 3★ · Hough · NC';
  const profileNote =
    'Moreno Fisher committed to Florida on November 12, 2026. 2027 OT, Hough (Cornelius, NC), 6-7 / 270. Former Virginia. Official Oklahoma visit November 6–8. Phil Trautwein.';

  const existing = await store.findBySlug(SLUG);
  const player = {
    ...(existing || {}),
    slug: SLUG,
    name: 'Moreno Fisher',
    pos: 'OT',
    classYear: 2027,
    school: 'Hough',
    htWt: '6-7 / 270',
    stars: 3,
    rating: 85.83,
    natlRank: 1162,
    posRank: 84,
    stateRank: 40,
    inState: false,
    category: 'recruit',
    status: 'committed',
    committedTo: 'Florida',
    fromSchool: 'Virginia',
    commitDate: COMMIT_DATE,
    skinny,
    profileNote,
    on3Id: ON3_ID,
    on3Slug: 'moreno-fisher-285221',
    on3ProfileUrl: 'https://www.on3.com/rivals/moreno-fisher-285221/',
    on3Source: 'charles_editorial',
    protected: true,
    verifiedCommit: true,
    pipelineState: 'committed',
    ufOvStatus: null,
    ufOvCancelledAt: null,
    nextVisitSchool: null,
    visitStart: null,
    visitEnd: null,
    starsDisplay: '★★★',
    headliner: false,
    ufProbability: 100,
    fitScore: null,
    staff_lead_id: 'trautwein',
    secondary_recruiter_id: null,
    hometownCity: 'Cornelius',
    hometownState: 'NC',
    stateFips: '37',
    pinLat: 35.4868,
    pinLng: -80.8601,
    hudl: 'https://www.hudl.com/embed/video/3/19658142/69361f27ea0d31db0393afac',
    updatedAt: new Date().toISOString(),
  };

  await store.upsertPlayer(player, { subsystem: 'stamp-moreno-fisher-commit' });
  persistAllowlistPlayerToJson(SLUG, player);
  applyCommitTargetCleanup(player, { source: 'stamp-moreno-fisher-commit', quiet: false });

  const snapshotPath = path.join(__dirname, '..', 'data', 'recruiting', 'on3-snapshot.json');
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  snapshot.years = snapshot.years || {};
  snapshot.years['2027'] = snapshot.years['2027'] || { commits: {}, rankings: null };
  const key = on3Client.playerKey(player);
  snapshot.years['2027'].commits[key] = {
    on3Id: String(player.on3Id),
    name: player.name,
    pos: player.pos,
    classYear: 2027,
    school: player.school,
    hometownCity: player.hometownCity,
    hometownState: player.hometownState,
    state: 'NC',
    htWt: player.htWt,
    stars: player.stars,
    rating: player.rating,
    natlRank: player.natlRank,
    posRank: player.posRank,
    stateRank: player.stateRank,
    inState: false,
    status: 'committed',
    commitDate: COMMIT_DATE,
    committedTo: 'Florida',
    category: 'recruit',
    skinny,
    sourceStatus: 'Committed',
    on3ProfileUrl: player.on3ProfileUrl,
  };
  const fp = commitFingerprint(player);
  snapshot.commitFingerprints = snapshot.commitFingerprints || {};
  snapshot.commitFingerprints[fp] = {
    commitDate: COMMIT_DATE,
    registeredAt: new Date().toISOString(),
    source: 'charles_editorial',
  };
  fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

  const intelRow = {
    id: `intel_${SLUG}_commit_${COMMIT_DATE}`,
    playerId: ON3_ID,
    playerSlug: SLUG,
    playerName: 'Moreno Fisher',
    classYear: 2027,
    pos: 'OT',
    eventType: 'commit',
    status: 'Committed · Florida',
    commitDate: COMMIT_DATE,
    timestamp: `${COMMIT_DATE}T19:50:00.000Z`,
    source: 'manual',
    sourceHandle: null,
    sourceType: 'manual',
    detail:
      'Moreno Fisher committed to Florida (2026-11-12). Hough (Cornelius, NC) 3-star OT, 6-7 / 270. Former Virginia. On3 Chad Simmons / Corey Bender.',
    text: '3★ OT Moreno Fisher has committed to Florida.',
    ufRelevant: true,
    reportedAt: `${COMMIT_DATE}T19:50:00.000Z`,
    fingerprint: `manual_commit_${SLUG}_${COMMIT_DATE}`,
    alertPosted: false,
    xPostQueued: false,
    xPosted: false,
    stars: 3,
    natlRank: player.natlRank,
    school: player.school,
    hometownState: 'NC',
    htWt: player.htWt,
    identityConfirmed: true,
    surfaced: true,
    createdAt: new Date().toISOString(),
    committedTo: 'Florida',
    payload: {
      player: {
        slug: SLUG,
        name: 'Moreno Fisher',
        committedTo: 'Florida',
        commitDate: COMMIT_DATE,
        stars: 3,
        natlRank: player.natlRank,
      },
    },
  };
  const intelOut = await intel.addIntel(intelRow);

  await store.fireRecruitingEvent({
    eventType: 'commit',
    player,
    skinny,
    detail: 'Moreno Fisher committed to Florida (2026-11-12).',
    source: 'manual',
  });

  const fcPath = path.join(__dirname, '..', 'data', 'players.json');
  const fcPlayers = JSON.parse(fs.readFileSync(fcPath, 'utf8'));
  const fcIdx = fcPlayers.findIndex((p) => String(p.slug || '').toLowerCase() === SLUG);
  const fcRow = {
    id: null,
    full_name: 'Moreno Fisher',
    slug: SLUG,
    class_year: 2027,
    position: 'OT',
    status: 'HS',
    height: 79,
    weight: 270,
    hometown: 'Cornelius',
    state: 'NC',
    high_school: 'Hough',
    stars: 3,
    composite_rating: 0.8583,
    ranking_national: 1162,
    ranking_position: 84,
    ranking_state: 40,
    committed_to: 'Florida',
    high_school_profile: {
      offers: [],
      stats: {
        stars: 3,
        rating: 85.83,
        natl_rank: 1162,
        pos_rank: 84,
        state_rank: 40,
        on3_id: ON3_ID,
      },
      recruiting_notes: profileNote,
      discovery_score: null,
    },
  };
  if (fcIdx >= 0) {
    fcPlayers[fcIdx] = { ...fcPlayers[fcIdx], ...fcRow, high_school_profile: fcRow.high_school_profile };
  } else {
    const after = fcPlayers.findIndex((p) => String(p.slug || '') === 'easton-royal');
    if (after >= 0) fcPlayers.splice(after + 1, 0, fcRow);
    else fcPlayers.push(fcRow);
  }
  fs.writeFileSync(fcPath, `${JSON.stringify(fcPlayers, null, 2)}\n`, 'utf8');

  const evalOut = runVaultEval();

  require('../lib/on3-snapshot-commits').clearSnapshotCommitKeyCache?.();
  const { clearSnapshotCommitKeyCache } = require('../lib/recruiting-verified-commits');
  if (typeof clearSnapshotCommitKeyCache === 'function') clearSnapshotCommitKeyCache();

  const saved = await store.findBySlug(SLUG);
  const hub = await store.getHubCommits(2027);
  const news = pickWeeklyNowBreakIn(new Date('2026-11-12T20:00:00.000Z'));

  const elite = require('../lib/recruiting-hub-elite');
  const cache = require('../lib/recruiting-hub-cache');
  for (const year of [2026, 2027, 2028]) {
    const commits = await elite.buildHubCommits(year);
    cache.writeHubDiskSnapshot('commits', year, commits);
    const footprint = await elite.buildHubFootprint(year);
    cache.writeHubDiskSnapshot('footprint', year, footprint);
  }
  const bundle = await elite.buildHubBundle(2027);
  cache.writeHubDiskSnapshot('bundle', 2027, bundle);
  const overview = await elite.buildHubClassOverview(2027);
  cache.writeHubDiskSnapshot('class-overview', 2027, overview);
  const allOverview = {};
  for (const year of [2026, 2027, 2028]) {
    allOverview[year] = await elite.buildHubClassOverview(year);
  }
  cache.writeHubDiskSnapshot('class-overview-all', null, allOverview);
  const hero = await elite.buildHubHero(2027);
  cache.writeHubDiskSnapshot('hero', 2027, hero);
  const ticker = await elite.buildHubTicker(2027);
  cache.writeHubDiskSnapshot('ticker', 2027, ticker);

  const wr = require('../lib/war-room-store');
  const bd = wr.getBreakdownBySlug(SLUG);
  const { getVaultScoutingForSlug } = require('../lib/recruiting-hub-elite');

  console.log(
    JSON.stringify(
      {
        ok: true,
        slug: SLUG,
        status: saved && saved.status,
        committedTo: saved && saved.committedTo,
        commitDate: saved && saved.commitDate,
        hubHasFisher: hub.some((p) => p.slug === SLUG),
        hubCount2027: hub.length,
        intelCreated: Boolean(intelOut?.created || intelOut?.item),
        intelReason: intelOut?.reason || null,
        news: news && news.text,
        vaultScouting: getVaultScoutingForSlug(SLUG) ? 'SHOW' : 'HIDDEN',
        comparison: bd && bd.comparison,
        projection: bd && bd.projection,
        classOverview: {
          commits: overview?.commits,
          avgRating: overview?.avgRating,
          blueChip: overview?.blueChip,
        },
        evalUpsert: String(evalOut || '').slice(0, 400),
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
