#!/usr/bin/env node
/**
 * Editorial stamp: Brysen Wright → Miami (2028).
 * Charles / Hayes Fawcett 2026-11-05. Drop from Chase / Closest.
 * No X. No Home NOW News (not a Florida commit).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const COMMIT_DATE = '2026-11-05';
const SLUG = 'brysen-wright';
const SCHOOL = 'Miami';

async function main() {
  delete process.env.SUPABASE_URL;
  delete process.env.DATABASE_URL;

  const store = require('../lib/recruiting-store');
  const { persistAllowlistPlayerToJson } = require('../lib/allowlist-school-persist');
  const { removeSlugFromTargetBoard } = require('../lib/commit-target-cleanup');
  const { removeFromAdminAllowlist } = require('../lib/admin-allowlist-store');
  const intel = require('../lib/recruiting-intel-store');

  const existing = await store.findBySlug(SLUG);
  if (!existing) throw new Error('brysen-wright missing from recruiting store');

  const skinny = '5★ WR · #1 natl · Mandarin, FL · committed to Miami';
  const profileNote = 'Brysen Wright committed to Miami on November 5, 2026.';
  const player = {
    ...existing,
    category: 'target',
    status: 'committed',
    committedTo: SCHOOL,
    commitDate: COMMIT_DATE,
    protected: false,
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
  removeFromAdminAllowlist({ slug: SLUG, classYear: 2028 });
  removeSlugFromTargetBoard(SLUG, 2028);

  const whyPath = path.join(__dirname, '..', 'data', 'recruiting', 'chase-why-overrides.json');
  const why = JSON.parse(fs.readFileSync(whyPath, 'utf8'));
  const whyBySlug = why.bySlug && typeof why.bySlug === 'object' ? why.bySlug : why;
  if (whyBySlug[SLUG]) {
    delete whyBySlug[SLUG];
    fs.writeFileSync(whyPath, `${JSON.stringify(why, null, 2)}\n`);
  }

  const on3Path = path.join(__dirname, '..', 'data', 'recruiting', 'on3-allowlist-slugs-2028.json');
  const on3 = JSON.parse(fs.readFileSync(on3Path, 'utf8'));
  if (on3.slugs && on3.slugs[SLUG]) {
    delete on3.slugs[SLUG];
    on3.updatedAt = new Date().toISOString();
    fs.writeFileSync(on3Path, `${JSON.stringify(on3, null, 2)}\n`);
  }

  const intelRow = {
    id: `intel_${SLUG}_commit_${COMMIT_DATE}`,
    playerId: String(player.on3Id || '242341'),
    playerSlug: SLUG,
    playerName: 'Brysen Wright',
    classYear: 2028,
    pos: 'WR',
    eventType: 'commit',
    status: 'Committed · Miami',
    commitDate: COMMIT_DATE,
    timestamp: `${COMMIT_DATE}T18:30:00.000Z`,
    source: 'manual',
    sourceHandle: null,
    sourceType: 'manual',
    detail:
      'Brysen Wright committed to Miami (2026-11-05). Mandarin 5-star WR, No. 1 nationally. Hayes Fawcett. Dropped from 2028 Chase / Closest.',
    text: '5★ WR Brysen Wright has committed to Miami.',
    ufRelevant: false,
    reportedAt: `${COMMIT_DATE}T18:30:00.000Z`,
    fingerprint: `manual_commit_${SLUG}_${COMMIT_DATE}`,
    alertPosted: false,
    xPostQueued: false,
    xPosted: false,
    stars: 5,
    natlRank: player.natlRank,
    school: player.school,
    hometownState: 'FL',
    htWt: player.htWt || '6-3.5 / 210',
    identityConfirmed: true,
    surfaced: true,
    createdAt: new Date().toISOString(),
    committedTo: SCHOOL,
    payload: {
      player: {
        slug: SLUG,
        name: 'Brysen Wright',
        committedTo: SCHOOL,
        commitDate: COMMIT_DATE,
        stars: 5,
        natlRank: player.natlRank,
      },
    },
  };
  const intelOut = await intel.addIntel(intelRow);

  const stamped = await store.findBySlug(SLUG);
  console.log(
    JSON.stringify(
      {
        ok: true,
        slug: SLUG,
        status: stamped.status,
        committedTo: stamped.committedTo,
        commitDate: stamped.commitDate,
        verifiedCommit: stamped.verifiedCommit,
        intelCreated: Boolean(intelOut && intelOut.item),
        intelSkipped: Boolean(intelOut && intelOut.skipped),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error('[stamp-brysen-wright-miami-commit]', err.message);
  process.exit(1);
});
