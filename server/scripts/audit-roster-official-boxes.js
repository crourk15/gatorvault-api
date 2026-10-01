#!/usr/bin/env node
/**
 * Diff every roster productionStats row against official UF boxes.
 *   node server/scripts/audit-roster-official-boxes.js
 */
'use strict';

const rosterStore = require('../lib/roster-store');
const { parseOfficialBoxHtml } = require('../lib/roster-official-box-parse');
const { addStatMaps } = require('../lib/roster-production-merge');

const BOXES = [
  {
    week: 1,
    opponent: 'Florida Atlantic',
    url: 'https://floridagators.com/sports/football/stats/2026/florida-atlantic/boxscore/27903',
  },
  {
    week: 2,
    opponent: 'Campbell',
    url: 'https://floridagators.com/sports/football/stats/2026/campbell/boxscore/27904',
  },
  {
    week: 3,
    opponent: 'Auburn',
    url: 'https://floridagators.com/sports/football/stats/2026/auburn/boxscore/27905',
  },
  {
    week: 4,
    opponent: 'Ole Miss',
    url: 'https://floridagators.com/sports/football/stats/2026/ole-miss/boxscore/27906',
  },
];

const SKIP_KEYS = new Set(['avg']);

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function statsEqual(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  const diffs = [];
  for (const key of keys) {
    if (SKIP_KEYS.has(key)) continue;
    const left = num(a?.[key]);
    const right = num(b?.[key]);
    if (left == null && right == null) continue;
    if (left == null || right == null || left !== right) diffs.push({ key, have: left, official: right });
  }
  return diffs;
}

async function fetchHtml(url) {
  const resp = await fetch(url, {
    headers: {
      Accept: 'text/html',
      'User-Agent': 'Mozilla/5.0 (compatible; GatorVaultRosterAudit/1.0)',
    },
  });
  if (!resp.ok) throw new Error(`${resp.status} ${url}`);
  return resp.text();
}

async function main() {
  const roster = rosterStore.loadPlayersRaw();
  const bySlug = new Map(roster.map((p) => [p.slug, p]));
  const officialBySlug = new Map();
  const unmatchedNames = [];

  for (const box of BOXES) {
    const html = await fetchHtml(box.url);
    const parsed = parseOfficialBoxHtml(html, roster);
    for (const [slug, hit] of parsed) {
      if (!officialBySlug.has(slug)) officialBySlug.set(slug, []);
      officialBySlug.get(slug).push({
        week: box.week,
        opponent: box.opponent,
        lines: hit.lines,
      });
    }
    console.error(`parsed ${box.opponent} W${box.week}: ${parsed.size} roster matches`);
  }

  const missingGames = [];
  const wrongGames = [];
  const wrongSeasons = [];
  const extraOnly = [];
  const noStats = [];

  for (const [slug, games] of officialBySlug) {
    const player = bySlug.get(slug);
    const stored = player?.productionStats || null;
    if (!stored) noStats.push(slug);
    const recent = stored?.recentGames || [];
    const seasons = (stored?.seasons || []).filter((s) => s.season === 2026);
    const officialSeason = {};

    for (const game of games) {
      for (const line of game.lines) {
        officialSeason[line.category] = addStatMaps(officialSeason[line.category] || {}, line.stats);
        const have = recent.find(
          (g) => g.season === 2026 && g.week === game.week && g.category === line.category
        );
        if (!have) {
          missingGames.push({
            slug,
            name: player?.name,
            week: game.week,
            opponent: game.opponent,
            category: line.category,
            official: line.stats,
          });
          continue;
        }
        const diffs = statsEqual(have.stats, line.stats);
        if (diffs.length) {
          wrongGames.push({
            slug,
            name: player?.name,
            week: game.week,
            opponent: game.opponent,
            category: line.category,
            diffs,
          });
        }
      }
    }

    for (const [category, stats] of Object.entries(officialSeason)) {
      const have = seasons.find((s) => s.category === category);
      const diffs = statsEqual(have?.stats, stats);
      if (!have || diffs.length) {
        wrongSeasons.push({
          slug,
          name: player?.name,
          category,
          have: have?.stats || null,
          official: stats,
          diffs,
        });
      }
    }
  }

  for (const player of roster) {
    const stored26 = (player.productionStats?.recentGames || []).filter((g) => g.season === 2026);
    if (!stored26.length) continue;
    if (!officialBySlug.has(player.slug)) extraOnly.push({ slug: player.slug, name: player.name, games: stored26.length });
  }

  const report = {
    officialPlayers: officialBySlug.size,
    missingGames: missingGames.length,
    wrongGames: wrongGames.length,
    wrongSeasons: wrongSeasons.length,
    noStats: noStats.length,
    extraOnly: extraOnly.length,
    missingGames,
    wrongGames,
    wrongSeasons,
    noStats,
    extraOnly,
    unmatchedNames,
  };
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
