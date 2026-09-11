/**
 * Run: node --test server/test/bender-close-rpm-intel.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const intelStore = require('../lib/recruiting-intel-store');
const store = require('../lib/recruiting-store');
const { getAllowlistSet } = require('../lib/recruiting-target-allowlist');
const { getOverride } = require('../lib/chase-why-store');

describe('Bender close-to-RPM intel (not a posted pick)', () => {
  it('stamps Hines and Flowers beat notes without inventing a crystal ball', () => {
    const items = intelStore.listIntel({ limit: 4000 });
    const hines = items.find((i) => i.fingerprint === 'beat_target_update_derrell-hines-jr_2026-09-10_corey_bender');
    const flowers = items.find((i) => i.fingerprint === 'beat_target_update_jaxon-flowers_2026-09-10_corey_bender');
    assert.ok(hines, 'Hines Bender intel');
    assert.ok(flowers, 'Flowers Bender intel');
    assert.match(String(hines.detail || ''), /close to a UF RPM pick/i);
    assert.match(String(flowers.detail || ''), /top of his list/i);
    assert.equal(hines.predictionSchool, null);
    assert.equal(flowers.predictionSchool, null);
    assert.equal(hines.rivalsPickKey, null);
    assert.equal(flowers.rivalsPickKey, null);
  });

  it('does not stamp a Florida Rivals prediction on either player', () => {
    const hines = store.findBySlug('derrell-hines-jr');
    const flowers = store.findBySlug('jaxon-flowers');
    assert.ok(hines);
    assert.ok(flowers);
    assert.equal(hines.rivalsLastPrediction, null);
    assert.equal(flowers.rivalsLastPrediction, null);
    assert.equal(flowers.classYear, 2028);
    assert.equal(flowers.inState, true);
    assert.match(String(flowers.school || ''), /Bolles/i);
  });

  it('locks Flowers on the 2028 allowlist and keeps Why we chase honest', () => {
    assert.equal(getAllowlistSet(2028).has('jaxon-flowers'), true);
    assert.match(String(getOverride('derrell-hines-jr') || ''), /not in yet/i);
    assert.match(String(getOverride('jaxon-flowers') || ''), /not in yet/i);
  });
});
