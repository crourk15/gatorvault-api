#!/usr/bin/env node
/**
 * Write-through: refresh every prepared-meal stamp's rank fields from players.json.
 * Live GET overlay is the source of truth; this keeps baked stamps from drifting.
 *
 *   node server/scripts/refresh-stamp-ranks-from-store.js
 */
const fs = require('fs');
const path = require('path');

const STAMP_DIR = path.join(__dirname, '..', 'data', 'player-profiles', 'stamps');
const PLAYERS_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'players.json');

function main() {
  const players = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf8'));
  const bySlug = new Map(players.map((p) => [String(p.slug || '').toLowerCase(), p]));
  const files = fs.readdirSync(STAMP_DIR).filter((f) => f.endsWith('.json'));
  let updated = 0;
  let skipped = 0;
  for (const file of files) {
    const slug = file.replace(/\.json$/i, '').toLowerCase();
    const store = bySlug.get(slug);
    const filePath = path.join(STAMP_DIR, file);
    const doc = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!store || !doc.player) {
      skipped += 1;
      continue;
    }
    const natl = store.natlRank;
    const pos = store.posRank;
    const state = store.stateRank;
    const rating = store.rating ?? store.displayRating;
    const stars = store.stars;
    let changed = false;
    const player = { ...doc.player };
    if (natl != null && Number(player.rankingNational) !== Number(natl)) {
      player.rankingNational = natl;
      changed = true;
    }
    if (pos != null && Number(player.rankingPosition) !== Number(pos)) {
      player.rankingPosition = pos;
      changed = true;
    }
    if (state != null && Number(player.rankingState) !== Number(state)) {
      player.rankingState = state;
      changed = true;
    }
    if (rating != null && Number(player.compositeRating) !== Number(rating)) {
      player.compositeRating = rating;
      changed = true;
    }
    if (stars != null && Number(stars) > 0 && Number(player.stars) !== Number(stars)) {
      player.stars = stars;
      changed = true;
    }
    let highSchoolProfile = doc.highSchoolProfile;
    if (highSchoolProfile && typeof highSchoolProfile === 'object') {
      const stats = { ...(highSchoolProfile.stats || {}) };
      if (natl != null && Number(stats.natlRank) !== Number(natl)) {
        stats.natlRank = natl;
        changed = true;
      }
      if (pos != null && Number(stats.posRank) !== Number(pos)) {
        stats.posRank = pos;
        changed = true;
      }
      if (state != null && Number(stats.stateRank) !== Number(state)) {
        stats.stateRank = state;
        changed = true;
      }
      if (rating != null && Number(stats.rating) !== Number(rating)) {
        stats.rating = rating;
        changed = true;
      }
      if (stars != null && Number(stars) > 0 && Number(stats.stars) !== Number(stars)) {
        stats.stars = stars;
        changed = true;
      }
      highSchoolProfile = { ...highSchoolProfile, stats };
    }
    if (!changed) {
      skipped += 1;
      continue;
    }
    const next = {
      ...doc,
      player,
      ...(highSchoolProfile ? { highSchoolProfile } : {}),
      stampMeta: {
        ...(doc.stampMeta || {}),
        ranksSyncedAt: new Date().toISOString(),
        stampedAt: new Date().toISOString(),
      },
    };
    fs.writeFileSync(filePath, JSON.stringify(next, null, 2));
    updated += 1;
    console.log('updated', slug, { natl, pos, state, rating });
  }
  console.log(JSON.stringify({ ok: true, files: files.length, updated, skipped }, null, 2));
}

main();
