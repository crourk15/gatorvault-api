/** Insider style analyzer — learns cadence from UF beat-writer X posts. */
const test = require('node:test');
const assert = require('node:assert/strict');
const analyzer = require('../../lib/autoposter/insider-style-analyzer');
const corpus = require('../../lib/autoposter/insider-style-corpus');

test('analyzeCorpus extracts recruiting post patterns from seed data', () => {
  const out = analyzer.analyzeCorpus(analyzer.SEED_POSTS);
  assert.ok(out.sampleSize >= 8);
  assert.ok(out.aggregate.avgWords >= 12);
  assert.ok(out.aggregate.pctMentionsCampus > 0.2);
  assert.ok(out.aggregate.pctStartsWithYear > 0.2);
});

test('isRecruitingPost filters hype-only noise', () => {
  assert.equal(analyzer.isRecruitingPost('Beautiful weather in Athens today.'), false);
  assert.equal(
    analyzer.isRecruitingPost('2028 DL Marcus Lee (IMG) was in The Swamp for FNL.'),
    true
  );
});

test('buildStyleContextVariants prefers campus framing for visit beats', () => {
  const hints = analyzer.getStyleHints(corpus.getSeedCorpus(), {
    eventType: 'unofficial_visit',
    situation: 'visit'
  });
  const variants = analyzer.buildStyleContextVariants({
    hints,
    playerName: 'Tory Clark',
    pos: 'DL',
    school: 'Woodward Academy',
    classYear: 2028,
    eventType: 'unofficial_visit',
    beatText: 'Tory Clark was in the Swamp for Friday Night Lights.'
  });
  assert.ok(variants.length >= 2);
  assert.ok(variants.some((v) => /Gainesville|FNL|campus|staff/i.test(v)));
  assert.ok(variants.every((v) => !/GatorVault Detectives|\[writer\]/i.test(v)));
});

test('enrichVariantLists prepends style variants ahead of generic fallbacks', () => {
  const enriched = analyzer.enrichVariantLists(['Generic fallback line here for testing.'], ['Old insider line for testing here.'], {
    corpus: corpus.getSeedCorpus(),
    playerName: 'Tory Clark',
    pos: 'DL',
    school: 'Woodward Academy',
    classYear: 2028,
    eventType: 'unofficial_visit',
    beatText: 'Woodward Academy DL Tory Clark was in the Swamp for FNL.'
  });
  assert.ok(enriched.contextVariants.length > 1);
  assert.ok(enriched.insiderVariants.length > 1);
  assert.notEqual(enriched.contextVariants[0], 'Generic fallback line here for testing.');
});

test('getStyleGuide exposes human-readable writing rules', () => {
  const guide = analyzer.getStyleGuide(corpus.getSeedCorpus());
  assert.ok(Array.isArray(guide.writingRules));
  assert.ok(guide.writingRules.length >= 4);
  assert.match(guide.writingRules.join(' '), /staff|campus|momentum|Never copy/i);
});

test('refreshFromPosts persists aggregate stats without verbatim reuse fields', () => {
  const sample = [
    {
      handle: 'Corey_Bender',
      text: '2028 WR Sam Test (Central HS) was on campus in Gainesville for FNL. UF staff logged extended time.'
    }
  ];
  const built = corpus.buildCorpusFromPosts(sample, { source: 'test' });
  assert.equal(built.sampleSize, 1);
  assert.ok(built.aggregate);
  assert.equal(built.posts, undefined);
  assert.equal(built.rawText, undefined);
});
