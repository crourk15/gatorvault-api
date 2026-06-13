#!/usr/bin/env node
/**
 * Ingest missing Charles allow-list targets from On3 / Rivals / 247 (real data only).
 * Run: node server/scripts/ingest-allowlist-targets.js
 */
const fs = require('fs');
const path = require('path');
const {
  ALLOWLIST_2027,
  ALLOWLIST_2028,
  CANONICAL_TARGET_NAMES,
} = require('../lib/recruiting-target-allowlist');
const { rebuildPlayerIdentityFromOn3 } = require('../lib/identity-record-validator');
const identityLookup = require('../lib/player-identity-lookup');
const { validatePlayerIdentityRecord, sanitizePlayerFieldsForStore } = require('../lib/identity-record-validator');
const store = require('../lib/recruiting-store');

const PLAYERS_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'players.json');
const DELAY_MS = Math.max(250, parseInt(process.env.ON3_INGEST_DELAY_MS || '450', 10) || 450);

const SLUG_VARIANTS = {
  'tk-cunningham': ['tk-cunningham', 't-k-cunningham', 't.k.-cunningham'],
};

function isCompleteTarget(p) {
  return !!(p?.on3Id && p?.name && p?.pos && p?.classYear && (p.stars || p.natlRank));
}

async function ingestViaIdentityLookup(slug, classYear) {
  const playerName = CANONICAL_TARGET_NAMES[slug];
  if (!playerName) return { ok: false, error: 'missing_canonical_name' };

  const sources = await identityLookup.collectIdentitySources({
    playerSlug: slug,
    playerName,
    classYear,
  });
  const confirmation = identityLookup.confirmIdentity(sources);
  if (!confirmation.confirmed) {
    return { ok: false, error: 'identity_not_confirmed', sources: sources.length };
  }

  const merged = identityLookup.mergeMissingFields(
    { playerSlug: slug, classYear },
    confirmation.matchedSources
  );
  const patch = identityLookup.identityPatchFromSnapshot({
    ...merged,
    playerSlug: slug,
    classYear,
  });

  const candidate = sanitizePlayerFieldsForStore({
    slug,
    name: patch.name || playerName,
    pos: patch.pos || null,
    classYear,
    school: patch.school || patch.highSchool || patch.hometownState || null,
    stars: patch.stars || null,
    natlRank: patch.natlRank || null,
    on3Id: patch.on3Id || null,
    on3ProfileUrl: sources.find((s) => s.url)?.url || null,
    category: 'target',
    status: 'uncommitted',
    on3Source: confirmation.matchedSources[0]?.provider || 'verified',
    updatedAt: new Date().toISOString(),
  });

  const validation = validatePlayerIdentityRecord(candidate);
  if (!validation.valid) {
    return { ok: false, error: 'identity_still_invalid', validation: validation.errors };
  }

  const saved = await store.upsertPlayer(candidate, { subsystem: 'allowlist-ingest' });
  return { ok: true, name: saved.name, on3Id: saved.on3Id, provider: confirmation.mode };
}

async function ingestSlug(slug, classYear) {
  const variants = SLUG_VARIANTS[slug] || [slug];
  for (const variant of variants) {
    const result = await rebuildPlayerIdentityFromOn3(variant, { classYear });
    if (result.ok) {
      const saved = await store.upsertPlayer(
        {
          ...result.player,
          slug,
          classYear,
          category: 'target',
          status: result.player?.committedTo === 'Florida' ? 'committed' : 'uncommitted',
          on3Source: 'on3',
        },
        { subsystem: 'allowlist-ingest' }
      );
      return { slug, classYear, ok: true, name: saved.name, on3Id: saved.on3Id, via: 'on3' };
    }
  }

  return ingestViaIdentityLookup(slug, classYear).then((row) => ({
    slug,
    classYear,
    via: 'lookup',
    ...row,
  }));
}

async function main() {
  const players = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf8'));
  const bySlug = new Map(players.map((p) => [p.slug, p]));

  const jobs = [
    ...ALLOWLIST_2027.map((slug) => ({ slug, classYear: 2027 })),
    ...ALLOWLIST_2028.map((slug) => ({ slug, classYear: 2028 })),
  ];

  const results = { ingested: 0, skipped: 0, failed: [] };

  for (const { slug, classYear } of jobs) {
    const existing = bySlug.get(slug);
    if (isCompleteTarget(existing) && existing.classYear === classYear) {
      results.skipped += 1;
      continue;
    }

    process.stderr.write(`… ${classYear} ${slug}\n`);
    try {
      const row = await ingestSlug(slug, classYear);
      if (row.ok) {
        results.ingested += 1;
        bySlug.set(slug, row);
      } else {
        results.failed.push(row);
      }
    } catch (err) {
      results.failed.push({ slug, classYear, ok: false, error: err.message });
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log(JSON.stringify(results, null, 2));

  const { validateStoreTargets } = require('../lib/recruiting-target-allowlist');
  const finalPlayers = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf8'));
  const violations = validateStoreTargets(finalPlayers);
  if (violations.length) {
    console.error('[ingest-allowlist-targets] allow-list violations remain:', violations);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
