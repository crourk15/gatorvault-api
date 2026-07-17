const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeStateCode,
  parseHometown,
  normalizePlayerGeo,
  resolvePlayerState,
  looksLikeHometownAsSchool,
} = require('../../lib/recruiting-geo-normalize');

describe('recruiting-geo-normalize', () => {
  it('normalizes FL, Florida, and Fla. to FL', () => {
    assert.equal(normalizeStateCode('FL'), 'FL');
    assert.equal(normalizeStateCode('Florida'), 'FL');
    assert.equal(normalizeStateCode('Fla.'), 'FL');
    assert.equal(normalizeStateCode('fla'), 'FL');
  });

  it('parses City, ST from school strings', () => {
    assert.deepEqual(parseHometown('Warner Robins, GA'), {
      hometownCity: 'Warner Robins',
      hometownState: 'GA',
    });
    assert.deepEqual(parseHometown('Miami, FL'), {
      hometownCity: 'Miami',
      hometownState: 'FL',
    });
  });

  it('extracts embedded city/state from skinny text', () => {
    const parsed = parseHometown('CB · 4★ · Orlando, FL · #42 natl');
    assert.equal(parsed.hometownCity, 'Orlando');
    assert.equal(parsed.hometownState, 'FL');
  });

  it('normalizePlayerGeo patches hometownState and pin coords from school', () => {
    const patch = normalizePlayerGeo({
      slug: 'test-player',
      school: 'Tampa, FL',
    });
    assert.equal(patch.hometownState, 'FL');
    assert.equal(patch.hometownCity, 'Tampa');
    assert.equal(typeof patch.pinLat, 'number');
    assert.equal(typeof patch.pinLng, 'number');
    assert.equal(patch.stateFips, '12');
  });

  it('resolvePlayerState prefers normalized hometownState', () => {
    assert.equal(
      resolvePlayerState({ hometownState: 'Florida', school: 'Atlanta, GA' }),
      'FL'
    );
  });

  it('detects bare City, ST hometowns masquerading as school', () => {
    assert.equal(looksLikeHometownAsSchool('Duncanville, TX'), true);
    assert.equal(looksLikeHometownAsSchool('Phoenix, AZ'), true);
    assert.equal(looksLikeHometownAsSchool('Lake Dallas HS, TX'), false);
    assert.equal(looksLikeHometownAsSchool('Chaminade-Madonna Prep, FL'), false);
    assert.equal(looksLikeHometownAsSchool('IMG Academy'), false);
  });
});
