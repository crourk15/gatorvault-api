const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { runHeavyJob, getHeavyJobGateStatus } = require('../../lib/heavy-job-gate');

describe('heavy-job-gate', () => {
  it('queues jobs instead of skipping them', async () => {
    const order = [];
    const a = runHeavyJob('job-a', async () => {
      order.push('a-start');
      await new Promise((r) => setTimeout(r, 25));
      order.push('a-end');
      return 'a';
    });
    const b = runHeavyJob('job-b', async () => {
      order.push('b-start');
      return 'b';
    });
    const out = await Promise.all([a, b]);
    assert.deepEqual(out, ['a', 'b']);
    assert.deepEqual(order, ['a-start', 'a-end', 'b-start']);
  });

  it('allows nested heavy jobs without deadlock', async () => {
    const out = await runHeavyJob('outer', async () => {
      const nested = await runHeavyJob('inner', async () => 'inner-ok');
      return `outer:${nested}`;
    });
    assert.equal(out, 'outer:inner-ok');
    assert.equal(getHeavyJobGateStatus().activeName, null);
  });
});
