/**
 * 2028 allowlist intel must stay continuous — locked targets never sit at 0 rows.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  measureAllowlistIntelCoverage,
  runAllowlistIntelSweep,
} = require('../../lib/allowlist-intel-sweep');
const { getAllowlistSet } = require('../../lib/recruiting-target-allowlist');

describe('2028 allowlist intel coverage', () => {
  it('keeps Alderman locks + Jamarcus on the allowlist set', () => {
    const set = getAllowlistSet(2028);
    for (const slug of [
      'antijuan-wilkes-jr',
      'nehemiah-mccary',
      'samuel-bailey',
      'derrell-hines-jr',
      'jamarcus-johnson',
    ]) {
      assert.equal(set.has(slug), true, slug);
    }
  });

  it('sweep reaches full coverage for locked 2028 targets', async () => {
    await runAllowlistIntelSweep({ classYear: 2028, maxCreates: 50 });
    const cov = measureAllowlistIntelCoverage(2028);
    assert.equal(cov.missing.length, 0, `missing: ${cov.missing.join(',')}`);
    assert.ok(cov.coveragePct >= 100);
    assert.ok(cov.recentCoveragePct >= 95);
  });
});
