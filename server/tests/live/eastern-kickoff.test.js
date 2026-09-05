const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseEasternKickoff } = require('../../lib/eastern-kickoff');
const { isUfGameLiveWindow } = require('../../lib/uf-live-score');

describe('parseEasternKickoff', () => {
  it('maps FAU 7:45 PM ET to 23:45Z', () => {
    const kick = parseEasternKickoff('September 5, 2026 7:45 PM ET');
    assert.ok(kick);
    assert.equal(kick.toISOString(), '2026-09-05T23:45:00.000Z');
  });

  it('accepts the schedule middot format', () => {
    const kick = parseEasternKickoff('September 5, 2026 · 7:45 PM ET');
    assert.equal(kick.toISOString(), '2026-09-05T23:45:00.000Z');
  });
});

describe('UF live window (Eastern)', () => {
  it('is closed Friday night before FAU', () => {
    assert.equal(isUfGameLiveWindow(new Date('2026-09-05T02:30:00.000Z')), false);
  });

  it('opens 3 hours before FAU kickoff', () => {
    assert.equal(isUfGameLiveWindow(new Date('2026-09-05T20:45:00.000Z')), true);
  });

  it('stays open through a 10:30 PM ET final', () => {
    assert.equal(isUfGameLiveWindow(new Date('2026-09-06T02:30:00.000Z')), true);
  });

  it('is closed after the 5-hour post window', () => {
    assert.equal(isUfGameLiveWindow(new Date('2026-09-06T05:00:00.000Z')), false);
  });
});
