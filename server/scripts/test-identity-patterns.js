/**
 * Unit tests — identity pattern generation + resolver integration.
 */
const generator = require('../lib/identity-pattern-generator');
const resolver = require('../lib/contextual-identity-resolver');
const patternStore = require('../lib/identity-patterns-store');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

const sample = {
  slug: 'trey-morrison',
  name: 'Trey Morrison',
  stars: 5,
  pos: 'WR',
  school: 'IMG Academy',
  classYear: 2025
};

const patterns = generator.generateIdentityPatterns(sample);
assert('generates star position firstName pattern', patterns.some((p) => /5 star WR Trey/i.test(p)));
assert('generates hyphen star pattern', patterns.some((p) => /5-star WR Trey/i.test(p)));
assert('generates full name pattern', patterns.includes('Trey Morrison'));
assert('generates last name pattern', patterns.includes('Morrison'));
assert('generates position firstName pattern', patterns.some((p) => /WR Trey/i.test(p)));

const record = generator.buildPatternRecord(sample);
assert('record includes slug and patterns array', record.slug === 'trey-morrison' && record.patterns.length >= 8);

(async () => {
  const store = require('../lib/recruiting-store');
  await store.upsertPlayer(sample);
  await patternStore.syncPatternsForPlayer(sample);

  const hit = resolver.lookupIdentityPattern('Five-star WR Trey visiting Florida', [
    await patternStore.getPatternBySlug('trey-morrison')
  ]);
  assert('lookup matches five-star WR Trey phrase', hit && hit.slug === 'trey-morrison');

  const resolved = await resolver.resolveContextualIdentity({
    text: 'Five-star WR Trey is set to officially visit Florida this weekend',
    sourceHandle: 'corey_bender'
  });
  assert(
    'resolver uses auto pattern when MOT absent',
    resolved.confirmed && resolved.mode === 'identity_pattern' && resolved.player?.slug === 'trey-morrison'
  );

  if (process.exitCode) {
    console.error('\nIdentity pattern tests failed.');
  } else {
    console.log('\nAll identity pattern tests passed.');
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
