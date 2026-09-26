#!/usr/bin/env node
/**
 * Editorial stamp: Cyion Smith → Florida (2028).
 * Charles confirmed 2026-09-26. Does not queue X or member email.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const COMMIT_DATE = '2026-09-26';
const SLUG = 'cyion-smith';

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
  if (!existing) throw new Error('cyion-smith missing from recruiting store');

  const skinny = 'S · 4★ · Blountstown · #250 natl';
  const profileNote = 'Cyion Smith committed to Florida on September 26, 2026.';
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
  applyCommitTargetCleanup(player, { source: 'stamp-cyion-smith-commit', quiet: false });

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
    hometownCity: player.hometownCity || 'Blountstown',
    hometownState: player.hometownState || 'FL',
    state: 'FL',
    htWt: player.htWt || '6-2 / 175',
    stars: player.stars,
    rating: player.rating,
    natlRank: player.natlRank,
    posRank: player.posRank,
    stateRank: player.stateRank,
    inState: true,
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
    playerId: String(player.on3Id || '242617'),
    playerSlug: SLUG,
    playerName: 'Cyion Smith',
    classYear: 2028,
    pos: 'S',
    eventType: 'commit',
    status: 'Committed · Florida',
    commitDate: COMMIT_DATE,
    timestamp: `${COMMIT_DATE}T18:20:00.000Z`,
    source: 'manual',
    sourceHandle: null,
    sourceType: 'manual',
    detail: 'Cyion Smith committed to Florida (2026-09-26). Blountstown 4-star safety. Charles confirmed.',
    text: '4★ S Cyion Smith has committed to Florida.',
    ufRelevant: true,
    reportedAt: `${COMMIT_DATE}T18:20:00.000Z`,
    fingerprint: `manual_commit_${SLUG}_${COMMIT_DATE}`,
    alertPosted: false,
    xPostQueued: false,
    xPosted: false,
    stars: 4,
    natlRank: player.natlRank,
    school: player.school,
    hometownState: 'FL',
    htWt: player.htWt || '6-2 / 175',
    identityConfirmed: true,
    surfaced: true,
    createdAt: new Date().toISOString(),
    committedTo: 'Florida',
    payload: {
      player: {
        slug: SLUG,
        name: 'Cyion Smith',
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
    detail: 'Cyion Smith committed to Florida (2026-09-26).',
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
    full_name: 'Cyion Smith',
    slug: SLUG,
    class_year: 2028,
    position: 'S',
    status: 'HS',
    height: null,
    weight: null,
    hometown: 'Blountstown',
    state: 'FL',
    high_school: 'Blountstown',
    stars: 4,
    composite_rating: 0.9,
    ranking_national: 250,
    ranking_position: 25,
    ranking_state: 29,
    committed_to: 'Florida',
    high_school_profile: {
      offers: [],
      stats: {
        stars: 4,
        rating: 90,
        natl_rank: 250,
        pos_rank: 25,
        state_rank: 29,
        on3_id: 'cyion-smith',
      },
      recruiting_notes: null,
      discovery_score: null,
    },
  };
  if (fcIdx >= 0) fcPlayers[fcIdx] = { ...fcPlayers[fcIdx], ...fcRow, high_school_profile: fcRow.high_school_profile };
  else {
    const after = fcPlayers.findIndex((p) => String(p.slug || '') === 'cassell-cruickshank');
    if (after >= 0) fcPlayers.splice(after + 1, 0, fcRow);
    else fcPlayers.push(fcRow);
  }
  fs.writeFileSync(fcPath, `${JSON.stringify(fcPlayers, null, 2)}\n`, 'utf8');

  const wr = require('../lib/war-room-store');
  const bd = wr.getBreakdownBySlug(SLUG);
  if (!bd || !/committed to Florida/i.test(String(bd.recruitingStory || ''))) {
    throw new Error('War Room recruitingStory was not stamped');
  }

  require('../lib/on3-snapshot-commits').clearSnapshotCommitKeyCache?.();
  const { clearSnapshotCommitKeyCache } = require('../lib/recruiting-verified-commits');
  if (typeof clearSnapshotCommitKeyCache === 'function') clearSnapshotCommitKeyCache();

  const saved = await store.findBySlug(SLUG);
  const hub = await store.getHubCommits(2028);
  const news = pickWeeklyNowBreakIn(new Date('2026-09-26T20:00:00.000Z'));

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
        hubHasSmith: hub.some((p) => p.slug === SLUG),
        hubCount2028: hub.length,
        allowlist: getAllowlistSet(2028).has(SLUG),
        intelCreated: Boolean(intelOut?.created || intelOut?.item),
        intelReason: intelOut?.reason || null,
        news: news && news.text,
        vaultScouting: getVaultScoutingForSlug(SLUG) ? 'SHOW' : 'HIDDEN',
        warRoom: bd.recruitingStory,
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
