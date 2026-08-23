'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { indexUsersByEmail } = require('../../lib/user-store');

describe('indexUsersByEmail', () => {
  it('maps emails for O(1) fan-out lookup', () => {
    const map = indexUsersByEmail([
      { email: 'A@Example.com', tier: 'locker' },
      { email: 'b@example.com', tier: 'war' },
      { email: '', tier: 'locker' },
    ]);
    assert.equal(map.size, 2);
    assert.equal(map.get('a@example.com').tier, 'locker');
    assert.equal(map.get('b@example.com').tier, 'war');
  });
});
