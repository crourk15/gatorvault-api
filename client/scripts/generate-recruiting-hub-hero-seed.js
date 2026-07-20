#!/usr/bin/env node
/**
 * Bake recruiting class metrics into a static seed for SSR / inline boot.
 * First paint must show real numbers — never wait on a cold hub API.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(__dirname, '../lib/recruiting-hub-hero-seed.json');

async function main() {
  const elite = require(path.join(ROOT, 'server/lib/recruiting-hub-elite'));
  const years = [2026, 2027, 2028];
  const byYear = {};
  for (const year of years) {
    byYear[String(year)] = await elite.buildHubClassOverview(year);
  }

  const activeYear = 2027;
  const payload = {
    generatedAt: new Date().toISOString(),
    activeYear,
    title: 'Florida Recruiting',
    subtitle: 'Who Florida is chasing — movement, board, and beat intel.',
    classYears: years,
    classOverview: byYear[String(activeYear)],
    classOverviewAll: byYear,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  const overview = payload.classOverview || {};
  const blanks = ['classRank', 'blueChip', 'commits', 'avgRating'].filter(
    (k) => overview[k] == null || String(overview[k]).trim() === '' || String(overview[k]) === '—'
  );
  if (blanks.length >= 3) {
    console.error('[generate-recruiting-hub-hero-seed] FAIL — active year metrics mostly blank:', overview);
    process.exit(1);
  }

  console.log(
    '[generate-recruiting-hub-hero-seed] OK — ' +
      activeYear +
      ' ' +
      overview.classRank +
      ' / ' +
      overview.blueChip +
      ' / ' +
      overview.commits +
      ' / ' +
      overview.avgRating
  );
}

main().catch((err) => {
  console.error('[generate-recruiting-hub-hero-seed] fatal:', err);
  process.exit(1);
});
