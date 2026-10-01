const assert = require('assert');
const { applyOfficialGameLines, addStatMaps, mergeExistingForward, rebuildOfficialSeason } = require('../lib/roster-production-merge');
const { parseOfficialBoxHtml, matchRosterPlayer, indexRosterByName } = require('../lib/roster-official-box-parse');
const {
  weekForGame,
  completedBoxes,
  candidateGames,
  extractBoxScoreUrl,
  gameDayReached,
} = require('../lib/roster-official-box-sync');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}`);
    throw err;
  }
}

const SIDEARM_FIXTURE = `
<table>
  <th><span class="s-table-header__column-label">Cmp</span></th>
  <th><span class="s-table-header__column-label">Att</span></th>
  <th><span class="s-table-header__column-label">Yds.</span></th>
  <th><span class="s-table-header__column-label">TD</span></th>
  <th><span class="s-table-header__column-label">INT</span></th>
  <tr><td>Veltkamp, Caden</td><td>34</td><td>52</td><td>276</td><td>1</td><td>2</td></tr>
  <tr><td>Philo, Aaron</td><td>16</td><td>21</td><td>275</td><td>3</td><td>1</td></tr>
</table>
<table>
  <th><span class="s-table-header__column-label">Rec.</span></th>
  <th><span class="s-table-header__column-label">Yds.</span></th>
  <th><span class="s-table-header__column-label">TD</span></th>
  <th><span class="s-table-header__column-label">Long</span></th>
  <tr><td>Wilson, Dallas</td><td>3</td><td>47</td><td>0</td><td>19</td></tr>
</table>
<table>
  <th><span class="s-table-header__column-label">Solo</span></th>
  <th><span class="s-table-header__column-label">Ast</span></th>
  <th><span class="s-table-header__column-label">Tot</span></th>
  <th><span class="s-table-header__column-label">TFL/Yds</span></th>
  <tr><td>Graham, Myles</td><td>4</td><td>6</td><td>10</td><td>0.5-1</td></tr>
  <tr><td>Flowers, J&#39;Vari</td><td>2</td><td>4</td><td>6</td><td>0.5-1</td></tr>
</table>
<table>
  <th><span class="s-table-header__column-label">Player</span></th>
  <th><span class="s-table-header__column-label">Qtr</span></th>
  <th><span class="s-table-header__column-label">Clock</span></th>
  <th><span class="s-table-header__column-label">Yds</span></th>
  <th><span class="s-table-header__column-label">Result</span></th>
  <tr><td>Durkin, Patrick</td><td>1</td><td>02:06</td><td>53</td><td>GOOD</td></tr>
</table>
<table>
  <th><span class="s-table-header__column-label">Player</span></th>
  <th><span class="s-table-header__column-label">Att</span></th>
  <th><span class="s-table-header__column-label">Made</span></th>
  <th><span class="s-table-header__column-label">Att</span></th>
  <th><span class="s-table-header__column-label">Made</span></th>
  <th><span class="s-table-header__column-label">Att</span></th>
  <th><span class="s-table-header__column-label">Made</span></th>
  <tr><td>Padron, Liam</td><td>1</td><td>1</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
  <tr><td>Durkin, Patrick</td><td>8</td><td>8</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
</table>
`;

const ROSTER = [
  { slug: 'aaron-philo', name: 'Aaron Philo', pos: 'QB' },
  { slug: 'dallas-wilson', name: 'Dallas Wilson', pos: 'WR' },
  { slug: 'myles-graham', name: 'Myles Graham', pos: 'ILB' },
  { slug: 'jvari-flowers', name: "J'Vari Flowers", pos: 'LB' },
  { slug: 'patrick-durkin', name: 'Patrick Durkin', pos: 'K' },
  { slug: 'liam-padron', name: 'Liam Padron', pos: 'K' },
];

test('name match ignores Jr/III and last-first order', () => {
  const idx = indexRosterByName([
    { slug: 'tramell-jones-jr', name: 'Tramell Jones Jr.' },
    { slug: 'vernell-brown-iii', name: 'Vernell Brown III' },
  ]);
  assert.strictEqual(matchRosterPlayer('Jones Jr., Tramell', idx).slug, 'tramell-jones-jr');
  assert.strictEqual(matchRosterPlayer('Brown III, Vernell', idx).slug, 'vernell-brown-iii');
  assert.strictEqual(matchRosterPlayer('Veltkamp, Caden', idx), null);
});

test('parseOfficialBoxHtml keeps only UF roster rows', () => {
  const parsed = parseOfficialBoxHtml(SIDEARM_FIXTURE, ROSTER);
  assert.strictEqual(parsed.has('aaron-philo'), true);
  assert.strictEqual(parsed.has('dallas-wilson'), true);
  assert.strictEqual(parsed.has('myles-graham'), true);
  assert.strictEqual([...parsed.keys()].some((s) => /veltkamp/i.test(s)), false);
  assert.strictEqual(parsed.get('aaron-philo').lines[0].stats.yds, 275);
  assert.strictEqual(parsed.get('dallas-wilson').lines[0].stats.rec, 3);
  assert.strictEqual(parsed.get('myles-graham').lines[0].stats.tot, 10);
  assert.strictEqual(parsed.get('jvari-flowers').lines[0].stats.tot, 6);
  assert.strictEqual(parsed.get('patrick-durkin').lines[0].stats.fgm, 1);
  assert.strictEqual(parsed.get('patrick-durkin').lines[0].stats.xpm, 8);
  assert.strictEqual(parsed.get('patrick-durkin').lines[0].stats.pts, 11);
  assert.strictEqual(parsed.get('patrick-durkin').lines[0].stats.lng, 53);
  assert.strictEqual(parsed.get('liam-padron').lines[0].stats.xpm, 1);
  assert.strictEqual(parsed.get('liam-padron').lines[0].stats.pts, 1);
});

test('applyOfficialGameLines is idempotent then adds week 2', () => {
  const game1 = { season: 2026, week: 1, opponent: 'Florida Atlantic', homeAway: 'home', date: '2026-09-05T23:55:00.000Z' };
  const lines = [{ category: 'receiving', stats: { rec: 3, yds: 47, td: 0, lng: 19, avg: 15.7 } }];
  const first = applyOfficialGameLines(null, game1, lines, '2026-09-12T00:00:00.000Z');
  const again = applyOfficialGameLines(first, game1, lines, '2026-09-13T00:00:00.000Z');
  assert.strictEqual(again.seasons[0].stats.rec, 3);
  assert.strictEqual(again.recentGames.length, 1);

  const week2 = applyOfficialGameLines(
    again,
    { season: 2026, week: 2, opponent: 'Campbell', homeAway: 'home', date: '2026-09-12T23:00:00.000Z' },
    [{ category: 'receiving', stats: { rec: 2, yds: 30, td: 1, lng: 18 } }],
    '2026-09-13T00:00:00.000Z'
  );
  assert.strictEqual(week2.seasons[0].stats.rec, 5);
  assert.strictEqual(week2.seasons[0].stats.yds, 77);
  assert.strictEqual(week2.seasons[0].stats.td, 1);
  assert.strictEqual(week2.recentGames.length, 2);
  assert.strictEqual(week2.recentGames[0].week, 2);
});

test('missing week-1 game row does not double-count an existing season', () => {
  const existing = {
    source: 'official',
    seasons: [{ season: 2026, team: 'Florida', category: 'rushing', stats: { car: 6, yds: 20, td: 1 } }],
    recentGames: [{ season: 2026, week: 1, category: 'passing', stats: { cmp: 16, att: 21, yds: 275 } }],
  };
  const next = applyOfficialGameLines(
    existing,
    { season: 2026, week: 1, opponent: 'Florida Atlantic', homeAway: 'home' },
    [{ category: 'rushing', stats: { car: 6, yds: 20, td: 1 } }],
    '2026-09-12T00:00:00.000Z'
  );
  assert.strictEqual(next.seasons.find((s) => s.category === 'rushing').stats.car, 6);
  assert.strictEqual(next.recentGames.filter((g) => g.category === 'rushing').length, 1);
});

test('addStatMaps keeps the long', () => {
  const out = addStatMaps({ rec: 3, yds: 47, lng: 19 }, { rec: 2, yds: 30, lng: 40 });
  assert.strictEqual(out.lng, 40);
  assert.strictEqual(out.avg, 15.4);
});

test('mergeExistingForward keeps a 2026 official game on a cfbd career', () => {
  const existing = {
    source: 'cfbd',
    seasons: [{ season: 2026, team: 'Florida', category: 'receiving', stats: { rec: 3, yds: 47 } }],
    recentGames: [{ season: 2026, week: 1, category: 'receiving', stats: { rec: 3 } }],
  };
  const cfbd = {
    source: 'cfbd',
    seasons: [{ season: 2025, team: 'Florida', category: 'receiving', stats: { rec: 12, yds: 162 } }],
    recentGames: [{ season: 2025, week: 12, category: 'receiving', stats: { rec: 1 } }],
  };
  const merged = mergeExistingForward(existing, cfbd);
  assert.strictEqual(merged.seasons[0].season, 2026);
  assert.strictEqual(merged.recentGames[0].week, 1);
});

test('schedule helpers find the FAU official box as week 1', () => {
  const board = require('../lib/schedule-board').getScheduleBoard(2026);
  const boxes = completedBoxes(board);
  assert.ok(boxes.some((g) => g.id === 'fau'));
  const fau = board.games.find((g) => g.id === 'fau');
  assert.strictEqual(weekForGame(board, fau), 1);
});

test('ops registry includes official box sync', () => {
  const { resolveJobId, JOBS } = require('../lib/ops-jobs');
  assert.strictEqual(resolveJobId('roster-official-box-sync'), 'roster-official-box-sync');
  assert.strictEqual(resolveJobId('roster-official-box'), 'roster-official-box-sync');
  assert.ok(JOBS['roster-official-box-sync']);
});

test('extractBoxScoreUrl reads the UF football box from game-center HTML', () => {
  const html = `
    <a href="/boxscore.aspx?id=28046">other sport</a>
    <a href="/sports/football/stats/2026/florida-atlantic/boxscore/27903">Box</a>
  `;
  assert.strictEqual(
    extractBoxScoreUrl(html, 2026),
    'https://floridagators.com/sports/football/stats/2026/florida-atlantic/boxscore/27903'
  );
  assert.strictEqual(extractBoxScoreUrl('<a href="/boxscore.aspx?id=1">x</a>', 2026), null);
});

test('game-day probe waits until kickoff day in New York', () => {
  const campbell = {
    id: 'campbell',
    date: 'September 12, 2026 · 5:30 PM ET',
    tickets: { gameCenter: 'https://floridagators.com/game-center/27904' },
  };
  assert.strictEqual(gameDayReached(campbell, new Date('2026-09-11T15:00:00.000Z')), false);
  assert.strictEqual(gameDayReached(campbell, new Date('2026-09-12T16:00:00.000Z')), true);
  assert.strictEqual(
    gameDayReached({ ...campbell, boxScoreUrl: 'https://example.com/box' }, new Date('2026-09-01T00:00:00.000Z')),
    true
  );
});

test('schedule helpers find completed official boxes as candidates', () => {
  const board = require('../lib/schedule-board').getScheduleBoard(2026);
  const boxes = completedBoxes(board);
  assert.ok(boxes.some((g) => g.id === 'fau'));
  assert.ok(boxes.some((g) => g.id === 'campbell'));
  assert.ok(boxes.some((g) => g.id === 'auburn'));
  assert.ok(boxes.some((g) => g.id === 'olemiss'));
  const candidates = candidateGames(board, new Date('2026-09-12T16:00:00.000Z'));
  assert.ok(candidates.some((g) => g.id === 'fau'));
  assert.ok(candidates.some((g) => g.id === 'campbell'));
  // A posted box / final score is always a candidate, even on a frozen earlier date.
  assert.ok(candidates.some((g) => g.id === 'auburn'));
  assert.ok(candidates.some((g) => g.id === 'olemiss'));
  assert.ok(!candidates.some((g) => g.id === 'missouri'));
});

test('Campbell Week 2 official box is on Philo / Baugh / Wilson', () => {
  const roster = require('../data/roster/players.json');
  const bySlug = new Map(roster.map((p) => [p.slug, p]));
  const week2 = (slug, category) =>
    (bySlug.get(slug)?.productionStats?.recentGames || []).find(
      (g) => g.week === 2 && g.opponent === 'Campbell' && g.category === category
    );
  assert.equal(week2('aaron-philo', 'passing')?.stats?.yds, 242);
  assert.equal(week2('aaron-philo', 'passing')?.stats?.td, 2);
  assert.equal(week2('jadan-baugh', 'rushing')?.stats?.yds, 136);
  assert.equal(week2('jadan-baugh', 'rushing')?.stats?.td, 2);
  assert.equal(week2('dallas-wilson', 'receiving')?.stats?.yds, 104);
});

test('Auburn Week 3 and Ole Miss Week 4 official boxes are on Philo / Baugh / Wilson', () => {
  const roster = require('../data/roster/players.json');
  const bySlug = new Map(roster.map((p) => [p.slug, p]));
  const game = (slug, week, opponent, category) =>
    (bySlug.get(slug)?.productionStats?.recentGames || []).find(
      (g) => g.week === week && g.opponent === opponent && g.category === category
    );
  const season = (slug, category) =>
    (bySlug.get(slug)?.productionStats?.seasons || []).find(
      (s) => s.season === 2026 && s.category === category
    );

  assert.equal(game('aaron-philo', 3, 'Auburn', 'passing')?.stats?.yds, 204);
  assert.equal(game('aaron-philo', 3, 'Auburn', 'passing')?.stats?.cmp, 15);
  assert.equal(game('aaron-philo', 3, 'Auburn', 'passing')?.stats?.att, 22);
  assert.equal(game('aaron-philo', 3, 'Auburn', 'passing')?.stats?.td, 1);
  assert.equal(game('aaron-philo', 3, 'Auburn', 'passing')?.stats?.int, 1);
  assert.equal(game('aaron-philo', 4, 'Ole Miss', 'passing')?.stats?.yds, 196);
  assert.equal(game('aaron-philo', 4, 'Ole Miss', 'passing')?.stats?.cmp, 16);
  assert.equal(game('aaron-philo', 4, 'Ole Miss', 'passing')?.stats?.att, 23);
  assert.equal(game('aaron-philo', 4, 'Ole Miss', 'passing')?.stats?.td, 1);
  assert.equal(game('aaron-philo', 4, 'Ole Miss', 'passing')?.stats?.int, 0);
  assert.deepEqual(season('aaron-philo', 'passing')?.stats, {
    cmp: 63,
    att: 87,
    yds: 917,
    td: 7,
    int: 2,
    lng: 63,
    avg: 10.5,
  });

  assert.equal(game('jadan-baugh', 3, 'Auburn', 'rushing')?.stats?.yds, 162);
  assert.equal(game('jadan-baugh', 3, 'Auburn', 'rushing')?.stats?.td, 3);
  assert.equal(game('jadan-baugh', 4, 'Ole Miss', 'rushing')?.stats?.yds, 142);
  assert.equal(game('jadan-baugh', 4, 'Ole Miss', 'rushing')?.stats?.td, 3);
  assert.equal(season('jadan-baugh', 'rushing')?.stats?.car, 83);
  assert.equal(season('jadan-baugh', 'rushing')?.stats?.yds, 600);
  assert.equal(season('jadan-baugh', 'rushing')?.stats?.td, 11);

  assert.equal(game('dallas-wilson', 3, 'Auburn', 'receiving')?.stats?.yds, 74);
  assert.equal(game('dallas-wilson', 3, 'Auburn', 'receiving')?.stats?.td, 1);
  assert.equal(game('dallas-wilson', 4, 'Ole Miss', 'receiving')?.stats?.yds, 11);
  assert.equal(season('dallas-wilson', 'receiving')?.stats?.rec, 14);
  assert.equal(season('dallas-wilson', 'receiving')?.stats?.yds, 236);
  assert.equal(season('dallas-wilson', 'receiving')?.stats?.td, 2);
});

test('every 2026 official week is on Brown / Graham after the full-box rebuild', () => {
  const roster = require('../data/roster/players.json');
  const bySlug = new Map(roster.map((p) => [p.slug, p]));
  const game = (slug, week, opponent, category) =>
    (bySlug.get(slug)?.productionStats?.recentGames || []).find(
      (g) => g.week === week && g.opponent === opponent && g.category === category
    );
  const season = (slug, category) =>
    (bySlug.get(slug)?.productionStats?.seasons || []).find(
      (s) => s.season === 2026 && s.category === category
    );

  assert.equal(game('vernell-brown-iii', 4, 'Ole Miss', 'receiving')?.stats?.rec, 3);
  assert.equal(game('vernell-brown-iii', 4, 'Ole Miss', 'receiving')?.stats?.yds, 25);
  assert.equal(game('vernell-brown-iii', 4, 'Ole Miss', 'rushing')?.stats?.yds, 6);
  assert.equal(season('vernell-brown-iii', 'receiving')?.stats?.rec, 17);
  assert.equal(season('vernell-brown-iii', 'receiving')?.stats?.yds, 271);
  assert.equal(season('vernell-brown-iii', 'rushing')?.stats?.car, 3);
  assert.equal(season('vernell-brown-iii', 'rushing')?.stats?.yds, 16);

  assert.equal(game('myles-graham', 2, 'Campbell', 'defense')?.stats?.tot, 6);
  assert.equal(game('myles-graham', 2, 'Campbell', 'defense')?.stats?.solo, 4);
  assert.equal(season('myles-graham', 'defense')?.stats?.tot, 28);
  assert.equal(season('myles-graham', 'defense')?.stats?.solo, 16);
  assert.equal(game('drake-stubbs', 2, 'Campbell', 'defense')?.stats?.tot, 2);
});

test('official replace corrects a stale week and keeps later weeks', () => {
  const stale = applyOfficialGameLines(
    null,
    { season: 2026, week: 2, opponent: 'Campbell', homeAway: 'home' },
    [{ category: 'defense', stats: { solo: 5, ast: 2, tot: 7, tfl: 1, ff: 1 } }],
    '2026-09-13T00:00:00.000Z'
  );
  const fixed = applyOfficialGameLines(
    stale,
    { season: 2026, week: 2, opponent: 'Campbell', homeAway: 'home' },
    [{ category: 'defense', stats: { solo: 4, ast: 2, tot: 6 } }],
    '2026-10-01T00:00:00.000Z'
  );
  assert.equal(fixed.recentGames[0].stats.solo, 4);
  assert.equal(fixed.seasons[0].stats.tot, 6);
  assert.equal(fixed.seasons[0].stats.ff, undefined);
});

test('rebuild keeps every official week for a multi-category player', () => {
  const rebuilt = rebuildOfficialSeason(
    {
      source: 'cfbd',
      seasons: [{ season: 2025, team: 'Florida', category: 'receiving', stats: { rec: 40, yds: 524 } }],
      recentGames: [{ season: 2025, week: 12, category: 'receiving', stats: { rec: 2 } }],
    },
    2026,
    [
      {
        game: { season: 2026, week: 1, opponent: 'Florida Atlantic', homeAway: 'home' },
        lines: [
          { category: 'receiving', stats: { rec: 6, yds: 117, td: 1 } },
          { category: 'rushing', stats: { car: 1, yds: 14 } },
        ],
      },
      {
        game: { season: 2026, week: 2, opponent: 'Campbell', homeAway: 'home' },
        lines: [
          { category: 'receiving', stats: { rec: 3, yds: 43, td: 1 } },
          { category: 'returning', stats: { pr: 4, prYds: 173 } },
        ],
      },
      {
        game: { season: 2026, week: 3, opponent: 'Auburn', homeAway: 'away' },
        lines: [
          { category: 'receiving', stats: { rec: 5, yds: 86 } },
          { category: 'rushing', stats: { car: 1, yds: -4 } },
          { category: 'returning', stats: { pr: 1, prYds: 16 } },
        ],
      },
      {
        game: { season: 2026, week: 4, opponent: 'Ole Miss', homeAway: 'home' },
        lines: [
          { category: 'receiving', stats: { rec: 3, yds: 25 } },
          { category: 'rushing', stats: { car: 1, yds: 6 } },
        ],
      },
    ],
    '2026-10-01T00:00:00.000Z'
  );
  const rec = rebuilt.seasons.find((s) => s.season === 2026 && s.category === 'receiving');
  assert.equal(rec.stats.rec, 17);
  assert.equal(rec.stats.yds, 271);
  assert.ok(rebuilt.seasons.some((s) => s.season === 2025 && s.category === 'receiving'));
  const weeks = new Set(rebuilt.recentGames.filter((g) => g.season === 2026).map((g) => g.week));
  assert.deepEqual([...weeks].sort(), [1, 2, 3, 4]);
  assert.ok(
    rebuilt.recentGames.some((g) => g.week === 4 && g.category === 'receiving' && g.stats.yds === 25)
  );
});

console.log('all official box roster stats tests passed');
