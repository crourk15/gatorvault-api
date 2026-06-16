const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { rewriteIntel } = require('../../lib/autoposter/rewrite-engine');

describe('rewrite-engine', () => {
  it('produces insider-style rewrite with context', async () => {
    const player = {
      name: 'Easton Royal',
      position: 'WR',
      classYear: 2027,
      rating: 94,
      playerId: 'easton-royal'
    };
    const context = {
      ufProbability: 70,
      movementDelta: 5,
      visitType: 'official_visit',
      staffContacts: ['Billy Gonzales'],
      competition: ['FSU', 'Miami'],
      timeline: 'summer decision'
    };
    const intel = { text: 'Easton Royal will take an official visit to UF June 11–13.' };
    const rewrite = await rewriteIntel(player, context, intel);
    assert.match(rewrite.text, /UF/i);
    assert.match(rewrite.text, /visit/i);
    assert.equal(rewrite.quality.ok, true);
  });
});
