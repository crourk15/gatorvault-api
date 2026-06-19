const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('tsx/cjs');

const {
  intelUuidForSlug,
  isUnderclassmenClassYear,
  buildUnderclassmenIntelForSlug,
} = require('../../lib/underclassmen-intel.ts');

describe('intelUuidForSlug', () => {
  it('returns stable RFC-4122-shaped UUID v5', () => {
    const a = intelUuidForSlug('kaleb-ballard');
    const b = intelUuidForSlug('kaleb-ballard');
    const c = intelUuidForSlug('brysen-wright');
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});

describe('isUnderclassmenClassYear', () => {
  it('accepts 2028–2030 only', () => {
    assert.equal(isUnderclassmenClassYear(2027), false);
    assert.equal(isUnderclassmenClassYear(2028), true);
    assert.equal(isUnderclassmenClassYear(2030), true);
    assert.equal(isUnderclassmenClassYear(2031), false);
  });
});

describe('buildUnderclassmenIntelForSlug', () => {
  it('builds intel bundle for early watchlist slug', async () => {
    const bundle = await buildUnderclassmenIntelForSlug('kaleb-ballard');
    assert.ok(bundle, 'expected intel bundle');
    assert.equal(bundle.slug, 'kaleb-ballard');
    assert.equal(bundle.intelUuid, intelUuidForSlug('kaleb-ballard'));
    assert.ok(Number.isFinite(bundle.earlyIntel.fitScore) || bundle.earlyIntel.fitScore === null);
    assert.ok(Array.isArray(bundle.earlySignals));
    assert.ok(Array.isArray(bundle.earlyFutureCastPicks));
    assert.ok(bundle.earlyMovement.movementWindow == null || bundle.earlyMovement.movementWindow.windowDays === 30);
    assert.ok(Array.isArray(bundle.relatedIntel));
  });

  it('returns null for non-underclassmen slug', async () => {
    const bundle = await buildUnderclassmenIntelForSlug('not-a-real-player-slug-xyz');
    assert.equal(bundle, null);
  });
});
