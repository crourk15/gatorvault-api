import assert from 'node:assert/strict';
import test from 'node:test';
import { buildUfUniformChips, ufUniformSwatch } from './uf-uniform-colors';

test('ufUniformSwatch maps Orange / Blue / White / Retro', () => {
  assert.equal(ufUniformSwatch('Orange')?.background, '#fa4616');
  assert.equal(ufUniformSwatch('Blue')?.background, '#0021a5');
  assert.equal(ufUniformSwatch('White')?.color, '#0021a5');
  assert.match(String(ufUniformSwatch('Retro')?.background), /gradient|#e8dcc8/i);
});

test('buildUfUniformChips returns helmet jersey pants order', () => {
  const chips = buildUfUniformChips({
    helmet: 'Orange',
    jersey: 'Blue',
    pants: 'White',
    label: 'Orange / Blue / White',
  });
  assert.deepEqual(
    chips.map((c) => c.part),
    ['helmet', 'jersey', 'pants']
  );
  assert.deepEqual(
    chips.map((c) => c.swatch.label),
    ['Orange', 'Blue', 'White']
  );
});

test('buildUfUniformChips skips empty parts', () => {
  assert.equal(buildUfUniformChips(null).length, 0);
  assert.equal(buildUfUniformChips({ label: 'All-Blue' }).length, 0);
  assert.equal(
    buildUfUniformChips({ helmet: 'Blue', jersey: 'Blue', pants: 'Blue' }).length,
    3
  );
});
