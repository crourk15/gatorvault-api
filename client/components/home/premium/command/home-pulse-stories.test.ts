import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyLiveCommitCountToTicker,
  buildHomeNowGameStory,
  buildHomePulseStories,
} from './home-command-utils';

const OFFSEASON = new Date('2026-07-15T16:00:00.000Z');
const OLE_MISS_WEEK = new Date('2026-09-21T18:00:00.000Z');

describe('buildHomePulseStories', () => {
  it('prefers named visits/flips over generic class trending', () => {
    const stories = buildHomePulseStories({
      now: OFFSEASON,
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
    assert.ok(stories.some((s) => /Tranard Roberts/.test(s)));
    // One class-metric filler max — never the lead when named intel exists.
    assert.equal(stories.filter((s) => /class trending|commits locked|Blue chip %/i.test(s)).length, 1);
    assert.notEqual(stories[0], '2027 class trending nationally — UF at #8');
  });

  it('does not freeze on the old UF in the mix fallback when hub ticker is live', () => {
    const stories = buildHomePulseStories({
      now: OFFSEASON,
      hubTicker: ['26 commits locked for 2027', '2027 class trending nationally — UF at #8'],
      hpIntel: [],
      movement: null,
    });
    assert.ok(
      stories[0] === '2027 class trending nationally — UF at #8' ||
        stories[0] === '26 commits locked for 2027'
    );
    assert.ok(!stories.some((s) => /UF in the mix/i.test(s)));
    assert.equal(stories.filter((s) => /class trending|commits locked|Blue chip %/i.test(s)).length, 1);
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
      now: OFFSEASON,
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
    assert.equal(stories.filter((s) => /class trending|commits locked|Blue chip %/i.test(s)).length, 1);
    assert.ok(!stories.some((s) => /Blue chip % at 100%|1 commits locked/i.test(s)));
    assert.ok(stories.filter((s) => /Florida offer/i.test(s)).length <= 2);
  });


  it('drops stale unofficial visit alerts from Home NOW', () => {
    const stories = buildHomePulseStories({
      now: OFFSEASON,
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
      now: OFFSEASON,
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
            detail: 'Gionni Lewis — Florida offer on file (2026-09-10) from player card.',
            timestamp: '2026-09-12T18:03:06.055Z',
          },
          {
            id: '2',
            type: 'OFFER',
            player: 'Kaleb Ballard',
            detail:
              'Kaleb Ballard — Florida offer on file (2026-09-08). Continuous allowlist intel sweep.',
            timestamp: '2026-09-12T12:28:57.660Z',
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
      now: OFFSEASON,
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
      now: OFFSEASON,
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

  it('pins three weekly NOW lines and drops class-rank filler', () => {
    const stories = buildHomePulseStories({
      now: OLE_MISS_WEEK,
      hubTicker: [
        'Game — Ole Miss in the Swamp · ABC',
        'Visitors — Craig-James · Vickers · Flowers',
        'Season — 3-0 · first SEC home Saturday',
        '2027 class trending nationally — UF at #8',
        'Cyion Smith — Visit scheduled (Saturday)',
      ],
      hpIntel: [{ id: '1', text: 'Izayah Vickers — Florida process.', timestamp: '', ufProbability: 0 }],
      movement: null,
    });
    assert.deepEqual(stories, [
      'Game — Ole Miss in the Swamp · ABC',
      'Visitors — Craig-James · Vickers · Flowers',
      'Season — 3-0 · first SEC home Saturday',
    ]);
    assert.ok(!stories.some((s) => /Cyion Smith|Florida process|class trending/i.test(s)));
  });

  it('does not let Expected visitors outrank Game Week', () => {
    const stories = buildHomePulseStories({
      now: OLE_MISS_WEEK,
      hubTicker: [
        'Expected visitors in the Swamp this Saturday',
        'Game Week — Ole Miss in the Swamp · ABC',
      ],
      hpIntel: [],
      movement: {
        alerts: [
          {
            type: 'VISIT',
            player: 'Izayah Vickers',
            detail: 'Vickers — expected Ole Miss gameday.',
            timestamp: '2026-09-21T12:00:00.000Z',
          },
        ],
      } as any,
    });
    assert.match(stories[0], /^Game Week — Ole Miss|^Game — Ole Miss/);
    assert.ok(stories[0] !== 'Expected visitors in the Swamp this Saturday');
  });

  it('drops last-week Campbell gameday from NOW', () => {
    const stories = buildHomePulseStories({
      now: OLE_MISS_WEEK,
      hubTicker: ['Game Week — Ole Miss in the Swamp · ABC'],
      hpIntel: [],
      movement: {
        alerts: [
          {
            type: 'VISIT',
            player: 'Man Robinson',
            detail: 'Robinson — expected Campbell gameday (2nd UF visit, first Swamp game).',
            timestamp: '2026-09-11T23:10:00.000Z',
          },
        ],
      } as any,
    });
    assert.ok(!stories.some((s) => /Man Robinson|Campbell gameday/i.test(s)));
    assert.match(stories[0], /Ole Miss/i);
  });

  it('drops thin Florida process rows', () => {
    const stories = buildHomePulseStories({
      now: OFFSEASON,
      hubTicker: ['Hudson West — Florida process.', '2027 class trending nationally — UF at #8'],
      hpIntel: [],
      movement: null,
    });
    assert.ok(!stories.some((s) => /Florida process/i.test(s)));
    assert.ok(stories.some((s) => /2027 class trending nationally/i.test(s)));
  });

});

describe('buildHomeNowGameStory', () => {
  it('stamps Ole Miss Game Week the Monday after Auburn', () => {
    const line = buildHomeNowGameStory(OLE_MISS_WEEK);
    assert.equal(line, 'Game Week — Ole Miss in the Swamp · ABC');
  });

  it('names Saturday kick inside 3 days', () => {
    const line = buildHomeNowGameStory(new Date('2026-09-25T16:00:00.000Z'));
    assert.match(String(line), /Ole Miss Saturday — 3:30 PM · ABC/);
  });

  it('stays quiet in July', () => {
    assert.equal(buildHomeNowGameStory(OFFSEASON), null);
  });
});
