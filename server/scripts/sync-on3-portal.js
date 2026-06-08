/**
 * Sync UF incoming portal transfers from On3 team commits board.
 * Source: https://www.on3.com/college/florida-gators/football/{year}/commits/
 * Uses transfer rows (transferRating) — NOT Rivals HS profiles or manual seed data.
 *
 * Run: node scripts/sync-on3-portal.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const on3 = require('../lib/on3-client');
const { upsertPlayer, getAllPlayers } = require('../lib/recruiting-store');
const { slugify } = require('../lib/slug');

const PORTAL_CLASS_YEAR = parseInt(process.env.ON3_PORTAL_CLASS_YEAR || '2026', 10);

function starsDisplay(stars) {
  const n = Math.min(5, Math.max(0, parseInt(stars, 10) || 0));
  return '★'.repeat(n);
}

function mergePortalPlayer(existing, incoming) {
  return {
    ...(existing || {}),
    ...incoming,
    skinny: existing?.skinny || incoming.skinny || '',
    profileNote: existing?.profileNote || incoming.profileNote || ''
  };
}

async function main() {
  const { transfers, url, classYear } = await on3.fetchFloridaPortalTransfers(PORTAL_CLASS_YEAR);
  if (!transfers.length) {
    throw new Error(`No portal transfers found on On3 commits board (${url})`);
  }

  const existing = await getAllPlayers();
  const byOn3 = new Map(existing.filter((p) => p.on3Id).map((p) => [String(p.on3Id), p]));
  const bySlug = new Map(existing.map((p) => [p.slug, p]));

  let updated = 0;
  for (const t of transfers) {
    const slug = slugify(t.name);
    const prev = (t.on3Id && byOn3.get(String(t.on3Id))) || bySlug.get(slug) || null;
    const player = mergePortalPlayer(prev, {
      slug,
      name: t.name,
      pos: t.pos,
      classYear: t.classYear,
      school: t.fromSchool,
      fromSchool: t.fromSchool,
      htWt: t.htWt,
      stars: t.stars,
      rating: t.rating,
      natlRank: t.natlRank,
      posRank: t.posRank,
      stateRank: t.stateRank,
      category: 'portal',
      status: t.status === 'enrolled' ? 'enrolled' : t.status || 'enrolled',
      committedTo: 'Florida',
      commitDate: t.commitDate,
      on3Id: t.on3Id,
      on3Slug: t.on3Slug,
      on3ProfileUrl: t.on3ProfileUrl,
      starsDisplay: starsDisplay(t.stars),
      on3Source: url
    });
    await upsertPlayer(player);
    updated += 1;
    console.log(`  ✓ ${t.name} — ${t.htWt} (${t.fromSchool})`);
  }

  console.log(`\nSynced ${updated} portal transfers from On3 commits board (${classYear}).`);
  console.log(`Source: ${url}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
