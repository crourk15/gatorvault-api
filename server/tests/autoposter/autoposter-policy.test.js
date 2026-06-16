const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isEligibleIntel } = require('../../lib/autoposter/autoposter-policy');

describe('autoposter-policy', () => {
  it('rejects non-UF relevant intel', () => {
    const intel = { ufRelevant: false, eventType: 'official_visit', isDuplicate: false, sourceType: 'beat' };
    const player = { playerId: 'p1' };
    assert.equal(isEligibleIntel(intel, player), false);
  });

  it('accepts valid UF visit intel', () => {
    const intel = { ufRelevant: true, eventType: 'official_visit', isDuplicate: false, sourceType: 'beat' };
    const player = { playerId: 'p1' };
    assert.equal(isEligibleIntel(intel, player), true);
  });
});
