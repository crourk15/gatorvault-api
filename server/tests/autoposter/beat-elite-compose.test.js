/** Beat-sourced elite compose — stale window + player URL + identity from beat text. */
const test = require('node:test');
const assert = require('node:assert/strict');
const postSpec = require('../../lib/x-autoposter-post-spec');
const dataLayer = require('../../lib/x-autoposter-data-layer');
const copy = require('../../lib/x-autoposter-copy');
const playerContext = require('../../lib/x-autoposter-player-context');
const qa = require('../../lib/autoposter/recruiting-post-qa');

const TORY_BEAT =
  'Woodward Academy (GA) 2028 DL Tory Clark was in the Swamp for Friday Night Lights on June 19. Along with the connections he made with the Gators, he also has a unique connection at Florida.';

test('beat intel within 14 days passes beat freshness gate', () => {
  const ts = Date.now() - 13 * 24 * 60 * 60 * 1000;
  const fresh = postSpec.validateIntelFreshness(ts, Date.now(), postSpec.MAX_BEAT_INTEL_AGE_MS);
  assert.equal(fresh.ok, true);
});

test('live intel older than 60m still fails default freshness gate', () => {
  const ts = Date.now() - 2 * 60 * 60 * 1000;
  const fresh = postSpec.validateIntelFreshness(ts, Date.now(), postSpec.MAX_INTEL_AGE_MS);
  assert.equal(fresh.ok, false);
  assert.equal(fresh.skipReason, 'stale_intel');
});

test('resolveAutoposterSiteUrl prefers player profile when slug present', () => {
  const url = copy.resolveAutoposterSiteUrl({ playerSlug: 'tory-clark', eventType: 'unofficial_visit' });
  assert.match(url, /futurecast\/player\/tory-clark/i);
});

test('Tory Clark beat visit composes elite post with player URL and passes QA', async () => {
  const intel = {
    eventType: 'unofficial_visit',
    playerName: 'Tory Clark',
    playerSlug: 'tory-clark',
    classYear: 2028,
    pos: 'DL',
    school: 'Woodward Academy',
    detail: TORY_BEAT,
    source: 'Tyler Harden',
    sourceHandle: 'ttjharden8',
    sourceType: 'beat',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    identityConfirmed: true
  };

  const fresh = dataLayer.assertIntelFresh(intel);
  assert.equal(fresh.ok, true, fresh.reason);

  const built = await playerContext.buildPlayerNewsPost({
    source: intel.source,
    newsEvent: playerContext.newsEventForIntel(intel),
    playerSlug: intel.playerSlug,
    playerName: intel.playerName,
    intel,
    beatText: intel.detail
  });

  assert.ok(built?.text, built?.skipReason || built?.reason || 'no text');
  assert.match(built.text, /Tory Clark/i);
  assert.match(built.text, /futurecast\/player\/tory-clark|\/vault\/recruiting\/player\/tory-clark/i);

  const candidate = {
    ...built,
    topic: 'recruiting',
    playerName: intel.playerName,
    playerSlug: intel.playerSlug,
    source: 'auto:beat-writer'
  };
  assert.equal(qa.passesPublishGate(candidate), true, qa.rejectReason(candidate));
});
