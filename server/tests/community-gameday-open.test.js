'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  pickGamedayOpen,
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

  it('returns null on a non-game ET day', () => {
    assert.equal(pickGamedayOpen({ asOf: '2026-09-06T16:00:00.000Z' }), null);
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
});
