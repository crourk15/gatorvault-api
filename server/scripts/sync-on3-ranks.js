/**
 * Backfill natlRank, posRank, stateRank (and related fields) from on3-snapshot.json
 * into players.json. Run: node scripts/sync-on3-ranks.js
 */
const path = require('path');
const fs = require('fs');
const { slugify } = require('../lib/slug');

const DATA_DIR = path.join(__dirname, '..', 'data', 'recruiting');
const PLAYERS_PATH = path.join(DATA_DIR, 'players.json');
const SNAPSHOT_PATH = path.join(DATA_DIR, 'on3-snapshot.json');

const players = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf8'));
const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));

const on3BySlug = {};
Object.values(snapshot.years || {}).forEach((year) => {
  Object.values(year.commits || {}).forEach((p) => {
    on3BySlug[slugify(p.name)] = p;
  });
});

let updated = 0;
players.forEach((p) => {
  const src = on3BySlug[p.slug];
  if (!src) return;
  const fields = [
    ['natlRank', 'natlRank'],
    ['posRank', 'posRank'],
    ['stateRank', 'stateRank'],
    ['rating', 'rating'],
    ['stars', 'stars'],
    ['htWt', 'htWt'],
    ['school', 'school'],
    ['on3Id', 'on3Id'],
    ['commitDate', 'commitDate']
  ];
  let changed = false;
  fields.forEach(([dst, srcKey]) => {
    const val = src[srcKey];
    if (val == null) return;
    const normalized = srcKey === 'rating' ? Number(val) : val;
    if (p[dst] !== normalized) {
      p[dst] = normalized;
      changed = true;
    }
  });
  if (changed) updated++;
});

fs.writeFileSync(PLAYERS_PATH, JSON.stringify(players, null, 2));
console.log(`Synced ranks for ${updated} players from on3-snapshot.json`);
