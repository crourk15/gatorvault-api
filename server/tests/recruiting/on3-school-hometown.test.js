const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  looksLikeHometownAsSchool,
  parseHometown,
} = require('../../lib/recruiting-geo-normalize');

/**
 * Mirror of on3-client pickHighSchoolName — kept local so this test does not
 * pull node-fetch via on3-client's fetch helpers.
 */
function pickHighSchoolName(...vals) {
  for (const v of vals) {
    if (v == null) continue;
    const s = String(v).trim();
    if (!s || looksLikeHometownAsSchool(s)) continue;
    return s;
  }
  return '';
}

describe('on3 school vs hometown separation', () => {
  it('prefers highSchoolName over hometown.abbr', () => {
    const hometownAbbr = 'Duncanville, TX';
    const school = pickHighSchoolName('Duncanville', 'Duncanville Panthers', hometownAbbr);
    assert.equal(school, 'Duncanville');
    assert.equal(looksLikeHometownAsSchool(hometownAbbr), true);
    const geo = parseHometown(hometownAbbr);
    assert.equal(geo.hometownCity, 'Duncanville');
    assert.equal(geo.hometownState, 'TX');
    assert.notEqual(school, `${geo.hometownCity}, ${geo.hometownState}`);
  });

  it('leaves school empty when only hometown.abbr is present', () => {
    const school = pickHighSchoolName(undefined, undefined, 'Phoenix, AZ');
    assert.equal(school, '');
  });

  it('keeps Prep / Academy labels with state suffixes', () => {
    assert.equal(
      pickHighSchoolName('Chaminade-Madonna Prep, FL', 'Hollywood, FL'),
      'Chaminade-Madonna Prep, FL'
    );
  });
});
