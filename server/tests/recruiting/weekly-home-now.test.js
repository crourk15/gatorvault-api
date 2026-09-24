'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildWeeklyHomeNowLines,
  buildWeeklyHomeNowCategories,
  seasonRecord,
} = require('../../lib/weekly-home-now');
const { getScheduleBoard } = require('../../lib/schedule-board');

test('Ole Miss week NOW is three pillars — Game owns ABC', () => {
  const now = new Date('2026-09-21T18:00:00.000Z');
  const lines = buildWeeklyHomeNowLines(now);
  assert.ok(lines.length >= 3);
  assert.match(lines[0], /^Game — Ole Miss in the Swamp · ABC$/);
  const visitors = lines.filter((s) => /^Visitors — /.test(s));
  assert.ok(visitors.length >= 3);
  assert.match(visitors[0], /^Visitors — \S+\s+\S+/);
  assert.ok(visitors.some((s) => /Easton Royal/.test(s)));
  assert.ok(!visitors.some((s) => /Royal · Wright · Thomas/.test(s)));
  assert.doesNotMatch(visitors[0], /ABC|in the Swamp/i);
  const season = lines.filter((s) => /^Season — /.test(s));
  assert.ok(season.some((s) => /^Season — 3-0 · first SEC home Saturday$/.test(s)));
  assert.ok(season.some((s) => /1\.0\.29 is live — update in the App Store/.test(s)));
  assert.ok(!lines.some((s) => /class trending|#8|blue chip/i.test(s)));
});

test('Ole Miss week categories tick visitor names under Visitors, not ABC', () => {
  const cats = buildWeeklyHomeNowCategories(new Date('2026-09-21T18:00:00.000Z'));
  assert.equal(cats.length, 3);
  assert.equal(cats[0].label, 'Game');
  assert.ok(cats[0].items.some((s) => /ABC/i.test(s)));
  assert.equal(cats[1].label, 'Visitors');
  assert.ok(cats[1].items.length >= 3);
  assert.ok(cats[1].items.every((s) => !/ABC/i.test(s)));
  assert.equal(cats[2].label, 'Season');
  assert.match(cats[2].items[0], /3-0/);
  assert.ok(cats[2].items.some((s) => /1\.0\.29 is live — update in the App Store/.test(s)));
});

test('season record after Auburn is 3-0', () => {
  const board = getScheduleBoard(2026);
  const rec = seasonRecord(new Date('2026-09-21T18:00:00.000Z'), board.games);
  assert.deepEqual(rec, { wins: 3, losses: 0 });
});

test('offseason has no weekly slate', () => {
  assert.deepEqual(buildWeeklyHomeNowLines(new Date('2026-07-15T16:00:00.000Z'), []), []);
  assert.deepEqual(buildWeeklyHomeNowCategories(new Date('2026-07-15T16:00:00.000Z'), []), []);
});

const AWAY_NOW = new Date('2026-09-22T18:00:00.000Z');
const AWAY_GAMES = [
  {
    id: 'mizzou',
    kind: 'game',
    opp: 'Missouri Tigers',
    label: 'Oct 3 @ Missouri',
    venue: 'Columbia, MO',
    date: 'Saturday, October 3, 2026 3:30 PM',
    tv: 'SEC Network',
  },
];

const TOP25_COMMIT = {
  eventType: 'commit',
  playerName: 'Jaden Hale',
  committedTo: 'Florida',
  natlRank: 12,
  stars: 5,
  timestamp: '2026-09-20T12:00:00.000Z',
};

const MID_COMMIT = {
  eventType: 'commit',
  playerName: 'Cole Rivers',
  committedTo: 'Florida',
  natlRank: 80,
  stars: 4,
  timestamp: '2026-09-20T15:00:00.000Z',
};

test('a Florida commit takes the Visitors slot; Game and Season stay', () => {
  const now = new Date('2026-09-21T18:00:00.000Z');
  const cats = buildWeeklyHomeNowCategories(now, undefined, { breakInRows: [TOP25_COMMIT] });
  assert.equal(cats[0].label, 'Game');
  assert.equal(cats[1].label, 'News');
  assert.match(cats[1].items[0], /Jaden Hale commits to Florida · No\. 12/);
  assert.equal(cats[2].label, 'Season');
  assert.match(cats[2].items[0], /3-0/);
  assert.ok(!cats.some((c) => c.label === 'Visitors'));
});

test('any Florida commit beats a home visitor list', () => {
  const now = new Date('2026-09-21T18:00:00.000Z');
  const cats = buildWeeklyHomeNowCategories(now, undefined, { breakInRows: [MID_COMMIT] });
  assert.equal(cats[1].label, 'News');
  assert.match(cats[1].items[0], /Cole Rivers commits to Florida/);
  assert.ok(!cats.some((c) => c.label === 'Visitors'));
});

test('road week fills the middle slot with the week\'s Florida commit', () => {
  const cats = buildWeeklyHomeNowCategories(AWAY_NOW, AWAY_GAMES, { breakInRows: [MID_COMMIT] });
  assert.equal(cats[0].label, 'Game');
  assert.match(cats[0].items[0], /Missouri/i);
  assert.equal(cats[1].label, 'News');
  assert.match(cats[1].items[0], /Cole Rivers commits to Florida/);
  assert.equal(cats[2].label, 'Season');
});

test('road week with no news stays Road, not NA', () => {
  const cats = buildWeeklyHomeNowCategories(AWAY_NOW, AWAY_GAMES, { breakInRows: [] });
  assert.equal(cats[1].label, 'Road');
  assert.match(cats[1].items[0], /on the road/i);
  assert.doesNotMatch(cats[1].items[0], /\bNA\b/i);
});

const TOMMY_REMATERIAL = {
  eventType: 'commit',
  playerSlug: 'tommy-douglas',
  playerName: 'Tommy Douglas',
  committedTo: 'Florida',
  natlRank: 367,
  stars: 4,
  timestamp: '2026-09-20T12:00:00.000Z',
  reportedAt: '2026-09-21T18:00:00.000Z',
  source: 'auto:allowlist-intel-sweep',
};

const OLD_COMMIT_FRESH_TS = {
  eventType: 'commit',
  playerName: 'April Commit',
  committedTo: 'Florida',
  natlRank: 40,
  stars: 4,
  commitDate: '2026-04-16',
  timestamp: '2026-09-20T12:00:00.000Z',
  reportedAt: '2026-09-20T12:00:00.000Z',
};

const FRESH_COMMIT_DATE = {
  eventType: 'commit',
  playerName: 'Jaden Hale',
  committedTo: 'Florida',
  natlRank: 12,
  stars: 5,
  commitDate: '2026-09-20',
  timestamp: '2026-09-20T12:00:00.000Z',
};

test('old commitDate plus fresh intel timestamp stays Visitors', () => {
  const now = new Date('2026-09-21T18:00:00.000Z');
  const cats = buildWeeklyHomeNowCategories(now, undefined, { breakInRows: [OLD_COMMIT_FRESH_TS] });
  assert.equal(cats[1].label, 'Visitors');
  assert.ok(!cats.some((c) => c.label === 'News'));
  assert.ok(!cats.some((c) => /April Commit/i.test(c.items[0] || '')));
});

test('Tommy Douglas rematerialized intel stays off News', () => {
  const now = new Date('2026-09-21T18:00:00.000Z');
  const cats = buildWeeklyHomeNowCategories(now, undefined, { breakInRows: [TOMMY_REMATERIAL] });
  assert.equal(cats[1].label, 'Visitors');
  assert.ok(!cats.some((c) => c.label === 'News'));
  assert.ok(!cats.some((c) => /Tommy Douglas/i.test(c.items[0] || '')));
});

test('this-week commitDate still takes the Visitors slot', () => {
  const now = new Date('2026-09-21T18:00:00.000Z');
  const cats = buildWeeklyHomeNowCategories(now, undefined, { breakInRows: [FRESH_COMMIT_DATE] });
  assert.equal(cats[1].label, 'News');
  assert.match(cats[1].items[0], /Jaden Hale commits to Florida/);
});

test('empty seasonTicks leaves only the standing line', () => {
  const cats = buildWeeklyHomeNowCategories(new Date('2026-09-21T18:00:00.000Z'), undefined, {
    seasonTicks: [],
  });
  assert.equal(cats[2].label, 'Season');
  assert.deepEqual(cats[2].items, ['3-0 · first SEC home Saturday']);
});

test('Ole Miss visitors tick first and last names, not three last names', () => {
  const cats = buildWeeklyHomeNowCategories(new Date('2026-09-21T18:00:00.000Z'));
  assert.equal(cats[1].label, 'Visitors');
  assert.ok(cats[1].items.length >= 10);
  assert.ok(cats[1].items.includes('Easton Royal'));
  assert.ok(cats[1].items.includes('Antonio Thomas Jr.'));
  assert.ok(cats[1].items.every((n) => /\s/.test(n)));
  assert.ok(!cats[1].items.some((n) => / · /.test(n)));
});
