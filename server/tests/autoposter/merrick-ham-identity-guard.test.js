const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const generator = require('../../lib/identity-pattern-generator');
const facilityGuards = require('../../lib/recruiting-facility-guards');
const resolver = require('../../lib/contextual-identity-resolver');

describe('Merrick Ham identity - no Hambrick false match', () => {
  const player = {
    slug: 'merrick-ham',
    name: 'Merrick Ham',
    stars: 4,
    pos: 'EDGE',
    school: 'Marietta (Marietta, GA)',
    classYear: 2028,
    natlRank: 102
  };

  it('does not generate bare Ham or bare 4-star EDGE patterns', () => {
    const patterns = generator.generateIdentityPatterns(player);
    assert.ok(patterns.includes('Merrick Ham'));
    assert.equal(patterns.includes('Ham'), false);
    assert.equal(patterns.some((p) => /^4-?star EDGE$/i.test(p)), false);
    assert.equal(patterns.some((p) => /^EDGE Ham$/i.test(p)), false);
  });

  it('word-boundary bare Ham does not match Hambrick highlight text', () => {
    const hay =
      "No. 3 - Darren Hambrick's 81-yard pick six in The Swamp vs. UGA This is an incredible return.";
    assert.equal(facilityGuards.phraseIncludesIdentityPattern(hay.toLowerCase(), 'ham'), false);
  });

  it('pattern lookup does not map Hambrick swamp clip to merrick-ham', () => {
    const patterns = generator.generateIdentityPatterns(player);
    const entry = { slug: 'merrick-ham', name: 'Merrick Ham', patterns };
    const hit = resolver.lookupIdentityPattern(
      "No. 3 - Darren Hambrick's 81-yard pick six in The Swamp vs. UGA",
      [entry]
    );
    assert.equal(hit, null);
  });

  it('still matches real Merrick Ham Florida visit copy', () => {
    const patterns = generator.generateIdentityPatterns(player);
    const entry = { slug: 'merrick-ham', name: 'Merrick Ham', patterns };
    const hit = resolver.lookupIdentityPattern(
      'Father of 4-star EDGE Merrick Ham - another Florida visit is set for the Marietta EDGE',
      [entry]
    );
    assert.ok(hit);
    assert.equal(hit.slug, 'merrick-ham');
  });
});
