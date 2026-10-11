/**
 * Cold GNL must wait for an already-scheduled async warm.
 * getDashboard must not run on the synchronous getCachedDashboard return.
 * Run: node --test server/test/live-dashboard-news-wait.test.js
 */
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

describe('live dashboard news wait', () => {
  const modPath = path.join(__dirname, '..', 'lib', 'live-dashboard-cache.js');
  let cache;
  let calls;

  beforeEach(() => {
    calls = 0;
    delete require.cache[require.resolve(modPath)];
    const aggPath = require.resolve('../lib/live-aggregator');
    delete require.cache[aggPath];
    require.cache[aggPath] = {
      id: aggPath,
      filename: aggPath,
      loaded: true,
      exports: {
        getDashboard: () => {
          calls += 1;
          const episodes = Array.from({ length: 12 }, (_, i) => ({
            id: `ep-${i}`,
            title: `Episode ${i}`,
            description: 'x'.repeat(2000),
            publishedAt: '2026-10-01T12:00:00.000Z',
            playUrl: 'https://example.com/ep',
            imageUrl: 'https://example.com/img.jpg'
          }));
          return {
            feed: [
              {
                id: 'rankings',
                title: 'Team Recruiting Rankings — Recruiting intel',
                createdAt: '2026-10-11T18:21:00.000Z',
                source: 'On3'
              }
            ],
            beat: {
              posts: [
                {
                  id: 'royal-1',
                  writerName: 'Corey Bender',
                  handle: 'coreybender',
                  outlet: '247Sports',
                  text: 'Easton Royal has flipped to Florida.',
                  url: 'https://x.com/example/status/1',
                  publishedAt: '2026-10-11T22:15:00.000Z'
                }
              ],
              fetchedAt: '2026-10-11T22:20:00.000Z',
              source: 'x'
            },
            podcasts: {
              shows: [
                {
                  id: 'gators-breakdown',
                  name: 'Gators Breakdown',
                  imageUrl: 'https://example.com/show.jpg',
                  platforms: [{ label: 'Apple Podcasts', url: 'https://example.com/apple' }],
                  episodes
                }
              ],
              fetchedAt: '2026-10-11T12:00:00.000Z',
              errors: []
            },
            updatedAt: '2026-10-11T22:20:00.000Z'
          };
        }
      }
    };
    cache = require(modPath);
    cache.clearDashboardCache();
  });

  afterEach(() => {
    delete require.cache[require.resolve(modPath)];
    delete require.cache[require.resolve('../lib/live-aggregator')];
  });

  it('returns warming immediately and does not call getDashboard on that tick', () => {
    const out = cache.getCachedDashboard({ feedLimit: 20 });
    assert.equal(out.feed.length, 0);
    assert.equal(calls, 0);
  });

  it('cold request resolves to beat-led news after the async warm', async () => {
    const out = await cache.getDashboardForRequest({ feedLimit: 20 });
    assert.ok(calls >= 1);
    assert.ok(out.feed.length > 1);
    assert.match(out.feed[0].title, /Corey Bender/);
    assert.match(out.feed[0].title, /Easton Royal/);
    assert.equal(out.beat.posts.length, 1);
    assert.equal(out.podcasts.shows[0].episodes.length, 2);
    assert.ok(out.podcasts.shows[0].episodes[0].description.length <= 160);
    assert.equal(out.podcasts.shows[0].episodes[0].title, 'Episode 0');
  });

  it('leadFeedWithBeat puts the newest writer ahead of rankings', () => {
    const feed = cache.leadFeedWithBeat(
      [{ id: 'rank', title: 'Team Recruiting Rankings', createdAt: '2026-10-11T18:00:00.000Z' }],
      [
        {
          id: 'older',
          writerName: 'Blake Alderman',
          text: 'Older note',
          publishedAt: '2026-10-10T12:00:00.000Z'
        },
        {
          id: 'newer',
          writerName: 'Corey Bender',
          text: 'Royal is a Gator',
          publishedAt: '2026-10-11T22:15:00.000Z'
        }
      ],
      20
    );
    assert.match(feed[0].title, /Corey Bender/);
    assert.match(feed[1].title, /Blake Alderman/);
    assert.match(feed[2].title, /Rankings/);
  });
});
