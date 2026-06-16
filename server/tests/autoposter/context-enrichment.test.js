const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { enrichContext } = require('../../lib/autoposter/context-enrichment');

describe('context-enrichment', () => {
  it('enriches context with futurecast data', () => {
    const player = { playerId: 'easton-royal', ufProbability: 60, movementDelta: 5 };
    const intel = { eventType: 'official_visit' };
    const ctx = enrichContext(player, intel);
    assert.ok(ctx.ufProbability > 0);
    assert.equal(ctx.visitType, 'official_visit');
    assert.ok(Array.isArray(ctx.history));
  });
});
