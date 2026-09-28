#!/usr/bin/env node
/**
 * Editorial stamp: Samuel Bailey → Florida (2028).
 * On3 2028 commits board lists C 09/28/26 (Last Update 09/28/26 12:03).
 * Same path as Cyion Smith. Does not queue X or member email.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const COMMIT_DATE = '2026-09-28';
const SLUG = 'samuel-bailey';

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

  const existing = await store.findBySlug(SLUG);
  if (!existing) throw new Error('samuel-bailey missing from recruiting store');

  const skinny = 'OT · 4★ · Jemison · #49 natl';
  const profileNote = 'Samuel Bailey committed to Florida on September 28, 2026.';
  const player = {
    ...existing,
    category: 'recruit',
    status: 'committed',
    committedTo: 'Florida',
    commitDate: COMMIT_DATE,
    protected: true,
    verifiedCommit: true,
    headliner: false,
    skinny,
    profileNote,
    ufOvStatus: null,
    nextVisitSchool: null,
    visitStart: null,
    visitEnd: null,
    updatedAt: new Date().toISOString(),
  };

  await store.upsertPlayer(player);
  persistAllowlistPlayerToJson(SLUG, player);
  applyCommitTargetCleanup(player, { source: 'stamp-samuel-bailey-commit', quiet: false });

  const snapshotPath = path.join(__dirname, '..', 'data', 'recruiting', 'on3-snapshot.json');
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  snapshot.years = snapshot.years || {};
  snapshot.years['2028'] = snapshot.years['2028'] || { commits: {}, rankings: null };
  const key = on3Client.playerKey(player);
  snapshot.years['2028'].commits[key] = {
    on3Id: String(player.on3Id),
    name: player.name,
    pos: player.pos,
    classYear: 2028,
    school: player.school,
    hometownCity: player.hometownCity || 'Huntsville',
    hometownState: player.hometownState || 'AL',
    state: 'AL',
    htWt: player.htWt || '6-5.5 / 300',
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
    playerId: String(player.on3Id || '283076'),
    playerSlug: SLUG,
    playerName: 'Samuel Bailey',
    classYear: 2028,
    pos: 'OT',
    eventType: 'commit',
    status: 'Committed · Florida',
    commitDate: COMMIT_DATE,
    timestamp: `${COMMIT_DATE}T16:03:00.000Z`,
    source: 'manual',
    sourceHandle: null,
    sourceType: 'manual',
    detail: 'Samuel Bailey committed to Florida (2026-09-28). Jemison (Huntsville, AL) 4-star OT. On3 2028 commits board C 09/28/26.',
    text: '4★ OT Samuel Bailey has committed to Florida.',
    ufRelevant: true,
    reportedAt: `${COMMIT_DATE}T16:03:00.000Z`,
    fingerprint: `manual_commit_${SLUG}_${COMMIT_DATE}`,
    alertPosted: false,
    xPostQueued: false,
    xPosted: false,
    stars: 4,
    natlRank: player.natlRank,
    school: player.school,
    hometownState: 'AL',
    htWt: player.htWt || '6-5.5 / 300',
    identityConfirmed: true,
    surfaced: true,
    createdAt: new Date().toISOString(),
    committedTo: 'Florida',
    payload: {
      player: {
        slug: SLUG,
        name: 'Samuel Bailey',
        committedTo: 'Florida',
        commitDate: COMMIT_DATE,
        stars: 4,
        natlRank: player.natlRank,
      },
    },
  };
  const intelOut = await intel.addIntel(intelRow);

  await store.fireRecruitingEvent({
    eventType: 'commit',
    player,
    skinny,
    detail: 'Samuel Bailey committed to Florida (2026-09-28).',
    source: 'manual',
  });

  const adminPath = path.join(__dirname, '..', 'data', 'recruiting', 'admin-allowlist.json');
  const admin = JSON.parse(fs.readFileSync(adminPath, 'utf8'));
  admin.slugs2028 = (admin.slugs2028 || []).filter((s) => s !== SLUG);
  if (admin.names) delete admin.names[SLUG];
  admin.updatedAt = new Date().toISOString();
  fs.writeFileSync(adminPath, `${JSON.stringify(admin, null, 2)}\n`, 'utf8');

  const fcPath = path.join(__dirname, '..', 'data', 'players.json');
  const fcPlayers = JSON.parse(fs.readFileSync(fcPath, 'utf8'));
  const fcIdx = fcPlayers.findIndex((p) => String(p.slug || '').toLowerCase() === SLUG);
  const fcRow = {
    id: null,
    full_name: 'Samuel Bailey',
    slug: SLUG,
    class_year: 2028,
    position: 'OT',
    status: 'HS',
    height: null,
    weight: null,
    hometown: 'Huntsville',
    state: 'AL',
    high_school: 'Jemison',
    stars: 4,
    composite_rating: 0.928,
    ranking_national: 49,
    ranking_position: 8,
    ranking_state: 3,
    committed_to: 'Florida',
    high_school_profile: {
      offers: [],
      stats: {
        stars: 4,
        rating: 93,
        natl_rank: 49,
        pos_rank: 8,
        state_rank: 3,
        on3_id: 'samuel-bailey',
      },
      recruiting_notes: null,
      discovery_score: null,
    },
  };
  if (fcIdx >= 0) fcPlayers[fcIdx] = { ...fcPlayers[fcIdx], ...fcRow, high_school_profile: fcRow.high_school_profile };
  else {
    const after = fcPlayers.findIndex((p) => String(p.slug || '') === 'cyion-smith');
    if (after >= 0) fcPlayers.splice(after + 1, 0, fcRow);
    else fcPlayers.push(fcRow);
  }
  fs.writeFileSync(fcPath, `${JSON.stringify(fcPlayers, null, 2)}\n`, 'utf8');

  const wr = require('../lib/war-room-store');
  const existingBd = wr.getBreakdownBySlug(SLUG);
  if (!existingBd) throw new Error('War Room breakdown missing for samuel-bailey');
  const recruitingStory =
    'Samuel Bailey committed to Florida on September 28, 2026. Bailey is a 2028 OT out of Jemison (Huntsville, AL) — listed 6-5.5 / 300 — after two Gainesville visits.';
  if (!/committed to Florida/i.test(String(existingBd.recruitingStory || ''))) {
    wr.upsertBreakdown(SLUG, {
      ...existingBd,
      recruitingStory,
    });
  }
  const bd = wr.getBreakdownBySlug(SLUG);
  if (!bd || !/committed to Florida/i.test(String(bd.recruitingStory || '')) || !/Bailey/.test(String(bd.recruitingStory || ''))) {
    throw new Error('War Room recruitingStory was not stamped');
  }

  require('../lib/on3-snapshot-commits').clearSnapshotCommitKeyCache?.();
  const { clearSnapshotCommitKeyCache } = require('../lib/recruiting-verified-commits');
  if (typeof clearSnapshotCommitKeyCache === 'function') clearSnapshotCommitKeyCache();

  const saved = await store.findBySlug(SLUG);
  const hub = await store.getHubCommits(2028);
  const news = pickWeeklyNowBreakIn(new Date('2026-09-28T20:00:00.000Z'));

  const elite = require('../lib/recruiting-hub-elite');
  const cache = require('../lib/recruiting-hub-cache');
  for (const year of [2026, 2027, 2028]) {
    const commits = await elite.buildHubCommits(year);
    cache.writeHubDiskSnapshot('commits', year, commits);
    const footprint = await elite.buildHubFootprint(year);
    cache.writeHubDiskSnapshot('footprint', year, footprint);
  }
  const bundle = await elite.buildHubBundle(2028);
  cache.writeHubDiskSnapshot('bundle', 2028, bundle);
  const overview = await elite.buildHubClassOverview(2028);
  cache.writeHubDiskSnapshot('class-overview', 2028, overview);
  const hero = await elite.buildHubHero(2028);
  cache.writeHubDiskSnapshot('hero', 2028, hero);
  const ticker = await elite.buildHubTicker(2028);
  cache.writeHubDiskSnapshot('ticker', 2028, ticker);

  const { getAllowlistSet } = require('../lib/recruiting-target-allowlist');
  const { getVaultScoutingForSlug } = require('../lib/recruiting-hub-elite');

  console.log(
    JSON.stringify(
      {
        ok: true,
        slug: SLUG,
        status: saved.status,
        committedTo: saved.committedTo,
        commitDate: saved.commitDate,
        hubHasBailey: hub.some((p) => p.slug === SLUG),
        hubCount2028: hub.length,
        allowlist: getAllowlistSet(2028).has(SLUG),
        intelCreated: Boolean(intelOut?.created || intelOut?.item),
        intelReason: intelOut?.reason || null,
        news: news && news.text,
        vaultScouting: getVaultScoutingForSlug(SLUG) ? 'SHOW' : 'HIDDEN',
        warRoom: bd.recruitingStory,
        classOverview: {
          commits: overview?.commits,
          avgRating: overview?.avgRating,
          blueChip: overview?.blueChip,
        },
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
