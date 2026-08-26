import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyLiveCommitCountToTicker, buildHomePulseStories } from './home-command-utils';

describe('buildHomePulseStories', () => {
  it('prefers named visits/flips over generic class trending', () => {
    const stories = buildHomePulseStories({
      hubTicker: [
        '2027 class trending nationally — UF at #8',
        'Blue chip % at 65%',
        '26 commits locked for 2027',
        'Tranard Roberts — unofficial visit · Florida',
      ],
      hpIntel: [],
      movement: null,
      flipWatch: [
        {
          slug: 'easton-royal',
          name: 'Easton Royal',
          committedShort: 'Texas',
          flipScore: 62,
        } as any,
      ],
      visitRecap: [
        {
          slug: 'brysen-wright',
          name: 'Brysen Wright',
          visitStart: '2026-08-22',
          visitEnd: '2026-08-24',
        } as any,
      ],
    });
    assert.equal(stories[0], 'Verified OV: Brysen Wright (2026-08-22–2026-08-24)');
    assert.ok(stories.some((s) => /Flip Watch: Easton Royal/.test(s)));
    assert.ok(stories.some((s) => /26 commits locked/.test(s)));
    assert.ok(stories.some((s) => /Tranard Roberts/.test(s)));
    // Generic class line can remain but must not lead when named intel exists.
    assert.notEqual(stories[0], '2027 class trending nationally — UF at #8');
  });

  it('does not freeze on the old UF in the mix fallback when hub ticker is live', () => {
    const stories = buildHomePulseStories({
      hubTicker: ['26 commits locked for 2027', '2027 class trending nationally — UF at #8'],
      hpIntel: [],
      movement: null,
    });
    assert.ok(
      stories[0] === '2027 class trending nationally — UF at #8' ||
        stories[0] === '26 commits locked for 2027'
    );
    assert.ok(!stories.some((s) => /UF in the mix/i.test(s)));
  });

  it('rewrites commit-count lines from live metrics and strips seed stone counts', () => {
    assert.deepEqual(
      applyLiveCommitCountToTicker(
        ['2027 class trending nationally — UF at #8', '25 commits locked for 2027', 'Blue chip % at 65%'],
        { year: 2027, commits: null }
      ),
      ['2027 class trending nationally — UF at #8', 'Blue chip % at 65%']
    );
    assert.deepEqual(
      applyLiveCommitCountToTicker(
        ['2027 class trending nationally — UF at #8', '25 commits locked for 2027', 'Blue chip % at 65%'],
        { year: 2027, commits: '26', commitLabel: 'Commits' }
      ),
      [
        '2027 class trending nationally — UF at #8',
        'Blue chip % at 65%',
        '26 commits locked for 2027',
      ]
    );
  });

  it('ranks Florida visits and real class heat over allowlist offer spam', () => {
    const stories = buildHomePulseStories({
      hubTicker: [
        'Blue chip % at 100%',
        '1 commits locked for 2028',
        '2027 class trending nationally — UF at #8',
        '26 commits locked for 2027',
        'Tranard Roberts — unofficial visit · Florida',
      ],
      hpIntel: [],
      movement: {
        alerts: [
          {
            id: '1',
            type: 'OFFER',
            player: 'Antijuan Wilkes Jr.',
            detail: 'Antijuan Wilkes Jr. — Florida offer',
            timestamp: '2026-08-26T11:26:34.092Z',
          },
          {
            id: '2',
            type: 'OFFER',
            player: 'Prince Che',
            detail: 'Prince Che — Florida offer',
            timestamp: '2026-08-26T11:26:33.874Z',
          },
          {
            id: '3',
            type: 'OFFER',
            player: 'Derrell Hines Jr.',
            detail: 'Derrell Hines Jr. — Florida offer',
            timestamp: '2026-08-26T11:26:33.737Z',
          },
        ],
      } as any,
    });
    assert.equal(stories[0], 'Tranard Roberts — unofficial visit · Florida');
    assert.ok(stories.some((s) => /2027 class trending nationally — UF at #8/.test(s)));
    assert.ok(stories.some((s) => /26 commits locked for 2027/.test(s)));
    assert.ok(!stories.some((s) => /Blue chip % at 100%|1 commits locked/i.test(s)));
    assert.ok(stories.filter((s) => /Florida offer/i.test(s)).length <= 2);
  });


  it('drops stale unofficial visit alerts from Home NOW', () => {
    const stories = buildHomePulseStories({
      hubTicker: ['2027 class trending nationally — UF at #8', '26 commits locked for 2027'],
      hpIntel: [],
      movement: {
        alerts: [
          {
            id: '1',
            type: 'VISIT',
            player: 'Tranard Roberts',
            detail: 'Tranard Roberts — unofficial visit · Florida',
            timestamp: '2026-04-11T00:00:00.000Z',
          },
        ],
      } as any,
    });
    assert.ok(!stories.some((s) => /Tranard Roberts/i.test(s)));
    assert.ok(stories.some((s) => /2027 class trending nationally/i.test(s)));
  });

  it('does not paint Beat Desk / allowlist-intel ops into Home NOW', () => {
    const stories = buildHomePulseStories({
      hubTicker: [
        '26 commits locked for 2027',
        'Dominick Harris Payne — Staff note — Brandon Harris cooking',
        'Tranard Roberts — unofficial visit · Florida',
      ],
      hpIntel: [],
      movement: {
        alerts: [
          {
            id: '1',
            type: 'OFFER',
            player: 'Gionni Lewis',
            detail: 'Gionni Lewis — Florida offer on file (2026-08-20) from player card.',
            timestamp: '2026-08-24T18:03:06.055Z',
          },
          {
            id: '2',
            type: 'OFFER',
            player: 'Kaleb Ballard',
            detail:
              'Kaleb Ballard — Florida offer on file (2026-08-18). Continuous allowlist intel sweep.',
            timestamp: '2026-08-24T12:28:57.660Z',
          },
        ],
      } as any,
    });
    assert.ok(stories.some((s) => /Tranard Roberts/.test(s)));
    assert.ok(stories.some((s) => /Gionni Lewis — Florida offer/.test(s)));
    assert.ok(stories.some((s) => /Kaleb Ballard — Florida offer/.test(s)));
    assert.ok(
      !stories.some((s) => /Staff note|from player card|allowlist intel sweep|on file/i.test(s))
    );
  });

  it('compresses article blurbs into finished Florida visit chips', () => {
    const stories = buildHomePulseStories({
      hubTicker: [],
      hpIntel: [],
      movement: {
        alerts: [
          {
            type: 'VISIT',
            player: 'Dion Edwards',
            detail:
              "Four-star 2028 ATH Dion Edwards has not been on Florida's campus yet. That will change this fall, as he's set to visit the Swamp along wi…",
            timestamp: new Date().toISOString(),
          },
        ],
      } as any,
    });
    assert.ok(stories.some((s) => /Dion Edwards — Florida visit this fall/i.test(s)));
    assert.ok(!stories.some((s) => /along wi|…|\.{3}/.test(s)));
  });


  it('drops Florida offers older than 3 weeks', () => {
    const stories = buildHomePulseStories({
      hubTicker: ['2027 class trending nationally — UF at #8'],
      hpIntel: [],
      movement: {
        alerts: [
          {
            type: 'OFFER',
            player: 'Jordyn Murray',
            detail: 'Jordyn Murray — Florida offer on file (2026-04-01).',
            timestamp: new Date().toISOString(),
          },
          {
            type: 'OFFER',
            player: 'No Day',
            detail: 'No Day — Florida offer',
            timestamp: new Date().toISOString(),
          },
        ],
      } as any,
    });
    assert.ok(!stories.some((s) => /Jordyn Murray|No Day/i.test(s)));
    assert.ok(stories.some((s) => /2027 class trending nationally/i.test(s)));
  });

});
