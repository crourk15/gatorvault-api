'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildVerifiedOn3Summary,
  buildSyntheticBreakdown,
} = require('../../lib/recruiting-intel-quality');

describe('synthetic On3 summary commit guard', () => {
  it('does not stamp Committed to Florida on open board targets', () => {
    const summary = buildVerifiedOn3Summary({
      name: 'Merrick Ham',
      pos: 'EDGE',
      stars: 4,
      htWt: '6-6 / 230',
      school: 'Marietta',
      natlRank: 107,
      posRank: 14,
      stateRank: 12,
      status: 'uncommitted',
      committedTo: null,
      commitDate: null,
      ufStatus: 'Florida Offered',
    });
    assert.match(summary, /Merrick Ham/);
    assert.match(summary, /Florida Offered/);
    assert.doesNotMatch(summary, /Committed to Florida/);
  });

  it('keeps commit language for real Florida commits', () => {
    const summary = buildVerifiedOn3Summary({
      name: 'Example Commit',
      pos: 'WR',
      stars: 4,
      htWt: '6-1 / 190',
      school: 'Example HS',
      natlRank: 50,
      posRank: 8,
      stateRank: 5,
      status: 'committed',
      committedTo: 'Florida',
      commitDate: '2026-06-01',
    });
    assert.match(summary, /Committed to Florida on 2026-06-01/);

    const bd = buildSyntheticBreakdown({
      slug: 'example-commit',
      name: 'Example Commit',
      pos: 'WR',
      stars: 4,
      htWt: '6-1 / 190',
      school: 'Example HS',
      natlRank: 50,
      posRank: 8,
      stateRank: 5,
      status: 'committed',
      committedTo: 'Florida',
      commitDate: '2026-06-01',
    });
    assert.match(bd.insiderNotes, /Committed to Florida/);
  });
});
