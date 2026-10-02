'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildWeeklyHomeNowLines,
  buildWeeklyHomeNowCategories,
  attachLiveNowWeek,
  seasonRecord,
} = require('../../lib/weekly-home-now');
const { getScheduleBoard } = require('../../lib/schedule-board');

test('Ole Miss week NOW is three pillars — Game owns ABC', () => {
  const now = new Date('2026-09-21T18:00:00.000Z');
  const lines = buildWeeklyHomeNowLines(now);
  assert.ok(lines.length >= 3);
  assert.match(lines[0], /^Game — Ole Miss in the Swamp — 3:30 PM · ABC$/);
  const visitors = lines.filter((s) => /^Visitors — /.test(s));
  assert.ok(visitors.length >= 3);
  assert.match(visitors[0], /^Visitors — \S+\s+\S+/);
  assert.ok(visitors.some((s) => /Easton Royal/.test(s)));
  assert.ok(!visitors.some((s) => /Royal · Wright · Thomas/.test(s)));
  assert.doesNotMatch(visitors[0], /ABC|in the Swamp/i);
  const season = lines.filter((s) => /^Season — /.test(s));
  assert.deepEqual(season, ['Season — 3-0 · first SEC home Saturday']);
  assert.ok(!lines.some((s) => /1\.0\.29|update in the App Store/i.test(s)));
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
  assert.deepEqual(cats[2].items, ['3-0 · first SEC home Saturday']);
});

test('Missouri week NOW Game is 3:30 PM · ESPN, not a 3:30–8:00 window', () => {
  const cats = buildWeeklyHomeNowCategories(new Date('2026-09-27T16:00:00.000Z'));
  assert.equal(cats[0].label, 'Game');
  assert.match(cats[0].items[0], /Missouri/);
  assert.match(cats[0].items[0], /3:30 PM/);
  assert.match(cats[0].items[0], /ESPN/);
  assert.doesNotMatch(cats[0].items[0], /3:30\s*[-–]\s*8:00/);
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
  assert.ok(cats[2].items.some((s) => /3-0/.test(s)));
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

test('ticker pack is ready with standing Season only', () => {
  const { buildHomeNowTickerPack } = require('../../lib/weekly-home-now');
  const pack = buildHomeNowTickerPack(new Date('2026-09-21T18:00:00.000Z'));
  assert.equal(pack.status, 'ready');
  assert.ok(pack.nowWeek.length >= 3);
  const season = pack.nowWeek.find((c) => c.key === 'season');
  assert.deepEqual(season.items, ['3-0 · first SEC home Saturday']);
  assert.ok(pack.items.some((s) => /^Season — 3-0 · first SEC home Saturday$/.test(s)));
  assert.ok(!pack.items.some((s) => /1\.0\.29|update in the App Store/i.test(s)));
});

test('attachLiveNowWeek fills standing Season when ticker items are empty', () => {
  const { attachLiveNowWeek } = require('../../lib/weekly-home-now');
  const body = attachLiveNowWeek({ ok: true, status: 'building', items: [] });
  const season = (body.nowWeek || []).find((c) => c.key === 'season');
  assert.ok(season);
  assert.ok(season.items.some((s) => /^\d-\d/.test(s)));
});

test('empty seasonTicks leaves only the standing line', () => {
  const cats = buildWeeklyHomeNowCategories(new Date('2026-09-21T18:00:00.000Z'), undefined, {
    seasonTicks: [],
  });
  assert.equal(cats[2].label, 'Season');
  assert.deepEqual(cats[2].items, ['3-0 · first SEC home Saturday']);
});

test('South Carolina week Visitors opens on Easton Royal', () => {
  const cats = buildWeeklyHomeNowCategories(new Date('2026-10-06T16:00:00.000Z'));
  assert.equal(cats[0].label, 'Game');
  assert.match(cats[0].items[0], /South Carolina/i);
  assert.equal(cats[1].label, 'Visitors');
  assert.equal(cats[1].items[0], 'Easton Royal');
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

test('unverified McMullen commit intel cannot take Home NOW News', () => {
  const now = new Date('2026-10-02T01:00:00.000Z');
  const cats = buildWeeklyHomeNowCategories(now, undefined, {
    breakInRows: [
      {
        eventType: 'commit',
        playerSlug: 'lorenzo-mcmullen-jr',
        playerName: 'Lorenzo McMullen Jr.',
        committedTo: 'Florida',
        natlRank: 25,
        stars: 4,
        timestamp: '2026-10-01T18:00:00.000Z',
        text: 'Lorenzo McMullen Jr. commits to Florida',
      },
    ],
  });
  const news = cats.find((c) => c.key === 'news');
  assert.ok(!news || !/mcmullen/i.test(String(news.items || '')), JSON.stringify(news));
});

test('cached ticker News cannot keep a false McMullen commit', () => {
  const body = attachLiveNowWeek({
    ok: true,
    status: 'ready',
    items: [
      'Game — Missouri at Faurot Field — 3:30 PM · ESPN',
      'News — Lorenzo McMullen Jr. commits to Florida · No. 25',
      'Season — 4-0 heading into Saturday',
    ],
    nowWeek: [
      { key: 'game', label: 'Game', items: ['Missouri at Faurot Field — 3:30 PM · ESPN'] },
      { key: 'news', label: 'News', items: ['Lorenzo McMullen Jr. commits to Florida · No. 25'] },
      { key: 'season', label: 'Season', items: ['4-0 heading into Saturday'] },
    ],
  });
  assert.ok(!/mcmullen/i.test(JSON.stringify(body.items || [])));
  assert.ok(!/mcmullen/i.test(JSON.stringify(body.nowWeek || [])));
});

test('this-week Cyion Smith commit breaks into Home NOW News', () => {
  const cats = buildWeeklyHomeNowCategories(new Date('2026-09-26T20:00:00.000Z'));
  const news = cats.find((c) => c.key === 'news');
  assert.ok(news, 'News pillar must replace Visitors this week');
  assert.match(String(news.items[0] || ''), /Cyion Smith commits to Florida/i);
});

test('after the Ole Miss final NOW points at Missouri road week', () => {
  const now = new Date('2026-09-27T12:00:00.000Z');
  const lines = buildWeeklyHomeNowLines(now);
  assert.match(lines[0], /^Game — Missouri at Faurot Field — 3:30 PM · ESPN$/);
  const rec = seasonRecord(now, getScheduleBoard(2026).games);
  assert.deepEqual(rec, { wins: 4, losses: 0 });
  assert.ok(lines.some((s) => /^Season — 4-0 heading into Saturday$/.test(s)));
  const cats = buildWeeklyHomeNowCategories(now, undefined, { breakInRows: [] });
  assert.equal(cats[1].label, 'Road');
  assert.match(cats[1].items[0], /on the road this Saturday/i);
});
