/**
 * DISABLED — seed expansion blocked. Targets must come from On3, Rivals, 247,
 * verified UF offer lists, or staff dashboard entries only.
 * Run: node server/scripts/expand-2027-targets.js
 */
console.error('expand-2027-targets: DISABLED — no synthetic/seed target expansion allowed.');
process.exit(1);

const fs = require('fs');
const path = require('path');
const { slugify } = require('../lib/slug');

const PLAYERS_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'players.json');
const SEED_PATH = path.join(__dirname, '..', 'data', 'recruiting', '2027-target-board.json');

function isFloridaCommit(p) {
  const status = String(p.status || '').toLowerCase();
  const committedTo = String(p.committedTo || '').trim();
  return status === 'committed' && /^florida$/i.test(committedTo);
}

function mergeTarget(existing, seed) {
  return {
    ...existing,
    ...seed,
    id: existing?.id || seed.slug,
    slug: seed.slug,
    name: seed.name,
    classYear: 2027,
    category: 'target',
    status: seed.status || 'uncommitted',
    updatedAt: new Date().toISOString(),
  };
}

function main() {
  const players = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf8'));
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const bySlug = new Map(players.map((p) => [p.slug, p]));
  let added = 0;
  let updated = 0;

  for (const raw of seed.targets) {
    const slug = raw.slug || slugify(raw.name);
    const existing = bySlug.get(slug);
    if (existing && isFloridaCommit(existing)) continue;

    const record = mergeTarget(existing, { ...raw, slug });
    if (existing) {
      Object.assign(existing, record);
      updated++;
    } else {
      players.push(record);
      bySlug.set(slug, record);
      added++;
    }
  }

  fs.writeFileSync(PLAYERS_PATH, JSON.stringify(players, null, 2));

  const targetCount = players.filter(
    (p) => p.classYear === 2027 && p.category === 'target' && !isFloridaCommit(p)
  ).length;

  console.log(`expand-2027-targets: +${added} added, ${updated} updated`);
  console.log(`2027 uncommitted targets now: ${targetCount}`);
}

main();
