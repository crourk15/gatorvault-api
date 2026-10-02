#!/usr/bin/env node
/**
 * Spiegelman / Rivals: Texas 5-star WR commit Easton Royal visits Florida again Oct 10
 * (South Carolina homecoming). Keep Texas + Flip Watch. Do not stamp a UF commit.
 *
 * Visit intel upsert would set status uncommitted (verifiedCommit is false) — patch
 * the player directly and restore Texas after any intel write.
 */
'use strict';

const store = require('../lib/recruiting-store');
const visitLogStore = require('../lib/recruiting-visit-log-store');
const intelStore = require('../lib/recruiting-intel-store');

const SLUG = 'easton-royal';
const TEXAS = 'Texas Longhorns';

async function restoreTexas(existing) {
  return store.upsertPlayer({
    slug: SLUG,
    name: existing?.name || 'Easton Royal',
    status: 'committed',
    committedTo: existing?.committedTo || TEXAS,
    category: existing?.category === 'target' ? 'recruit' : existing?.category || 'recruit',
    ufOvStatus: existing?.ufOvStatus || 'completed',
    commitDate: existing?.commitDate || '2025-11-29T10:43:00',
    profileNote:
      '5★ WR committed to Texas — Closing Class Flip Watch #2. Return Florida trip Oct 10 (South Carolina homecoming).',
    visitStart: '2026-10-10',
    visitEnd: '2026-10-10',
    nextVisitSchool: 'Florida',
    visits: [
      {
        school: 'Florida',
        visitType: 'unofficial_visit',
        date: '2026-10-10',
        source: 'manual',
      },
    ],
  });
}

async function main() {
  const before = await store.getPlayerBySlug(SLUG);
  if (!before) {
    throw new Error('easton-royal missing from recruiting store');
  }
  if (!/texas/i.test(String(before.committedTo || ''))) {
    throw new Error(`refusing ingest — Royal is not a Texas commit (${before.committedTo})`);
  }

  const visit = visitLogStore.appendVisitLog({
    playerSlug: SLUG,
    playerId: before.on3Id || '243862',
    playerName: before.name || 'Easton Royal',
    school: 'Florida',
    visitType: 'unofficial_visit',
    date: '2026-10-10',
    source: 'manual',
    reportedAt: '2026-10-02T21:38:00.000Z',
    detail:
      'Sam Spiegelman / Rivals: Texas 5-star WR commit Easton Royal will visit Florida again October 10 (South Carolina homecoming). Plans can change. Still committed to Texas.',
  });

  const saved = await restoreTexas(before);

  // news — not unofficial_visit — so addIntel cannot wipe Texas via visit upsert.
  const intel = await intelStore.addIntel({
    playerId: String(before.on3Id || '243862'),
    playerSlug: SLUG,
    playerName: before.name || 'Easton Royal',
    classYear: 2027,
    pos: 'WR',
    eventType: 'news',
    source: 'manual',
    sourceHandle: 'samspiegels',
    timestamp: '2026-10-02T21:38:00.000Z',
    visitStart: '2026-10-10',
    visitEnd: '2026-10-10',
    nextVisitSchool: 'Florida',
    detail:
      'Sam Spiegelman / Rivals: Texas 5-star WR commit Easton Royal will visit Florida again October 10 (South Carolina homecoming). Still committed to Texas. Flip Watch.',
    identityConfirmed: true,
    ufRelevant: true,
  });

  const after = await store.getPlayerBySlug(SLUG);
  if (String(after?.status || '').toLowerCase() !== 'committed' || !/texas/i.test(String(after?.committedTo || ''))) {
    await restoreTexas(before);
    throw new Error('Texas commit was wiped — restored');
  }

  console.log(
    JSON.stringify(
      {
        visit: { created: visit.created, duplicate: visit.duplicate, fingerprint: visit.item?.fingerprint },
        intel: { created: intel.created, duplicate: intel.duplicate, skipped: intel.skipped, eventType: intel.item?.eventType },
        player: {
          slug: after.slug,
          status: after.status,
          committedTo: after.committedTo,
          visitStart: after.visitStart,
          visitEnd: after.visitEnd,
          nextVisitSchool: after.nextVisitSchool,
          ufOvStatus: after.ufOvStatus,
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
