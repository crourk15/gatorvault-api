import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatDisplayClock,
  gatorsLivePollMs,
  nextLiveClockRunState,
  parseDisplayClock,
  stampClockOnStatus,
  tickDisplayClock,
} from './gators-live';

describe('gators live clock snap', () => {
  it('polls the board every 2s while Florida is on the field', () => {
    assert.equal(gatorsLivePollMs('live'), 2_000);
    assert.equal(gatorsLivePollMs('halftime'), 3_000);
    assert.equal(gatorsLivePollMs('pregame'), 8_000);
    assert.equal(gatorsLivePollMs('ready'), 12_000);
  });

  it('ticks a running ESPN clock one second', () => {
    assert.equal(parseDisplayClock('8:32'), 512);
    assert.equal(tickDisplayClock('8:32'), '8:31');
    assert.equal(tickDisplayClock('0:01'), '0:00');
    assert.equal(formatDisplayClock(90), '1:30');
  });

  it('stops the local tick when ESPN repeats the same clock', () => {
    const first = nextLiveClockRunState(null, '8:32', 'live');
    assert.equal(first.running, true);
    const stopped = nextLiveClockRunState(first, '8:32', 'live');
    assert.equal(stopped.running, false);
    const moving = nextLiveClockRunState(first, '8:29', 'live');
    assert.equal(moving.running, true);
    assert.equal(moving.clock, '8:29');
    assert.equal(stampClockOnStatus('2nd quarter · 8:32', '8:31'), '2nd quarter · 8:31');
  });
});
