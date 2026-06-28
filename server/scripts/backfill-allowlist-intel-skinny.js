#!/usr/bin/env node
'use strict';

/**
 * Backfill real On3-derived skinny/evaluationSummary for allowlisted targets.
 * Run after sync:allowlist-on3 when audit:target-stubs reports placeholder skinny.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const store = require('../lib/recruiting-store');
const { ALLOWLIST_2027, ALLOWLIST_2028 } = require('../lib/recruiting-target-allowlist');
const { loadAdminAllowlist } = require('../lib/admin-allowlist-store');
const { isPlaceholderSchool, isPlaceholderSkinny } = require('../lib/recruiting-placeholder-school');
const {
  applyAllowlistIntelSkinny,
  formatAllowlistEvalSummary,
  persistAllowlistPlayerToJson,
} = require('../lib/allowlist-school-persist');
const { isCommittedElsewhere } = require('../lib/recruiting-target-filters');

async function main() {
  const admin = loadAdminAllowlist();
  const jobs = [
    ...ALLOWLIST_2027.map((slug) => ({ slug, classYear: 2027 })),
    ...ALLOWLIST_2028.map((slug) => ({ slug, classYear: 2028 })),
    ...(admin.slugs2027 || []).map((slug) => ({ slug, classYear: 2027 })),
    ...(admin.slugs2028 || []).map((slug) => ({ slug, classYear: 2028 })),
  ].filter((job, idx, arr) => arr.findIndex((j) => j.slug === job.slug && j.classYear === job.classYear) === idx);
  const results = { updated: 0, skinny: 0, schoolStillMissing: [], stillPlaceholder: [] };

  for (const { slug, classYear } of jobs) {
    const existing = await store.getPlayerBySlug(slug);
    if (!existing || isCommittedElsewhere(existing)) continue;

    let merged = applyAllowlistIntelSkinny({ ...existing, classYear });
    const summary = formatAllowlistEvalSummary(merged);
    const changed =
      summary &&
      (isPlaceholderSkinny(existing.skinny) ||
        existing.skinny !== merged.skinny ||
        existing.evaluationSummary !== merged.evaluationSummary);

    if (changed) {
      merged = await store.upsertPlayer({
        ...merged,
        evaluationSummary: summary,
        skinny: merged.skinny || summary,
        updatedAt: new Date().toISOString(),
      });
      results.updated += 1;
      if (merged.skinny && !isPlaceholderSkinny(merged.skinny)) results.skinny += 1;

      if (merged.school && !isPlaceholderSchool(merged.school)) {
        persistAllowlistPlayerToJson(slug, {
          name: merged.name,
          pos: merged.pos,
          classYear: merged.classYear,
          school: merged.school,
          state: merged.state ?? merged.hometownState ?? null,
          inState: merged.inState,
          rating: merged.rating,
          natlRank: merged.natlRank,
          posRank: merged.posRank,
          stateRank: merged.stateRank,
          stars: merged.stars,
          on3Source: merged.on3Source,
          on3Slug: merged.on3Slug,
          on3Id: merged.on3Id,
        });
      }
    }

    if (isPlaceholderSchool(merged.school)) results.schoolStillMissing.push(slug);
    if (isPlaceholderSkinny(merged.skinny)) results.stillPlaceholder.push(slug);
  }

  console.log(JSON.stringify({ ok: true, ...results }, null, 2));
  if (results.stillPlaceholder.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[backfill-allowlist-intel-skinny] error:', err.message);
  process.exit(1);
});
