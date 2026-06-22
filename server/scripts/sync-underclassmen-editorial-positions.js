#!/usr/bin/env node
/**
 * Sync editorial Younger Prospects positions to JSON store, Postgres, and identity patterns.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const store = require('../lib/recruiting-store');
const {
  listEditorial2028YoungerProspects,
  getEditorialPosition,
} = require('../lib/recruiting-editorial-positions');
const { CANONICAL_TARGET_NAMES } = require('../lib/recruiting-target-allowlist');
const patternStore = require('../lib/identity-patterns-store');

async function upsertPlayerPostgres(player) {
  const url = process.env.DATABASE_URL && String(process.env.DATABASE_URL).trim();
  if (!url || (process.env.SUPABASE_URL && String(process.env.SUPABASE_URL).trim())) return null;

  const normalized = store.normalizePlayer(player);
  const row = {
    slug: normalized.slug,
    name: normalized.name,
    pos: normalized.pos,
    class_year: normalized.classYear,
    school: normalized.school,
    ht_wt: normalized.htWt,
    stars: normalized.stars,
    rating: normalized.rating,
    natl_rank: normalized.natlRank,
    pos_rank: normalized.posRank,
    state_rank: normalized.stateRank,
    in_state: normalized.inState,
    category: normalized.category,
    status: normalized.status,
    committed_to: normalized.committedTo,
    from_school: normalized.fromSchool,
    commit_date: normalized.commitDate,
    skinny: normalized.skinny,
    profile_note: normalized.profileNote,
    on3_id: normalized.on3Id,
    stars_display: normalized.starsDisplay,
    updated_at: normalized.updatedAt || new Date().toISOString(),
  };

  const { Client } = require('pg');
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const cols = Object.keys(row);
    const vals = cols.map((_, i) => `$${i + 1}`);
    const updates = cols.filter((c) => c !== 'slug').map((c) => `${c} = EXCLUDED.${c}`);
    await client.query(
      `INSERT INTO players (${cols.join(', ')})
       VALUES (${vals.join(', ')})
       ON CONFLICT (slug) DO UPDATE SET ${updates.join(', ')}`,
      cols.map((c) => row[c])
    );
  } finally {
    await client.end().catch(() => {});
  }
  return row;
}

async function main() {
  const editorialRows = listEditorial2028YoungerProspects();
  const results = [];

  for (const editorial of editorialRows) {
    const slug = editorial.slug;
    const existing = await store.getPlayerBySlug(slug);
    const patch = {
      ...(existing || {}),
      slug,
      name: existing?.name || CANONICAL_TARGET_NAMES[slug] || slug,
      classYear: 2028,
      pos: editorial.pos,
      category: existing?.category || 'target',
      status: existing?.status || 'uncommitted',
      updatedAt: new Date().toISOString(),
    };
    if (editorial.stars != null) patch.stars = editorial.stars;

    const saved = await store.upsertPlayer(patch, { subsystem: 'editorial-position-sync' });
    await upsertPlayerPostgres(saved || patch);
    const pattern = await patternStore.syncPatternsForPlayer(saved || patch);

    results.push({
      slug,
      pos: (saved || patch).pos,
      stars: (saved || patch).stars,
      patternSynced: !!pattern && !pattern.rejected,
    });
  }

  const missing = results.filter((r) => !getEditorialPosition(r.slug)?.pos);
  const failedPatterns = results.filter((r) => !r.patternSynced);

  console.log(
    JSON.stringify(
      {
        ok: missing.length === 0 && failedPatterns.length === 0,
        synced: results.length,
        missing,
        failedPatterns: failedPatterns.map((r) => r.slug),
        results,
      },
      null,
      2
    )
  );

  if (missing.length || failedPatterns.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
