'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  pickGamedayOpen,
  listWeeklyGameTalks,
  opponentShort,
  shouldUpgradeDailyToGameday,
} = require('../lib/community-gameday-open');

describe('community gameday open', () => {
  it('shortens FAU Owls to FAU', () => {
    assert.equal(opponentShort('FAU Owls'), 'FAU');
    assert.equal(opponentShort('Ole Miss Rebels'), 'Ole Miss');
  });

  it('returns FAU talk on Sep 5 2026', () => {
    const prompt = pickGamedayOpen({ asOf: '2026-09-05T18:00:00.000Z' });
    assert.ok(prompt);
    assert.equal(prompt.gameday, true);
    assert.match(prompt.title, /Florida vs FAU/);
    assert.match(prompt.body, /now, during the game, and after/i);
    assert.match(prompt.body, /Swamp/);
    assert.equal(prompt.categorySlug, 'locker');
  });

  it('Missouri Saturday open says 3:30 on ABC, not ESPN', () => {
    const prompt = pickGamedayOpen({ asOf: '2026-10-03T16:00:00.000Z' });
    assert.ok(prompt);
    assert.equal(prompt.title, 'Game day talk: Florida vs Missouri');
    assert.match(prompt.body, /3:30 PM ET on ABC/);
    assert.doesNotMatch(prompt.body, /ESPN/);
    assert.match(prompt.body, /Faurot/);
  });

  it('returns null on a non-game ET day', () => {
    assert.equal(pickGamedayOpen({ asOf: '2026-09-06T16:00:00.000Z' }), null);
  });

  it('South Carolina week is open on Oct 10 and Texas week is not', () => {
    const rooms = listWeeklyGameTalks({ asOf: '2026-10-10T16:00:00.000Z' });
    assert.equal(rooms[0].gameId, 'scar');
    assert.equal(rooms[0].title, 'Game day talk: Florida vs South Carolina');
    assert.match(rooms[0].body, /The Swamp/);
    assert.match(rooms[0].body, /12:45 PM ET on SEC Network/);
    assert.ok(rooms.some((r) => r.gameId === 'missouri'));
    assert.equal(rooms.some((r) => r.gameId === 'texas'), false);
    const nextWeek = listWeeklyGameTalks({ asOf: '2026-10-11T16:00:00.000Z' });
    assert.equal(nextWeek[0].gameId, 'texas');
  });

  it('upgrades a generic daily open into gameday talk', () => {
    const gameday = pickGamedayOpen({ asOf: '2026-09-05T18:00:00.000Z' });
    assert.equal(
      shouldUpgradeDailyToGameday(
        { title: 'Daily open: what moved Florida’s board overnight?', body: 'old', gameday: false },
        gameday
      ),
      true
    );
    assert.equal(
      shouldUpgradeDailyToGameday({ title: gameday.title, body: gameday.body, gameday: true }, gameday),
      false
    );
  });
});

describe('community store gameday upgrade', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-community-gd-'));
  let store;

  before(() => {
    process.env.GV_COMMUNITY_DATA_DIR = tmpDir;
    delete require.cache[require.resolve('../lib/community-store')];
    store = require('../lib/community-store');
    fs.mkdirSync(store.DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(store.DATA_DIR, 'threads.json'), '[]');
  });

  after(() => {
    delete process.env.GV_COMMUNITY_DATA_DIR;
    delete require.cache[require.resolve('../lib/community-store')];
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('publishes and upgrades today’s staff open on FAU Saturday', () => {
    const first = store.ensureDailyOpenThread({ asOf: '2026-09-05T16:00:00.000Z' });
    assert.equal(first.created, true);
    assert.match(first.thread.title, /Game day talk: Florida vs FAU/);
    assert.equal(first.thread.gameday, true);
    assert.equal(first.thread.replyCount || 0, 0);

    const again = store.ensureDailyOpenThread({ asOf: '2026-09-05T20:00:00.000Z' });
    assert.equal(again.created, false);
    assert.equal(again.thread.id, first.thread.id);
    assert.equal(again.replaced, false);
  });

  it('opens one South Carolina game talk room and does not duplicate it', () => {
    const first = store.ensureWeeklyGameTalks({ asOf: '2026-10-10T16:00:00.000Z', force: true });
    assert.ok(first.created >= 1);
    const rooms = store.getGameRooms({ limit: 12 });
    assert.equal(rooms[0].title, 'Game day talk: Florida vs South Carolina');
    assert.equal(rooms[0].gameId, 'scar');
    assert.equal(rooms[0].id, 'thr_game_scar');
    const again = store.ensureWeeklyGameTalks({ asOf: '2026-10-10T18:00:00.000Z', force: true });
    assert.equal(again.created, 0);
    const listed = rooms.filter((r) => r.gameId === 'scar');
    assert.equal(listed.length, 1);
    assert.equal(rooms.some((r) => r.gameId === 'texas'), false);
  });

  it('shipped iOS still lists South Carolina when it hides today’s staff thread', () => {
    store.ensureDailyOpenThread({ asOf: '2026-10-10T16:00:00.000Z' });
    store.ensureWeeklyGameTalks({ asOf: '2026-10-10T16:00:00.000Z', force: true });
    const threads = store.loadThreads().filter((t) => !t.deleted);
    const today = threads.find((t) => t.pinned && t.dailyKey === '2026-10-10');
    assert.ok(today);
    const rooms = store.getGameRooms({ limit: 12 });
    const visibleToIos = rooms.filter((t) => t.id !== today.id);
    const scar = visibleToIos.find((t) => t.gameId === 'scar');
    assert.ok(scar, 'Game talk must keep South Carolina after the iOS today-filter');
    assert.equal(scar.id, 'thr_game_scar');
    assert.equal(visibleToIos.filter((t) => t.gameId === 'scar').length, 1);
  });

  it('keeps the Saturday thread that already has replies', () => {
    const threads = store.loadThreads();
    threads.unshift({
      id: 'thr_game_auburn',
      title: 'Game day talk: Florida vs Auburn',
      body: 'Empty duplicate.',
      categorySlug: 'locker',
      authorId: 'usr_gv_staff',
      pinned: false,
      gameday: true,
      gameId: 'auburn',
      gameDay: '2026-09-19',
      replyCount: 0,
      deleted: false,
      createdAt: '2026-09-19T16:00:00.000Z',
    });
    threads.unshift({
      id: 'thr_gameday_auburn',
      title: 'Game day talk: Florida vs Auburn',
      body: 'Jordan-Hare.',
      categorySlug: 'locker',
      authorId: 'usr_gv_staff',
      pinned: false,
      gameday: true,
      gameId: 'auburn',
      gameDay: '2026-09-19',
      replyCount: 2,
      dailyKey: '2026-09-19',
      deleted: false,
      createdAt: '2026-09-19T16:00:00.000Z',
    });
    store.saveThreads(threads);
    const rooms = store.getGameRooms({ limit: 12 });
    const auburns = rooms.filter((r) => r.gameId === 'auburn' || /Auburn/.test(r.title || ''));
    assert.equal(auburns.length, 1);
    assert.equal(auburns[0].id, 'thr_gameday_auburn');
  });
});
