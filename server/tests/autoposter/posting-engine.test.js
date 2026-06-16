const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { assessEligibility, getPolicyRules } = require('../../lib/autoposter/posting-engine');

describe('posting-engine', () => {
  it('exports policy rules for autoposter engine', () => {
    const rules = getPolicyRules();
    assert.ok(Array.isArray(rules.eligibility));
    assert.ok(Array.isArray(rules.skip));
    assert.ok(typeof rules.isEligibleIntel === 'function');
  });

  it('flags stale intel during eligibility assessment', () => {
    const intel = {
      playerName: 'Easton Royal',
      eventType: 'official_visit',
      timestamp: new Date(Date.now() - 72 * 3600000).toISOString()
    };
    const result = assessEligibility(intel, {});
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.includes('stale_intel'));
  });
});
