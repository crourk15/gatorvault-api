#!/usr/bin/env node
/**
 * Seed 2028–2030 recruits into recruiting/players.json from target boards + early watchlist.
 * Identity + rankings only — no synthetic UF % / fit (FutureCast engine owns those).
 */
const fs = require('fs');
const path = require('path');
const { ALLOWLIST_2028, CANONICAL_TARGET_NAMES } = require('../lib/recruiting-target-allowlist');

const ROOT = path.join(__dirname, '..');
const PLAYERS_PATH = path.join(ROOT, 'data', 'recruiting', 'players.json');
const TARGET_2028 = path.join(ROOT, 'data', 'recruiting', '2028-target-board.json');
const EARLY_WATCH = path.join(ROOT, 'data', 'futurecast', 'early-watchlist.json');

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function normalizeSeed(row, classYear) {
  const slug = String(row.slug || '').toLowerCase();
  if (!slug) return null;
  return {
    slug,
    name: row.name || CANONICAL_TARGET_NAMES[slug] || slug,
    pos: row.pos || row.position || null,
    classYear: Number(row.classYear ?? classYear),
    school: row.school || null,
    state: row.state || null,
    stars: row.stars ?? null,
    rating: row.rating ?? null,
    natlRank: row.natlRank ?? null,
    posRank: row.posRank ?? null,
    stateRank: row.stateRank ?? null,
    category: 'target',
    status: row.committedTo ? 'committed' : 'uncommitted',
    committedTo: row.committedTo ?? null,
    updatedAt: new Date().toISOString(),
  };
}

function main() {
  const existing = readJson(PLAYERS_PATH, []);
  const bySlug = new Map(existing.map((p) => [String(p.slug).toLowerCase(), p]));

  const seeds = [];

  const board2028 = readJson(TARGET_2028, { targets: [] });
  for (const slug of ALLOWLIST_2028) {
    const key = String(slug).toLowerCase();
    const fromBoard = (board2028.targets || []).find((t) => String(t.slug).toLowerCase() === key);
    seeds.push(normalizeSeed(fromBoard || { slug: key, name: CANONICAL_TARGET_NAMES[key] }, 2028));
  }

  const watch = readJson(EARLY_WATCH, { entries: [] });
  for (const entry of watch.entries || []) {
    seeds.push(normalizeSeed(entry, Number(entry.classYear)));
  }

  let added = 0;
  let updated = 0;
  for (const seed of seeds.filter(Boolean)) {
    const key = seed.slug;
    const prev = bySlug.get(key);
    if (!prev) {
      bySlug.set(key, seed);
      added += 1;
      continue;
    }
    const merged = { ...prev };
    for (const field of ['name', 'pos', 'classYear', 'school', 'state', 'stars', 'rating', 'natlRank', 'posRank', 'stateRank']) {
      if (merged[field] == null && seed[field] != null) merged[field] = seed[field];
    }
    if (JSON.stringify(merged) !== JSON.stringify(prev)) updated += 1;
    bySlug.set(key, merged);
  }

  const out = [...bySlug.values()].sort((a, b) => (a.classYear - b.classYear) || a.name.localeCompare(b.name));
  fs.writeFileSync(PLAYERS_PATH, `${JSON.stringify(out, null, 2)}\n`);

  const byClass = out.reduce((acc, p) => {
    const y = String(p.classYear || '?');
    acc[y] = (acc[y] || 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({ total: out.length, added, updated, byClass }, null, 2));
}

main();
