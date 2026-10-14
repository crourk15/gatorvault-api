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

  it('keeps #5 / 67% / 27 / 90.1 when an August plate is the healthy cache', () => {
    const {
      healOverviewNests,
      eliteClassOverviewCacheKey,
      hubCache,
    } = require('../../lib/recruiting-hub-cache');
    const key = eliteClassOverviewCacheKey(2027);
    hubCache.set(key, {
      classRank: '#8',
      blueChip: '65%',
      commits: '26',
      commitLabel: 'Commits',
      avgRating: '89.9',
    });
    const payload = {
      commits: [
        { id: 'maxwell-hiller', name: 'Maxwell Hiller' },
        { id: 'easton-royal', name: 'Easton Royal' },
      ],
      classOverview: {
        classRank: '#5',
        blueChip: '67%',
        commits: '27',
        commitLabel: 'Commits',
        avgRating: '90.1',
      },
      classOverviewAll: {
        2027: {
          classRank: '#8',
          blueChip: '68%',
          commits: '26',
          avgRating: '89.9',
        },
      },
    };
    healOverviewNests(payload, 2027);
    assert.equal(Array.isArray(payload.commits), true);
    assert.equal(payload.commits.length, 2);
    assert.equal(payload.commits[1].id, 'easton-royal');
    assert.equal(payload.classOverview.classRank, '#5');
    assert.equal(payload.classOverview.blueChip, '67%');
    assert.equal(payload.classOverview.commits, '27');
    assert.equal(payload.classOverview.avgRating, '90.1');
    assert.equal(payload.classOverviewAll[2027].classRank, '#5');
    assert.equal(payload.classOverviewAll[2027].commits, '27');
    assert.equal(payload.classOverviewAll[2027].avgRating, '90.1');
    hubCache.remove(key);

    const later = {
      classOverview: {
        classRank: '#4',
        blueChip: '70%',
        commits: '28',
        commitLabel: 'Commits',
        avgRating: '90.4',
      },
      classOverviewAll: {
        2027: {
          classRank: '#4',
          blueChip: '70%',
          commits: '28',
          avgRating: '90.4',
        },
      },
    };
    hubCache.set(key, {
      classRank: '#8',
      blueChip: '65%',
      commits: '26',
      commitLabel: 'Commits',
      avgRating: '89.9',
    });
    healOverviewNests(later, 2027);
    assert.equal(later.classOverview.classRank, '#4');
    assert.equal(later.classOverview.commits, '28');
    assert.equal(later.classOverview.avgRating, '90.4');
    assert.equal(later.classOverviewAll[2027].classRank, '#4');
    assert.equal(later.classOverviewAll[2027].commits, '28');
    hubCache.remove(key);
  });

  it('keeps a later class line and does not turn the commit list into a count', () => {
    const bundle = pinEastonRoyalHubSurface(
      {
        title: 'Florida Recruiting',
        subtitle: 'Who Florida is chasing — movement, board, and beat intel.',
        commits: [
          { id: 'maxwell-hiller', name: 'Maxwell Hiller' },
          { id: 'easton-royal', name: 'Easton Royal' },
        ],
        classOverview: {
          classRank: '#4',
          blueChip: '70%',
          commits: '28',
          commitLabel: 'Commits',
          avgRating: '90.4',
        },
      },
      2027
    );
    assert.equal(Array.isArray(bundle.commits), true);
    assert.equal(bundle.commits[0].id, 'easton-royal');
    assert.equal(bundle.classOverview.classRank, '#4');
    assert.equal(bundle.classOverview.blueChip, '70%');
    assert.equal(bundle.classOverview.commits, '28');
    assert.equal(bundle.classOverview.avgRating, '90.4');
    assert.match(bundle.subtitle, /Easton Royal flipped from Texas/);
  });
});
