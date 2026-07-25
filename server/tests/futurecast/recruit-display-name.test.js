const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  looksLikeSlugName,
  resolveRecruitDisplayName,
} = require('../../lib/recruit-display-name');
const { getMergedCanonicalNames } = require('../../lib/recruiting-target-allowlist');
const { buildAllowlistDiscoveryRow } = require('../../lib/early-discovery-allowlist-merge');

describe('recruit display names', () => {
  it('rejects slug-shaped names', () => {
    assert.equal(looksLikeSlugName('merrick-ham'), true);
    assert.equal(looksLikeSlugName('Merrick Ham'), false);
  });

  it('resolves Merrick Ham from canonical names when seed is a slug', () => {
    const name = resolveRecruitDisplayName(
      { slug: 'merrick-ham', name: 'merrick-ham' },
      { canonicalNames: getMergedCanonicalNames() }
    );
    assert.equal(name, 'Merrick Ham');
  });

  it('Early Discovery allowlist synth uses display names', () => {
    const board = require('../../data/recruiting/2028-target-board.json');
    const row = board.targets.find((t) => t.slug === 'merrick-ham');
    assert.ok(row);
    assert.equal(row.name, 'Merrick Ham');
    const built = buildAllowlistDiscoveryRow(row, 2028);
    assert.equal(built.fullName, 'Merrick Ham');
  });
});
