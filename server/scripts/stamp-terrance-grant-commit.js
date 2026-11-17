#!/usr/bin/env node
/**
 * Editorial stamp: Terrance Grant → Florida (2027 RB).
 * On3 player card: Florida committed 11/17/2026. Former Maryland (5/31/2026).
 * DeMatha Catholic (Hyattsville, MD) / Las Vegas. Chris Foster.
 * Does not queue X or member email. Film eval is PROVISIONAL (Hudl not watched).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const COMMIT_DATE = '2026-11-17';
const SLUG = 'terrance-grant';
const ON3_ID = '241998';

function runVaultEval() {
  const script = path.join(__dirname, 'upsert-vault-film-eval.js');
  const file = path.join(__dirname, '..', 'data', 'war-room', 'vault-evals', `${SLUG}.json`);
  const out = spawnSync(process.execPath, [script, `--file=${file}`, '--allow-no-hudl'], {
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

  const skinny = 'RB · 3★ · DeMatha Catholic · MD';
  const profileNote =
    'Terrance Grant flipped from Maryland to Florida on November 17, 2026. 2027 RB, DeMatha Catholic (Hyattsville, MD), 5-11 / 220. Former Bishop Gorman (Las Vegas). Chris Foster.';

  const existing = await store.findBySlug(SLUG);
  const player = {
    ...(existing || {}),
    slug: SLUG,
    id: SLUG,
    name: 'Terrance Grant',
    pos: 'RB',
    classYear: 2027,
    school: 'DeMatha Catholic',
    htWt: '5-11 / 220',
    stars: 3,
    rating: 87.37,
    displayRating: 87.37,
    natlRank: 732,
    posRank: 53,
    stateRank: 17,
    inState: false,
    category: 'recruit',
    status: 'committed',
    committedTo: 'Florida',
    fromSchool: 'Maryland',
    commitDate: COMMIT_DATE,
    skinny,
    profileNote,
    on3Id: ON3_ID,
    on3Slug: 'terrance-grant-241998',
    on3ProfileUrl: 'https://www.on3.com/rivals/terrance-grant-241998/',
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
    staff_lead_id: 'foster',
    secondary_recruiter_id: null,
    hometownCity: 'Hyattsville',
    hometownState: 'MD',
    state: 'MD',
    stateFips: '24',
    pinLat: 38.9559,
    pinLng: -76.9455,
    rankSyncedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await store.upsertPlayer(player, { subsystem: 'stamp-terrance-grant-commit' });
  persistAllowlistPlayerToJson(SLUG, player);
  applyCommitTargetCleanup(player, { source: 'stamp-terrance-grant-commit', quiet: false });

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
    state: 'MD',
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
    id: `intel_${SLUG}_flip_${COMMIT_DATE}`,
    playerId: ON3_ID,
    playerSlug: SLUG,
    playerName: 'Terrance Grant',
    classYear: 2027,
    pos: 'RB',
    eventType: 'flip',
    status: 'Committed · Florida',
    commitDate: COMMIT_DATE,
    timestamp: `${COMMIT_DATE}T16:00:00.000Z`,
    source: 'manual',
    sourceHandle: null,
    sourceType: 'manual',
    detail:
      'Terrance Grant flipped from Maryland to Florida (2026-11-17). DeMatha Catholic (Hyattsville, MD) 3-star RB, 5-11 / 220. Former Bishop Gorman. On3 player card.',
    text: '3★ RB Terrance Grant has flipped to Florida.',
    ufRelevant: true,
    reportedAt: `${COMMIT_DATE}T16:00:00.000Z`,
    fingerprint: `manual_flip_${SLUG}_${COMMIT_DATE}`,
    alertPosted: false,
    xPostQueued: false,
    xPosted: false,
    stars: 3,
    natlRank: player.natlRank,
    school: player.school,
    hometownState: 'MD',
    htWt: player.htWt,
    identityConfirmed: true,
    surfaced: true,
    createdAt: new Date().toISOString(),
    committedTo: 'Florida',
    payload: {
      player: {
        slug: SLUG,
        name: 'Terrance Grant',
        committedTo: 'Florida',
        commitDate: COMMIT_DATE,
        stars: 3,
        natlRank: player.natlRank,
        fromSchool: 'Maryland',
      },
    },
  };
  const intelOut = await intel.addIntel(intelRow);

  await store.fireRecruitingEvent({
    eventType: 'flip',
    player,
    skinny,
    detail: 'Terrance Grant flipped from Maryland to Florida (2026-11-17).',
    source: 'manual',
  });

  const fcPath = path.join(__dirname, '..', 'data', 'players.json');
  const fcPlayers = JSON.parse(fs.readFileSync(fcPath, 'utf8'));
  const fcIdx = fcPlayers.findIndex((p) => String(p.slug || '').toLowerCase() === SLUG);
  const fcRow = {
    id: null,
    full_name: 'Terrance Grant',
    slug: SLUG,
    class_year: 2027,
    position: 'RB',
    status: 'HS',
    height: 71,
    weight: 220,
    hometown: 'Hyattsville',
    state: 'MD',
    high_school: 'DeMatha Catholic',
    stars: 3,
    composite_rating: 0.8737,
    ranking_national: 732,
    ranking_position: 53,
    ranking_state: 17,
    committed_to: 'Florida',
    high_school_profile: {
      offers: [],
      stats: {
        stars: 3,
        rating: 87.37,
        natl_rank: 732,
        pos_rank: 53,
        state_rank: 17,
        on3_id: ON3_ID,
      },
      recruiting_notes: profileNote,
      discovery_score: null,
    },
  };
  if (fcIdx >= 0) {
    fcPlayers[fcIdx] = { ...fcPlayers[fcIdx], ...fcRow, high_school_profile: fcRow.high_school_profile };
  } else {
    const after = fcPlayers.findIndex((p) => String(p.slug || '') === 'moreno-fisher');
    if (after >= 0) fcPlayers.splice(after + 1, 0, fcRow);
    else fcPlayers.push(fcRow);
  }

  const rankMap = new Map();
  try {
    const recruiting = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'data', 'recruiting', 'players.json'), 'utf8')
    );
    for (const row of Array.isArray(recruiting) ? recruiting : []) {
      if (!row?.slug) continue;
      if (Number(row.classYear) !== 2027 && Number(row.classYear) !== 2028) continue;
      rankMap.set(String(row.slug).toLowerCase(), row);
    }
  } catch {
    /* optional */
  }
  for (const row of fcPlayers) {
    const src = rankMap.get(String(row.slug || '').toLowerCase());
    if (!src || src.natlRank == null) continue;
    if (src.natlRank != null) row.ranking_national = src.natlRank;
    if (src.posRank != null) row.ranking_position = src.posRank;
    if (src.stateRank != null) row.ranking_state = src.stateRank;
    if (src.stars != null) row.stars = src.stars;
    if (src.rating != null) row.composite_rating = Number(src.rating) > 1 ? Number(src.rating) / 100 : Number(src.rating);
  }
  fs.writeFileSync(fcPath, `${JSON.stringify(fcPlayers, null, 2)}\n`, 'utf8');

  const evalOut = runVaultEval();

  require('../lib/on3-snapshot-commits').clearSnapshotCommitKeyCache?.();
  const { clearSnapshotCommitKeyCache } = require('../lib/recruiting-verified-commits');
  if (typeof clearSnapshotCommitKeyCache === 'function') clearSnapshotCommitKeyCache();

  const saved = await store.findBySlug(SLUG);
  const hub = await store.getHubCommits(2027);
  const news = pickWeeklyNowBreakIn(new Date('2026-11-17T18:00:00.000Z'));

  const elite = require('../lib/recruiting-hub-elite');
  const cache = require('../lib/recruiting-hub-cache');
  for (const year of [2026, 2027, 2028]) {
    const commits = await elite.buildHubCommits(year);
    cache.writeHubDiskSnapshot('commits', year, commits);
    const footprint = await elite.buildHubFootprint(year);
    cache.writeHubDiskSnapshot('footprint', year, footprint);
    const hero = await elite.buildHubHero(year);
    cache.writeHubDiskSnapshot('hero', year, hero);
    const bundle = await elite.buildHubBundle(year);
    cache.writeHubDiskSnapshot('bundle', year, bundle);
    const ticker = await elite.buildHubTicker(year);
    cache.writeHubDiskSnapshot('ticker', year, ticker);
  }
  const overview = await elite.buildHubClassOverview(2027);
  cache.writeHubDiskSnapshot('class-overview', 2027, overview);
  const allOverview = {};
  for (const year of [2026, 2027, 2028]) {
    allOverview[year] = await elite.buildHubClassOverview(year);
  }
  cache.writeHubDiskSnapshot('class-overview-all', null, allOverview);

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
        fromSchool: saved && saved.fromSchool,
        hubHasGrant: hub.some((p) => p.slug === SLUG),
        hubCount2027: hub.length,
        intelCreated: Boolean(intelOut?.created || intelOut?.item),
        intelReason: intelOut?.reason || null,
        news: news && news.text,
        vaultScouting: getVaultScoutingForSlug(SLUG) ? 'SHOW' : 'HIDDEN',
        comparison: bd && bd.comparison,
        projection: bd && bd.projection,
        filmWatched: bd && bd.filmWatched,
        classOverview: {
          classRank: overview?.classRank,
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
