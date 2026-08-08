#!/usr/bin/env node
/**
 * Pre-cook player profile dossiers (prepared meals) for allowlist prospects/commits.
 *
 * Usage:
 *   node --import tsx server/scripts/stamp-player-profiles.js
 *   node --import tsx server/scripts/stamp-player-profiles.js --slugs=hudson-west,dj-uiagalelei
 *   node --import tsx server/scripts/stamp-player-profiles.js --write-bundle --limit=50
 *
 * Roster meals are already stamped in server/data/roster/players.json (resolve path).
 * This script stamps GET /api/player/full-profile dossiers; RPM is stripped and overlaid live.
 */
'use strict';

const path = require('path');

// Ensure TS API modules resolve when run from repo root / server cwd.
process.chdir(path.join(__dirname, '..'));

async function main() {
  const args = process.argv.slice(2);
  const writeBundle = args.includes('--write-bundle');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const slugsArg = args.find((a) => a.startsWith('--slugs='));
  const limit = limitArg ? Math.max(1, parseInt(limitArg.split('=')[1], 10) || 0) : 0;

  const stampStore = require('../lib/player-profile-stamp');
  const { buildFullProfileBySlug } = require('../api/player/build-full-profile.ts');

  let slugs = slugsArg
    ? slugsArg
        .slice('--slugs='.length)
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : stampStore.listAllowlistStampSlugs();

  if (limit > 0) slugs = slugs.slice(0, limit);

  console.log('[stamp-player-profiles] targets', slugs.length, {
    writeBundle,
    durableDir: stampStore.durableStampDir(),
    bundleDir: stampStore.BUNDLE_STAMP_DIR,
  });

  let ok = 0;
  let failed = 0;
  const errors = [];

  for (const slug of slugs) {
    try {
      const profile = await buildFullProfileBySlug(slug);
      if (!profile) {
        failed += 1;
        errors.push({ slug, error: 'not_found' });
        console.warn('[stamp-player-profiles] miss', slug);
        continue;
      }
      stampStore.writeStamp(slug, profile, { writeBundle });
      ok += 1;
      console.log('[stamp-player-profiles] stamped', slug, stampStore.inferProfileKind(profile));
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ slug, error: message });
      console.warn('[stamp-player-profiles] fail', slug, message);
    }
  }

  const coverage = stampStore.getStampCoverage();
  console.log(
    JSON.stringify(
      {
        ok: true,
        stamped: ok,
        failed,
        coverage,
        errors: errors.slice(0, 12),
      },
      null,
      2
    )
  );
  if (failed && !ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[stamp-player-profiles] fatal', err);
  process.exit(1);
});
