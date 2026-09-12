const assert = require('assert');
const { applyOfficialGameLines, addStatMaps, mergeExistingForward } = require('../lib/roster-production-merge');
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

test('schedule helpers find the FAU official box as a candidate', () => {
  const board = require('../lib/schedule-board').getScheduleBoard(2026);
  const boxes = completedBoxes(board);
  assert.ok(boxes.some((g) => g.id === 'fau'));
  const candidates = candidateGames(board, new Date('2026-09-12T16:00:00.000Z'));
  assert.ok(candidates.some((g) => g.id === 'fau'));
  assert.ok(candidates.some((g) => g.id === 'campbell'));
  assert.ok(!candidates.some((g) => g.id === 'auburn'));
});

console.log('all official box roster stats tests passed');
