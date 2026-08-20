'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { mapPool } = require('../../lib/fanout-util');

describe('fanout-util mapPool', () => {
  it('runs with bounded concurrency and preserves order', async () => {
    const active = { n: 0, max: 0 };
    const items = [1, 2, 3, 4, 5, 6];
    const out = await mapPool(items, 2, async (n) => {
      active.n += 1;
      active.max = Math.max(active.max, active.n);
      await new Promise((r) => setTimeout(r, 15));
      active.n -= 1;
      return n * 10;
    });
    assert.deepEqual(out, [10, 20, 30, 40, 50, 60]);
    assert.ok(active.max <= 2);
  });
});
