#!/usr/bin/env node
/**
 * Backfill verified high schools for locked 2028 allowlist targets from On3 profiles.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const store = require('../lib/recruiting-store');
const { ALLOWLIST_2028, CANONICAL_TARGET_NAMES } = require('../lib/recruiting-target-allowlist');
const { isPlaceholderSchool } = require('../lib/recruiting-placeholder-school');
const { discoverOn3RecruitSlug, profileToSchoolPatch } = require('../lib/on3-recruit-discovery');
const { persistAllowlistPlayerToJson } = require('../lib/allowlist-school-persist');

const DELAY_MS = Math.max(500, parseInt(process.env.ON3_INGEST_DELAY_MS || '650', 10) || 650);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const raw = hit.split('=')[1];
  if (raw == null || raw === '') return fallback;
  return raw;
}

async function backfillSlug(slug, classYear, dryRun) {
  const existing = store.findBySlug
    ? store.findBySlug(slug)
    : JSON.parse(fs.readFileSync(store.PLAYERS_PATH, 'utf8')).find((p) => p.slug === slug);

  if (existing?.school && !isPlaceholderSchool(existing.school)) {
    return { slug, ok: true, skipped: true, reason: 'already_resolved', school: existing.school };
  }

  const discovery = await discoverOn3RecruitSlug(slug, {
    classYear,
    player: existing,
    name: CANONICAL_TARGET_NAMES[slug] || existing?.name,
    pos: existing?.pos,
  });

  const patch = profileToSchoolPatch(discovery.profile);
  if (!patch.school) {
    return {
      slug,
      ok: false,
      reason: 'school_not_found',
      source: discovery.source,
      name: CANONICAL_TARGET_NAMES[slug] || existing?.name,
    };
  }

  patch.name = CANONICAL_TARGET_NAMES[slug] || existing?.name || slug;
  patch.pos = existing?.pos || discovery.profile?.pos || null;
  patch.classYear = classYear;

  if (!dryRun) {
    persistAllowlistPlayerToJson(slug, patch);
  }

  return {
    slug,
    ok: true,
    school: patch.school,
    state: patch.state,
    inState: patch.inState,
    on3Slug: patch.on3Slug,
    source: discovery.source,
    dryRun,
  };
}

async function main() {
  const classYear = Number(parseArg('class-year', 2028));
  const slugFilter = parseArg('slug', null);
  const dryRun = process.argv.includes('--dry-run');
  const slugs = slugFilter ? [String(slugFilter).toLowerCase()] : ALLOWLIST_2028;

  const results = { resolved: [], pending: [], skipped: [], failed: [] };

  for (let i = 0; i < slugs.length; i += 1) {
    const slug = slugs[i];
    try {
      const row = await backfillSlug(slug, classYear, dryRun);
      if (row.skipped) results.skipped.push(row);
      else if (row.ok) results.resolved.push(row);
      else results.pending.push(row);
    } catch (err) {
      results.failed.push({ slug, error: err.message });
    }
    if (i < slugs.length - 1) await sleep(DELAY_MS);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun,
        classYear,
        total: slugs.length,
        resolvedCount: results.resolved.length,
        pendingCount: results.pending.length,
        skippedCount: results.skipped.length,
        failedCount: results.failed.length,
        ...results,
      },
      null,
      2
    )
  );

  if (results.pending.length || results.failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
