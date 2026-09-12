#!/usr/bin/env node
/**
 * Merge an official UF box (Week 1 FAU) onto roster productionStats.
 *
 * Philo had no CFBD row (GT transfer; last Florida-only sync was July).
 * Existing CFBD careers keep source: cfbd so current iOS Stats tabs stay live.
 *
 * Usage:
 *   node server/scripts/apply-official-week1-box.js
 *   node server/scripts/apply-official-week1-box.js --file=server/data/roster/official-week1-fau-2026.json
 */
'use strict';

const fs = require('fs');
const path = require('path');
const rosterStore = require('../lib/roster-store');

function argValue(flag) {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : null;
}

function seasonKey(line) {
  return `${line.season}|${line.category}`;
}

function gameKey(line) {
  return `${line.season}|${line.week}|${line.opponent}|${line.category || ''}`;
}

function attachGameMeta(line, box) {
  return {
    season: box.season,
    week: box.week,
    date: box.date,
    opponent: box.opponent,
    homeAway: box.homeAway,
    category: line.category,
    stats: line.stats,
  };
}

function attachSeasonMeta(line, box) {
  return {
    season: box.season,
    team: 'Florida',
    category: line.category,
    stats: line.stats,
  };
}

function mergeStamp(existing, slice, box, syncedAt) {
  const stampedSeasons = (slice.seasons || []).map((s) => attachSeasonMeta(s, box));
  const stampedGames = (slice.recentGames || []).map((g) => attachGameMeta(g, box));
  const stampedSeasonKeys = new Set(stampedSeasons.map(seasonKey));
  const stampedGameKeys = new Set(stampedGames.map(gameKey));
  const priorSeasons = Array.isArray(existing?.seasons)
    ? existing.seasons.filter((s) => !stampedSeasonKeys.has(seasonKey(s)))
    : [];
  const priorGames = Array.isArray(existing?.recentGames)
    ? existing.recentGames.filter((g) => !stampedGameKeys.has(gameKey(g)))
    : [];
  return {
    source: slice.source === 'official' ? 'official' : existing?.source === 'cfbd' ? 'cfbd' : slice.source || 'official',
    syncedAt,
    cfbdPlayerId:
      existing?.cfbdPlayerId != null && Number.isFinite(Number(existing.cfbdPlayerId))
        ? Number(existing.cfbdPlayerId)
        : null,
    matchConfidence:
      existing?.matchConfidence === 'exact' || existing?.matchConfidence === 'high'
        ? existing.matchConfidence
        : null,
    seasons: [...stampedSeasons, ...priorSeasons],
    recentGames: [...stampedGames, ...priorGames].slice(0, 8),
  };
}

function main() {
  const rel = argValue('--file') || 'server/data/roster/official-week1-fau-2026.json';
  const file = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
  const box = JSON.parse(fs.readFileSync(file, 'utf8'));
  const syncedAt = new Date().toISOString();
  const raw = rosterStore.loadPlayersRaw();
  const updates = {};
  const missing = [];
  for (const [slug, slice] of Object.entries(box.players || {})) {
    const player = raw.find((p) => p.slug === slug);
    if (!player) {
      missing.push(slug);
      continue;
    }
    updates[slug] = mergeStamp(player.productionStats || null, slice, box, syncedAt);
  }
  if (missing.length) {
    console.error(`Missing roster slugs: ${missing.join(', ')}`);
    process.exit(1);
  }
  const result = rosterStore.applyProductionStatsUpdates(updates);
  const check = Object.keys(updates).map((slug) => {
    const live = rosterStore.getRosterPlayerBySlug(slug);
    const season = (live.productionStats?.seasons || []).find((s) => s.season === box.season);
    return {
      slug,
      source: live.productionStats?.source,
      week1: season ? season.stats : null,
    };
  });
  console.log(JSON.stringify({ changed: result.changed, check }, null, 2));
}

module.exports = { mergeStamp, attachGameMeta, attachSeasonMeta };

if (require.main === module) {
  main();
}
