const assert = require('assert');
const {
  normalizePersonName,
  indexCfbdPlayers,
  matchRosterToCfbd,
  positionsCompatible,
} = require('../lib/roster-production-stats-match');
const {
  aggregateSeasonStats,
  buildProductionStats,
  primaryCategoryForPos,
  normalizeCategory,
} = require('../lib/roster-production-stats-transform');
const { normalizeProductionStats } = require('../lib/roster-store');
const { currentCfbdSeason, seasonsToFetch, hasCfbdApiKey } = require('../lib/cfbd-client');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}`);
    throw err;
  }
}

test('normalizePersonName strips Jr and punctuation', () => {
  assert.strictEqual(normalizePersonName('Eugene Wilson III'), 'eugene wilson');
  assert.strictEqual(normalizePersonName("Ja'Khari"), 'jakhari');
});

test('positionsCompatible allows missing and matching groups', () => {
  assert.strictEqual(positionsCompatible('WR', 'WR'), true);
  assert.strictEqual(positionsCompatible('WR', 'RB'), false);
  assert.strictEqual(positionsCompatible('WR', ''), true);
});

test('exact unique name match is exact', () => {
  const index = indexCfbdPlayers([
    { playerId: 1, player: 'Eugene Wilson III', position: 'WR' },
  ]);
  const match = matchRosterToCfbd({ name: 'Eugene Wilson III', pos: 'WR' }, index);
  assert.ok(match);
  assert.strictEqual(match.confidence, 'exact');
  assert.strictEqual(match.playerId, 1);
});

test('ambiguous same-name without position filter rejects', () => {
  const index = indexCfbdPlayers([
    { playerId: 1, player: 'John Smith', position: 'WR' },
    { playerId: 2, player: 'John Smith', position: 'RB' },
  ]);
  const match = matchRosterToCfbd({ name: 'John Smith', pos: '' }, index);
  assert.strictEqual(match, null);
});

test('same-name with position filter resolves', () => {
  const index = indexCfbdPlayers([
    { playerId: 1, player: 'John Smith', position: 'WR' },
    { playerId: 2, player: 'John Smith', position: 'RB' },
  ]);
  const match = matchRosterToCfbd({ name: 'John Smith', pos: 'WR' }, index);
  assert.ok(match);
  assert.strictEqual(match.playerId, 1);
});

test('cfbdPlayerId short-circuits to exact', () => {
  const index = indexCfbdPlayers([]);
  const match = matchRosterToCfbd(
    { name: 'Nobody', pos: 'WR', cfbdPlayerId: 99 },
    index
  );
  assert.ok(match);
  assert.strictEqual(match.playerId, 99);
  assert.strictEqual(match.confidence, 'exact');
});

test('aggregateSeasonStats builds receiving totals from flat + typed rows', () => {
  const agg = aggregateSeasonStats([
    {
      season: 2025,
      playerId: 10,
      player: 'Test Wr',
      position: 'WR',
      team: 'Florida',
      category: 'receiving',
      receptions: 22,
      receivingYards: 191,
      receivingTDs: 0,
    },
    {
      season: 2025,
      playerId: 10,
      player: 'Test Wr',
      position: 'WR',
      team: 'Florida',
      category: 'receiving',
      statType: 'LNG',
      stat: 23,
    },
  ]);
  const hit = agg.get('id:10');
  assert.ok(hit);
  assert.strictEqual(hit.seasons.length, 1);
  assert.strictEqual(hit.seasons[0].stats.rec, 22);
  assert.strictEqual(hit.seasons[0].stats.yds, 191);
  assert.strictEqual(hit.seasons[0].stats.lng, 23);
  assert.strictEqual(hit.seasons[0].stats.avg, 8.7);
});

test('buildProductionStats returns null without seasons or games', () => {
  const out = buildProductionStats({
    match: { confidence: 'exact', playerId: 1, cfbdName: 'X' },
    seasonAgg: new Map(),
    gameAggBySeason: new Map(),
    rosterPos: 'WR',
    syncedAt: new Date().toISOString(),
  });
  assert.strictEqual(out, null);
});

test('buildProductionStats attaches seasons for matched id', () => {
  const seasonAgg = aggregateSeasonStats([
    {
      season: 2025,
      playerId: 7,
      player: 'Aidan Mickelson',
      position: 'K',
      team: 'Florida',
      category: 'kicking',
      fgMade: 10,
      fgAttempts: 12,
    },
  ]);
  const out = buildProductionStats({
    match: { confidence: 'exact', playerId: 7, cfbdName: 'Aidan Mickelson' },
    seasonAgg,
    gameAggBySeason: new Map(),
    rosterPos: 'K',
    syncedAt: '2026-07-13T00:00:00.000Z',
  });
  assert.ok(out);
  assert.strictEqual(out.source, 'cfbd');
  assert.strictEqual(out.seasons[0].stats.fgm, 10);
});

test('normalizeProductionStats rejects filler / wrong source', () => {
  assert.strictEqual(normalizeProductionStats(null), null);
  assert.strictEqual(normalizeProductionStats({ source: 'espn', seasons: [] }), null);
  assert.strictEqual(
    normalizeProductionStats({ source: 'cfbd', seasons: [], recentGames: [] }),
    null
  );
  const ok = normalizeProductionStats({
    source: 'cfbd',
    syncedAt: '2026-01-01T00:00:00.000Z',
    matchConfidence: 'exact',
    seasons: [{ season: 2025, team: 'Florida', category: 'receiving', stats: { rec: 1 } }],
    recentGames: [],
  });
  assert.ok(ok);
  assert.strictEqual(ok.seasons[0].stats.rec, 1);
});

test('primaryCategoryForPos and normalizeCategory helpers', () => {
  assert.strictEqual(primaryCategoryForPos('WR'), 'receiving');
  assert.strictEqual(normalizeCategory('defensive'), 'defense');
});

test('currentCfbdSeason and seasonsToFetch are stable', () => {
  const jan = new Date(Date.UTC(2026, 0, 15));
  assert.strictEqual(currentCfbdSeason(jan), 2025);
  const sep = new Date(Date.UTC(2026, 8, 1));
  assert.strictEqual(currentCfbdSeason(sep), 2026);
  assert.deepStrictEqual(seasonsToFetch(jan, 2), [2025, 2024]);
});

test('hasCfbdApiKey reflects env without throwing', () => {
  assert.strictEqual(typeof hasCfbdApiKey(), 'boolean');
});

console.log('all roster production stats tests passed');

test('aggregateGameStats resolves opponent from homeTeam/awayTeam when only Florida box is present', () => {
  const { aggregateGameStats } = require('../lib/roster-production-stats-transform');
  const byPlayer = aggregateGameStats(
    [
      {
        week: 4,
        startDate: '2025-09-20T16:00:00.000Z',
        homeTeam: 'Florida',
        awayTeam: 'Texas',
        teams: [
          {
            school: 'Florida',
            homeAway: 'home',
            categories: [
              {
                name: 'defensive',
                types: [
                  {
                    name: 'TOT',
                    athletes: [{ id: 5086808, name: 'Brendan Bett', stat: '4' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    2025
  );
  const games = byPlayer.get('id:5086808');
  assert.ok(games);
  assert.equal(games[0].opponent, 'Texas');
  assert.equal(games[0].homeAway, 'home');
  assert.equal(games[0].week, 4);
  assert.ok(String(games[0].date).startsWith('2025-09-20'));
});

