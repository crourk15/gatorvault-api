/**
 * One-shot geo backfill for recruiting players.json (or Supabase when configured).
 * Usage: node scripts/backfill-player-geo.js
 */
const store = require('../lib/recruiting-store');
const { normalizePlayerGeo } = require('../lib/recruiting-geo-normalize');

(async () => {
  const all = await store.getAllPlayers();
  let geoNormalizedCount = 0;
  let skipped = 0;

  for (const player of all) {
    const patch = normalizePlayerGeo(player);
    if (!patch.hometownState && !patch.hometownCity && patch.pinLat == null) {
      skipped += 1;
      continue;
    }
    const needsWrite =
      (patch.hometownState && patch.hometownState !== player.hometownState) ||
      (patch.hometownCity && patch.hometownCity !== player.hometownCity) ||
      (patch.pinLat != null && patch.pinLat !== player.pinLat) ||
      (patch.pinLng != null && patch.pinLng !== player.pinLng) ||
      (patch.stateFips && patch.stateFips !== player.stateFips);
    if (!needsWrite) {
      skipped += 1;
      continue;
    }
    await store.upsertPlayer({ ...player, ...patch }, { subsystem: 'geo-backfill' });
    geoNormalizedCount += 1;
  }

  console.log('Geo backfill complete:', geoNormalizedCount, 'updated,', skipped, 'unchanged');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
