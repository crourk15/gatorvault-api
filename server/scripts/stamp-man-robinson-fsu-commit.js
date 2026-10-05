#!/usr/bin/env node
/**
 * Editorial stamp: Man Robinson → Florida State (2028).
 * On3 + 247 2026-10-04. Drop from Chase / Closest. No X. No Home NOW News.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const COMMIT_DATE = '2026-10-04';
const SLUG = 'man-robinson';
const SCHOOL = 'Florida State';

async function main() {
  delete process.env.SUPABASE_URL;
  delete process.env.DATABASE_URL;

  const store = require('../lib/recruiting-store');
  const { persistAllowlistPlayerToJson } = require('../lib/allowlist-school-persist');
  const { removeSlugFromTargetBoard } = require('../lib/commit-target-cleanup');
  const { removeFromAdminAllowlist } = require('../lib/admin-allowlist-store');
  const intel = require('../lib/recruiting-intel-store');

  const existing = await store.findBySlug(SLUG);
  if (!existing) throw new Error('man-robinson missing from recruiting store');

  const skinny = '3★ CB · IMG Academy · committed to Florida State';
  const profileNote = 'Man Robinson committed to Florida State on October 4, 2026.';
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
  if (why[SLUG]) {
    delete why[SLUG];
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
    playerId: String(player.on3Id || '260972'),
    playerSlug: SLUG,
    playerName: 'Man Robinson',
    classYear: 2028,
    pos: 'CB',
    eventType: 'commit',
    status: 'Committed · Florida State',
    commitDate: COMMIT_DATE,
    timestamp: `${COMMIT_DATE}T21:57:00.000Z`,
    source: 'manual',
    sourceHandle: null,
    sourceType: 'manual',
    detail:
      'Man Robinson committed to Florida State (2026-10-04). IMG Academy CB, Louisville. On3 + 247. Dropped from 2028 Chase / Closest.',
    text: '3★ CB Man Robinson has committed to Florida State.',
    ufRelevant: false,
    reportedAt: `${COMMIT_DATE}T21:57:00.000Z`,
    fingerprint: `manual_commit_${SLUG}_${COMMIT_DATE}`,
    alertPosted: false,
    xPostQueued: false,
    xPosted: false,
    stars: 3,
    natlRank: player.natlRank,
    school: player.school,
    hometownState: 'KY',
    htWt: player.htWt || '5-10 / 180',
    identityConfirmed: true,
    surfaced: true,
    createdAt: new Date().toISOString(),
    committedTo: SCHOOL,
    payload: {
      player: {
        slug: SLUG,
        name: 'Man Robinson',
        committedTo: SCHOOL,
        commitDate: COMMIT_DATE,
        stars: 3,
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
  console.error('[stamp-man-robinson-fsu-commit]', err.message);
  process.exit(1);
});
