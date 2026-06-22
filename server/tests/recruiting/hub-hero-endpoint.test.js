const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { buildHubHero } = require('../../lib/recruiting-hub-elite');

describe('Recruiting Hub hero endpoint payload', () => {
  it('buildHubHero returns lightweight hero fields only', async () => {
    const hero = await buildHubHero(2027);
    assert.equal(hero.year, 2027);
    assert.equal(typeof hero.title, 'string');
    assert.equal(typeof hero.subtitle, 'string');
    assert.ok(Array.isArray(hero.classYears));
    assert.ok(hero.classYears.includes(2027));
    assert.ok(Array.isArray(hero.ticker));
    assert.ok(hero.classOverview);
    assert.equal(typeof hero.classOverview.classRank, 'string');
    assert.equal(typeof hero.classOverview.blueChip, 'string');
    assert.equal(typeof hero.classOverview.commits, 'string');
    assert.equal(typeof hero.classOverview.avgRating, 'string');
    assert.ok(hero.classOverviewAll);
    assert.ok(hero.classOverviewAll[2027]);
    assert.equal(hero.commits, undefined);
    assert.equal(hero.footprint, undefined);
  });
});
