const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { matchIntelToPlayer } = require('../../lib/autoposter/identity-matcher');

describe('identity-matcher', () => {
  it('matches intel to player by slug', () => {
    const intel = { playerSlug: 'easton-royal', playerName: 'Easton Royal', classYear: 2027 };
    const player = matchIntelToPlayer(intel);
    assert.notEqual(player, null);
    assert.equal(player.name, 'Easton Royal');
    assert.equal(player.position, 'WR');
  });

  it('returns null when player cannot be matched', () => {
    const player = matchIntelToPlayer({ playerSlug: 'nonexistent-player-slug-xyz' });
    assert.equal(player, null);
  });
});
