/**
 * API-owned On3 lead stamp — chase cards should not need Codemagic for stamp swings.
 * Run: node --test server/test/on3-lead-stamp.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveOn3LeadStamp,
  shortSchoolLabel,
  withOn3LeadStamp,
} = require('../lib/on3-lead-stamp');

describe('on3-lead-stamp', () => {
  it('labels Notre Dame / Miss St / TTU correctly', () => {
    assert.equal(shortSchoolLabel('Notre Dame'), 'ND');
    assert.equal(shortSchoolLabel('Mississippi State'), 'Miss St');
    assert.equal(shortSchoolLabel('Texas Tech Red Raiders'), 'TTU');
  });

  it('Xander Edwards stamp is ND', () => {
    assert.equal(
      resolveOn3LeadStamp({
        ufRpmPct: 12,
        competingSchools: [
          { name: 'Notre Dame', pct: 38.1 },
          { name: 'Miami', pct: 21 },
        ],
      }),
      'ND'
    );
  });

  it('UF leads when ufRpm beats top peer', () => {
    assert.equal(
      resolveOn3LeadStamp({
        ufRpmPct: 41,
        competingSchools: [
          { name: 'Miami', pct: 13 },
          { name: 'Auburn', pct: 11 },
        ],
      }),
      'UF'
    );
  });

  it('sanitize path stamps via withOn3LeadStamp after heal', () => {
    const { healHighPriorityRpmPoisonRow } = require('../api/futurecast/response-cache.ts');
    const healed = healHighPriorityRpmPoisonRow({
      slug: 'xander-edwards',
      name: 'Xander Edwards',
      stars: 4,
      ufRpmPct: 12,
      competingSchools: [
        { name: 'Notre Dame', pct: 38.1 },
        { name: 'Miami', pct: 21 },
      ],
    });
    const stamped = withOn3LeadStamp(healed);
    assert.equal(stamped.on3Lead, 'ND');
  });

  it('withOn3LeadStamp is idempotent', () => {
    const row = withOn3LeadStamp({
      ufRpmPct: 96,
      competingSchools: [],
    });
    assert.equal(row.on3Lead, 'UF');
    assert.equal(withOn3LeadStamp(row).on3Lead, 'UF');
  });
});
