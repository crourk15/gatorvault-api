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

const jaylen = {
  slug: 'jaylen-brown',
  name: 'Jaylen Brown',
  stars: 5,
  pos: 'WR',
  school: 'IMG Academy',
  classYear: 2025,
  natlRank: 42
};

const patterns = generator.generateIdentityPatterns(jaylen);
assert('generates 5 star WR Jaylen', patterns.some((p) => /^5 star WR Jaylen$/i.test(p)));
assert('generates five-star WR Jaylen', patterns.some((p) => /^five-star WR Jaylen$/i.test(p)));
assert('generates IMG Academy 5 star', patterns.some((p) => /IMG Academy 5 star/i.test(p)));
assert('generates Jaylen Brown full name', patterns.includes('Jaylen Brown'));
assert('generates Brown last name', patterns.includes('Brown'));
assert('generates five star WR Brown', patterns.some((p) => /^five star WR Brown$/i.test(p)));
assert('generates 5 star IMG Academy commit', patterns.some((p) => /5 star IMG Academy commit/i.test(p)));
assert('generates class year pattern', patterns.some((p) => /2025 WR Jaylen/i.test(p)));
assert('generates ranking pattern', patterns.some((p) => /#42 Jaylen/i.test(p)));

const texasTech = {
  slug: 'rival-edge',
  name: 'Test Edge',
  stars: 5,
  pos: 'EDGE',
  school: 'Houston Lamar',
  committedTo: 'Texas Tech',
  classYear: 2026
};
const ttPatterns = generator.generateIdentityPatterns(texasTech);
assert('generates Texas Tech 5 star for non-UF commit', ttPatterns.some((p) => /Texas Tech 5 star/i.test(p)));

const sample = {
  slug: 'trey-morrison',
  name: 'Trey Morrison',
  stars: 5,
  pos: 'WR',
  school: 'IMG Academy',
  classYear: 2025
};

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

  const rebuild = await patternStore.rebuildAllPatterns();
  assert('rebuild returns count and duration', rebuild.count > 0 && rebuild.durationMs >= 0);

  const validation = patternStore.validatePatternEntry(await patternStore.getPatternBySlug('trey-morrison'), sample);
  assert('validated entry has full name pattern', validation.valid || validation.missingPatterns.includes('full_name_pattern') === false);

  const bad = patternStore.validatePatternEntry({ slug: 'x', name: 'Single', patterns: [] });
  assert('invalid entry flagged', !bad.valid && bad.missingPatterns.includes('full_name'));

  if (process.exitCode) {
    console.error('\nIdentity pattern tests failed.');
  } else {
    console.log('\nAll identity pattern tests passed.');
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
