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
    assert.equal(stories[0], '26 commits locked for 2027');
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
            detail: 'Gionni Lewis — Florida offer from player card.',
            timestamp: '2026-08-24T18:03:06.055Z',
          },
          {
            id: '2',
            type: 'OFFER',
            player: 'Kaleb Ballard',
            detail:
              'Kaleb Ballard — Florida offer on file (2026-07-11). Continuous allowlist intel sweep.',
            timestamp: '2026-08-24T12:28:57.660Z',
          },
        ],
      } as any,
    });
    assert.ok(stories.some((s) => /Tranard Roberts/.test(s)));
    assert.ok(stories.some((s) => /Gionni Lewis — Florida offer/.test(s)));
    assert.ok(!stories.some((s) => /Staff note|from player card|allowlist intel sweep/i.test(s)));
  });
});
