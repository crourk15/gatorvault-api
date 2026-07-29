#!/usr/bin/env node
'use strict';

/**
 * Pull On3/Hudl highlight URLs into film-traits for Beat Desk / board slugs.
 *
 * Usage:
 *   node server/scripts/hydrate-film-traits-from-on3.js casey-barner cj-craig-james
 *   node server/scripts/hydrate-film-traits-from-on3.js --desk
 *   node server/scripts/hydrate-film-traits-from-on3.js --desk --force
 */

const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const desk = args.includes('--desk');
  const slugs = args.filter((a) => !a.startsWith('--'));

  const ingest = require('../lib/film-traits-ingest');
  let items = slugs.map((slug) => ({ slug }));

  if (desk || !items.length) {
    try {
      const { getIntelInbox } = require('../lib/post-studio-intel-inbox');
      const inbox = await getIntelInbox({ deskMode: true, limit: 60 });
      const rows = inbox?.items || inbox?.rows || [];
      for (const it of rows) {
        const slug = it.playerSlug || it.slug;
        if (!slug || String(slug).startsWith('hub-')) continue;
        items.push({
          slug,
          playerName: it.playerName || it.name,
          classYear: it.classYear || 2028,
        });
      }
    } catch (err) {
      if (!slugs.length) {
        console.error('Desk inbox unavailable:', err.message);
        process.exit(1);
      }
    }
  }

  // unique
  const seen = new Set();
  items = items.filter((it) => {
    if (!it.slug || seen.has(it.slug)) return false;
    seen.add(it.slug);
    return true;
  });

  if (!items.length) {
    console.error('No slugs to hydrate');
    process.exit(1);
  }

  console.log(`Hydrating film traits for ${items.length} slug(s)...`);
  const out = await ingest.hydrateFilmTraitsBatch(items, { concurrency: 2, force });
  console.log(
    JSON.stringify(
      {
        total: out.total,
        hydrated: out.hydrated,
        failed: out.failed,
        withVideo: out.withVideo,
        sample: (out.results || []).slice(0, 12).map((r) => ({
          slug: r.slug,
          ok: r.ok,
          sourceCount: r.sourceCount,
          traitCount: r.traitCount,
          skipped: r.skipped,
          note: r.note || r.error || null,
        })),
      },
      null,
      2
    )
  );

  const dataPath = path.join(__dirname, '../data/recruiting/film-traits.json');
  console.log('Wrote:', dataPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
