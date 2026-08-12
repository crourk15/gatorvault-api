import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildHomePulseStories } from './home-command-utils';

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
});
