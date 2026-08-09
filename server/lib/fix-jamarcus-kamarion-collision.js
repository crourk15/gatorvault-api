/**
 * Repair jamarcus-johnson ↔ Kamarion Johnson collision and seed the real
 * 2028 Toombs County DL Jamarcus Johnson onto the board.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { addToAdminAllowlist } = require('./admin-allowlist-store');
const store = require('./recruiting-store');
const { resolveRecruitingDataDir } = require('./recruiting-data-dir');
const { KNOWN_COLLISION_FIXES, hasSlugNameFirstMismatch } = require('./recruit-identity-collision');

function playersPath() {
  return path.join(resolveRecruitingDataDir(), 'players.json');
}

function readPlayers() {
  try {
    const raw = JSON.parse(fs.readFileSync(playersPath(), 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writePlayers(players) {
  fs.writeFileSync(playersPath(), `${JSON.stringify(players, null, 2)}\n`);
}

/** Only purge the known Jamarcus←Kamarion poison row (and exact first-name mismatches on that slug). */
async function purgeMismatchedPlayers() {
  const raw = readPlayers();
  const removed = [];
  const next = raw.filter((p) => {
    const slug = String(p.slug || '').toLowerCase();
    const name = String(p.name || '');
    if (slug === 'jamarcus-johnson' && /^kamarion\b/i.test(name)) {
      removed.push({ slug, name, reason: 'known_jamarcus_kamarion_collision' });
      return false;
    }
    // Extra safety: jamarcus-johnson must not hold any non-Jamarcus first name.
    if (slug === 'jamarcus-johnson' && hasSlugNameFirstMismatch(p)) {
      removed.push({ slug, name, reason: 'jamarcus_slug_name_mismatch' });
      return false;
    }
    return true;
  });
  if (removed.length) writePlayers(next);
  return { removed, path: playersPath() };
}

async function seedJamarcusJohnson() {
  const fix = KNOWN_COLLISION_FIXES[0].correct;
  const allow = addToAdminAllowlist({
    slug: fix.slug,
    name: fix.name,
    classYear: fix.classYear,
  });

  let hydrated = null;
  try {
    const hydrate = require('./on3-board-hydrate');
    hydrated = await hydrate.hydrateRecruitBoard({
      slug: fix.slug,
      name: fix.name,
      classYear: fix.classYear,
      pos: fix.pos,
      force: true,
    });
  } catch (err) {
    hydrated = { error: err.message };
  }

  const base = {
    slug: fix.slug,
    name: fix.name,
    classYear: fix.classYear,
    pos: fix.pos,
    position: fix.pos,
    school: fix.school,
    htWt: fix.htWt,
    height: '6-5',
    weight: 330,
    state: fix.state,
    on3Slug: fix.on3Slug,
    on3ProfileUrl: `https://www.on3.com/rivals/${fix.on3Slug}/`,
    status: 'uncommitted',
    category: 'target',
    on3Source: 'identity-collision-repair',
  };

  let player = hydrated?.player
    ? {
        ...hydrated.player,
        slug: fix.slug,
        name: fix.name,
        classYear: fix.classYear,
        pos: hydrated.player.pos || fix.pos,
        on3Slug: hydrated.player.on3Slug || fix.on3Slug,
        school: hydrated.player.school || fix.school,
        htWt: hydrated.player.htWt || fix.htWt,
      }
    : base;

  if (hasSlugNameFirstMismatch(player) || /^kamarion\b/i.test(String(player.name || ''))) {
    player = { ...base };
  }

  const saved = await store.upsertPlayer(player, { subsystem: 'identity-collision-repair' });

  try {
    const { feedDeskIntelToFutureCast } = require('./desk-intel-futurecast-feed');
    await feedDeskIntelToFutureCast({
      slug: fix.slug,
      player: saved || player,
      forceHydrate: false,
    });
  } catch {
    /* optional */
  }

  try {
    const hubCache = require('./recruiting-hub-cache');
    if (typeof hubCache.removeHubCacheKeys === 'function') {
      hubCache.removeHubCacheKeys([
        'hub:player:jamarcus-johnson',
        'hub:player:kamarion-johnson',
      ]);
    } else if (typeof hubCache.clearHubCache === 'function') {
      hubCache.clearHubCache();
    }
  } catch {
    /* optional */
  }

  return {
    allow,
    hydrated: Boolean(hydrated?.player),
    hydrateError: hydrated?.error || null,
    saved: saved
      ? {
          slug: saved.slug,
          name: saved.name,
          pos: saved.pos,
          classYear: saved.classYear,
          school: saved.school,
          htWt: saved.htWt,
          on3Slug: saved.on3Slug,
          ufRpmPct: saved.ufRpmPct ?? saved.ufProbability ?? null,
        }
      : null,
  };
}

async function repairJamarcusKamarionCollision() {
  const purged = await purgeMismatchedPlayers();
  const seeded = await seedJamarcusJohnson();
  return { ok: true, purged, seeded };
}

module.exports = {
  purgeMismatchedPlayers,
  seedJamarcusJohnson,
  repairJamarcusKamarionCollision,
};
