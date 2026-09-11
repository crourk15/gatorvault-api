const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseGameDate,
  gameHasBeenPlayed,
  syncPlayedGameVisitors,
  SKIP_SLUGS,
} = require('../../lib/game-visitors-visit-sync');

describe('game visitor visit sync', () => {
  it('parses Sep 5 labels and explicit ISO dates', () => {
    assert.equal(parseGameDate({ dateLabel: 'Sep 5' }, 2026), '2026-09-05');
    assert.equal(parseGameDate({ date: '2026-09-05', dateLabel: 'Sep 5' }, 2026), '2026-09-05');
    assert.equal(parseGameDate({ dateLabel: 'Sep 12' }, 2026), '2026-09-12');
  });

  it('treats FAU as played and Campbell as unplayed on Sep 10', () => {
    const now = Date.parse('2026-09-10T12:00:00-04:00');
    assert.equal(gameHasBeenPlayed({ date: '2026-09-05' }, now, 2026), true);
    assert.equal(gameHasBeenPlayed({ dateLabel: 'Sep 12' }, now, 2026), false);
  });

  it('skips FSU commits and does not invent Campbell trips before kickoff', async () => {
    assert.equal(SKIP_SLUGS.has('chayse-brown'), true);
    assert.equal(SKIP_SLUGS.has('timi-aliu'), true);
    assert.equal(SKIP_SLUGS.has('judah-gumbs'), true);
    const now = Date.parse('2026-09-10T12:00:00-04:00');
    const out = await syncPlayedGameVisitors({ dryRun: true, nowMs: now, seasonYear: 2026 });
    const fsu = out.skipped.filter((s) => s.slug === 'chayse-brown');
    assert.ok(fsu.some((s) => s.reason === 'committed_elsewhere'));
    assert.ok(out.skipped.some((s) => s.gameId === 'campbell' && s.reason === 'not_played'));
    assert.ok(out.skipped.some((s) => s.gameId === 'olemiss' && s.reason === 'not_played'));
    const created = new Set(out.created.map((r) => r.slug));
    assert.equal(created.has('chayse-brown'), false);
    assert.ok(created.has('dominick-harris-payne'));
    assert.ok(created.has('zaiden-jernigan'));
    assert.ok(created.has('john-odwyer'));
  });
});
