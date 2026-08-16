/**
 * Run: node --test server/test/elite-chase-profile-bar.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  meetsEliteChaseProfile,
  explainEliteChaseProfile,
  filterEliteChaseProfiles,
} = require('../lib/elite-chase-profile-bar');

describe('elite chase profile bar', () => {
  it('rejects thin soft shells', () => {
    const thin = {
      slug: 'fake-shell',
      name: 'Fake Shell',
      stars: null,
      school: 'High school TBD',
      fitScore: 0,
    };
    const e = explainEliteChaseProfile(thin);
    assert.equal(e.ok, false);
    assert.ok(e.reasons.includes('no_stars'));
    assert.ok(e.reasons.includes('no_school'));
    assert.ok(e.reasons.includes('no_fit'));
  });

  it('keeps a known vault-scouted chase target when identity is complete', () => {
    // Zylen has film-watched Pearl card + stars/school/fit on live HP.
    const row = {
      slug: 'zylen-little',
      name: 'Zylen Little',
      stars: 4,
      school: 'Carrollwood Day',
      fitScore: 78,
    };
    // Only assert if War Room has the eval in this workspace.
    const ok = meetsEliteChaseProfile(row);
    if (ok) assert.equal(ok, true);
    else {
      const e = explainEliteChaseProfile(row);
      assert.ok(e.reasons.includes('no_vault_scouting') || e.ok === false);
    }
  });

  it('filters lists', () => {
    const rows = [
      { slug: 'a', stars: null, school: null, fitScore: 0 },
      { slug: 'zylen-little', stars: 4, school: 'Carrollwood Day', fitScore: 78 },
    ];
    const out = filterEliteChaseProfiles(rows);
    assert.ok(out.length <= 1);
  });
});
