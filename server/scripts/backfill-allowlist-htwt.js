#!/usr/bin/env node
/**
 * Backfill htWt / height / weight from On3 recruit profiles.
 * Usage:
 *   node scripts/backfill-allowlist-htwt.js --class-year=2028
 *   node scripts/backfill-allowlist-htwt.js --class-year=2027
 *   node scripts/backfill-allowlist-htwt.js --all
 *   node scripts/backfill-allowlist-htwt.js --all --class-year=2028
 *   node scripts/backfill-allowlist-htwt.js --slug=john-matthews
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const store = require('../lib/recruiting-store');
const on3Recruit = require('../lib/on3-recruit-client');
const { ALLOWLIST_2027, ALLOWLIST_2028, CANONICAL_TARGET_NAMES } = require('../lib/recruiting-target-allowlist');
const { persistAllowlistPlayerToJson } = require('../lib/allowlist-school-persist');

const DELAY_MS = Math.max(200, parseInt(process.env.ON3_INGEST_DELAY_MS || '350', 10) || 350);
const CONCURRENCY = Math.max(1, parseInt(process.env.ON3_HTWT_CONCURRENCY || '3', 10) || 3);
const ALLOWLIST = new Set([...ALLOWLIST_2027, ...ALLOWLIST_2028].map((s) => String(s).toLowerCase()));

function parseArg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const raw = hit.split('=')[1];
  if (raw == null || raw === '') return fallback;
  return raw;
}

function needsHtWt(player) {
  return !String(player?.htWt || '').trim();
}

function loadPlayers() {
  return JSON.parse(fs.readFileSync(store.PLAYERS_PATH, 'utf8'));
}

function writePlayers(players) {
  fs.writeFileSync(store.PLAYERS_PATH, `${JSON.stringify(players, null, 2)}\n`);
}

function buildPatch(existing, profile) {
  const slug = String(existing.slug || '').toLowerCase();
  const patch = {
    htWt: profile.htWt,
    height: profile.height || null,
    weight: profile.weight ?? null,
    on3Slug: profile.slug || existing.on3Slug,
    on3ProfileUrl: profile.on3ProfileUrl || existing.on3ProfileUrl,
  };
  if (CANONICAL_TARGET_NAMES[slug]) patch.name = CANONICAL_TARGET_NAMES[slug];
  if (profile.school && (!existing.school || /,\s*[A-Z]{2}$/.test(String(existing.school)))) {
    patch.school = on3Recruit.schoolLabelFromOn3(profile) || profile.school;
  }
  if (profile.hometownCity) patch.hometownCity = profile.hometownCity;
  if (profile.state) {
    patch.state = profile.state;
    patch.hometownState = profile.state;
  }
  return patch;
}

async function fetchPatchForPlayer(existing, classYear) {
  const slug = String(existing.slug || '').toLowerCase();
  if (!needsHtWt(existing) && !process.argv.includes('--force')) {
    return { slug, ok: true, skipped: true, reason: 'already_has_htWt', htWt: existing.htWt };
  }
  const recruitSlug =
    existing.on3Slug ||
    (existing.on3Id ? `${store.slugify(existing.name || slug)}-${existing.on3Id}` : null);
  if (!recruitSlug) return { slug, ok: false, reason: 'no_on3_slug' };

  const year = Number(existing.classYear || classYear || 2028);
  const profile = await on3Recruit.fetchRecruitProfile(recruitSlug, year);
  if (!profile || profile.error) {
    return { slug, ok: false, reason: profile?.error || 'profile_empty', recruitSlug };
  }
  if (!profile.htWt) {
    return { slug, ok: false, reason: 'on3_missing_htWt', recruitSlug, name: profile.name };
  }
  return { slug, ok: true, patch: buildPatch(existing, profile), htWt: profile.htWt, school: profile.school };
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
      if (DELAY_MS > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }
  const workers = Math.min(Math.max(1, limit), Math.max(1, items.length));
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
}

async function main() {
  const classYearFilter = parseArg('class-year', null);
  const slugFilter = parseArg('slug', null);
  const allMode = process.argv.includes('--all');
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');

  let players = loadPlayers();
  let targets;

  if (slugFilter) {
    targets = players.filter((p) => String(p.slug).toLowerCase() === String(slugFilter).toLowerCase());
  } else if (allMode) {
    targets = players.filter((p) => {
      if (!(p.on3Slug || p.on3Id)) return false;
      if (classYearFilter && Number(p.classYear) !== Number(classYearFilter)) return false;
      return force || needsHtWt(p);
    });
  } else {
    const year = Number(classYearFilter || 2028);
    const base = year === 2027 ? ALLOWLIST_2027 : ALLOWLIST_2028;
    const want = new Set(base.map((s) => String(s).toLowerCase()));
    targets = players.filter((p) => want.has(String(p.slug).toLowerCase()));
  }

  console.log(JSON.stringify({ mode: allMode ? 'all' : 'allowlist', targets: targets.length, concurrency: CONCURRENCY, dryRun }, null, 2));

  const results = await mapPool(targets, CONCURRENCY, async (player) => {
    const row = await fetchPatchForPlayer(player, player.classYear || classYearFilter || 2028);
    console.log(JSON.stringify({
      slug: row.slug,
      ok: row.ok,
      skipped: row.skipped || false,
      reason: row.reason || undefined,
      htWt: row.htWt || undefined,
    }));
    return row;
  });

  if (!dryRun) {
    const bySlug = new Map();
    for (const row of results) {
      if (row?.ok && row.patch) bySlug.set(row.slug, row.patch);
    }
    if (bySlug.size) {
      players = loadPlayers();
      players = players.map((p) => {
        const patch = bySlug.get(String(p.slug).toLowerCase());
        return patch ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p;
      });
      writePlayers(players);

      for (const [slug, patch] of bySlug) {
        if (ALLOWLIST.has(slug)) {
          try {
            persistAllowlistPlayerToJson(slug, patch);
          } catch {
            /* board file optional */
          }
        }
      }
    }
  }

  const updated = results.filter((r) => r?.ok && r.patch).length;
  const skipped = results.filter((r) => r?.skipped).length;
  const failed = results.filter((r) => r && !r.ok).length;
  console.log(JSON.stringify({ ok: true, updated, skipped, failed, dryRun }, null, 2));
  process.exit(failed > 0 && updated === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});