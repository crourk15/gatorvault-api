const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { buildHubHero } = require('../../lib/recruiting-hub-elite');
const { pinEastonRoyalHubSurface } = require('../../lib/recruiting-hub-cache');

describe('Recruiting Hub hero endpoint payload', () => {
  it('buildHubHero returns lightweight hero fields only', async () => {
    const hero = await buildHubHero(2027);
    assert.equal(hero.year, 2027);
    assert.equal(typeof hero.title, 'string');
    assert.match(hero.subtitle, /Easton Royal flipped from Texas/);
    assert.ok(Array.isArray(hero.classYears));
    assert.ok(hero.classYears.includes(2027));
    assert.ok(Array.isArray(hero.ticker));
    assert.ok(hero.classOverview);
    assert.equal(hero.classOverview.classRank, '#5');
    assert.equal(hero.classOverview.blueChip, '67%');
    assert.equal(hero.classOverview.commits, '27');
    assert.equal(hero.classOverview.avgRating, '90.1');
    assert.ok(hero.classOverviewAll);
    assert.ok(hero.classOverviewAll[2027]);
    assert.equal(hero.commits, undefined);
    assert.equal(hero.footprint, undefined);
  });

  it('cached 2027 hub leads with Easton Royal and names the flip', () => {
    const hero = pinEastonRoyalHubSurface(
      {
        title: 'Florida Recruiting',
        subtitle: 'Who Florida is chasing — movement, board, and beat intel.',
        ticker: ['News — Easton Royal flips to Florida · No. 5'],
      },
      2027
    );
    assert.match(hero.subtitle, /Easton Royal flipped from Texas/);

    const bundle = pinEastonRoyalHubSurface(
      {
        commits: [
          { id: 'maxwell-hiller', name: 'Maxwell Hiller' },
          { id: 'easton-royal', name: 'Easton Royal' },
        ],
        movementFeed: [{ id: 'visit-tranard', name: 'Tranard Roberts', event: 'visit' }],
      },
      2027
    );
    assert.equal(bundle.commits[0].id, 'easton-royal');
    assert.equal(bundle.movementFeed[0].id, 'commit-easton-royal');

    const again = pinEastonRoyalHubSurface(bundle, 2027);
    assert.equal(again.movementFeed.filter((row) => row.id === 'commit-easton-royal').length, 1);
  });
});
