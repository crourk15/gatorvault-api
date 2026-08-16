/**
 * Vault-feed must not false-block real 2028 targets as empty-ATH phantoms.
 * Run: node --test server/test/desk-intel-feed-blocked-ath.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isBlockedRecruit, isEmptyAthPhantomShell } = require('../lib/recruiting-blocked-players');
const { feedDeskIntelToFutureCast } = require('../lib/desk-intel-futurecast-feed');

describe('desk intel feed blocked ATH false positive', () => {
  it('slug-only probe without invented ATH is not an empty phantom', () => {
    const probe = {
      slug: 'tyree-mannings-jr',
      name: 'tyree mannings jr',
      pos: null,
      school: '',
      classYear: 2028,
    };
    assert.equal(isEmptyAthPhantomShell(probe), false);
    assert.equal(isBlockedRecruit(probe), false);
  });

  it('invented ATH + empty school still trips phantom shell', () => {
    assert.equal(
      isEmptyAthPhantomShell({
        slug: 'urban-meyer',
        name: 'Urban Meyer',
        pos: 'ATH',
        school: '',
        classYear: 2028,
      }),
      true
    );
  });

  it('feedExistingSlug-style call no longer returns blocked_not_recruit for Tyree', async () => {
    const r = await feedDeskIntelToFutureCast({
      slug: 'tyree-mannings-jr',
      forceHydrate: false,
      signalType: 'vault_feed_2028_existing',
      dryRun: true,
    });
    assert.notEqual(r.error, 'blocked_not_recruit');
  });
});
