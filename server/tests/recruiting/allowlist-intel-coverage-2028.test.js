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
      'derrell-hines-jr',
      'jamarcus-johnson',
    ]) {
      assert.equal(set.has(slug), true, slug);
    }
  });

  it('sweep priority-pulses zero-intel and thin names even on a tiny create budget', async () => {
    const result = await runAllowlistIntelSweep({ classYear: 2028, dryRun: true, maxCreates: 5 });
    assert.equal(result.ok, true);
    const kinds = (result.created || []).map((row) => row.kind);
    assert.ok(
      kinds.includes('board_pulse') || kinds.includes('visit') || kinds.includes('offer'),
      `expected a gap-fill create, got ${kinds.slice(0, 8).join(',')}`
    );
    assert.ok(result.coverage && Array.isArray(result.coverage.missingWithVisits));
  });
});
