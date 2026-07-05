/** Beat intel scan must dedupe slugs and prioritize tier-A On3 rows like Cobbins. */
const test = require('node:test');
const assert = require('node:assert/strict');

const intelStore = require('../../lib/recruiting-intel-store');
const fill = require('../../lib/x-autoposter-fill');
const postSpec = require('../../lib/x-autoposter-post-spec');

test('selectBeatIntelForAutopost includes Cobbins beyond raw recency top-12', async () => {
  const beatIntel = intelStore
    .getUnqueuedIntel({ maxAgeMs: postSpec.MAX_BEAT_INTEL_AGE_MS })
    .filter(fill.isBeatWriterIntel);
  const rawTop12 = beatIntel.slice(0, 12);
  assert.equal(
    rawTop12.some((row) => row.playerSlug === 'jermaine-cobbins'),
    false,
    'Cobbins should sit outside naive recency top-12 in live intel doc'
  );

  const scan = await fill.selectBeatIntelForAutopost(beatIntel);
  assert.ok(
    scan.some((row) => row.playerSlug === 'jermaine-cobbins'),
    `expected Cobbins in tier-prioritized beat scan (${scan.length} rows)`
  );

  const slugs = scan.map((row) => row.playerSlug);
  assert.equal(slugs.length, new Set(slugs).size, 'beat scan should dedupe player slugs');
});

test('buildCandidatesFromIntelRows stops after maxBuild', async () => {
  const beatIntel = intelStore
    .getUnqueuedIntel({ maxAgeMs: postSpec.MAX_BEAT_INTEL_AGE_MS })
    .filter(fill.isBeatWriterIntel);
  const scan = await fill.selectBeatIntelForAutopost(beatIntel, { limit: 20 });
  assert.ok(scan.length > 2, 'need multiple intel rows for lazy-build probe');

  const built = await fill.buildCandidatesFromIntelRows(scan, { maxBuild: 2 });
  assert.equal(built.length, 2);
  const cobbinsIncluded = built.some((row) => row.playerSlug === 'jermaine-cobbins');
  const scanHasCobbins = scan.some((row) => row.playerSlug === 'jermaine-cobbins');
  if (scanHasCobbins && scan.findIndex((row) => row.playerSlug === 'jermaine-cobbins') < 6) {
    assert.equal(cobbinsIncluded, true, 'tier-A Cobbins should appear within first lazy builds');
  }
});

test('probeIntelAutoposterPath reports Cobbins intel path', async () => {
  const out = await fill.probeIntelAutoposterPath('jermaine-cobbins');
  assert.equal(out.ok, true);
  assert.ok(out.on3Row, 'expected On3 intel row');
  assert.equal(out.inBeatScan, true);
  assert.equal(out.build.ok, true);
  assert.equal(out.finalize, true);
  assert.equal(out.publishGate, true);
});

test('buildNewsFromIntel composes Cobbins fused candidate', async () => {
  const doc = intelStore.loadIntelDoc();
  const cobbins = (doc.items || []).find(
    (row) => row.playerSlug === 'jermaine-cobbins' && row.source === 'auto:on3-team-news'
  );
  assert.ok(cobbins, 'live Cobbins On3 intel row required for probe');
  assert.equal(cobbins.xPostQueued, false);
  assert.equal(cobbins.xPosted, false);

  const beatIntel = intelStore
    .getUnqueuedIntel({ maxAgeMs: postSpec.MAX_BEAT_INTEL_AGE_MS })
    .filter(fill.isBeatWriterIntel);
  const scan = await fill.selectBeatIntelForAutopost(beatIntel);
  assert.ok(scan.some((row) => row.id === cobbins.id));

  const built = await fill.buildNewsFromIntel(cobbins);
  assert.ok(built?.text, 'buildNewsFromIntel should compose Cobbins');
  assert.equal(built.validationMeta?.fusedIntel, true);
});
