import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shortSchoolLabel, topThreatVsFlorida } from './competing-schools';

describe('On3 lead shortSchoolLabel', () => {
  it('maps Notre Dame / Miss St / SC / TTU / NC State (no truncation garbage)', () => {
    assert.equal(shortSchoolLabel('Notre Dame'), 'ND');
    assert.equal(shortSchoolLabel('Mississippi State'), 'Miss St');
    assert.equal(shortSchoolLabel('South Carolina'), 'SC');
    assert.equal(shortSchoolLabel('Texas Tech Red Raiders'), 'TTU');
    assert.equal(shortSchoolLabel('NC State'), 'NC State');
    assert.equal(shortSchoolLabel('Stanford Cardinal'), 'Stanford');
  });

  it('Xander Edwards On3 lead chrome is ND not Notre', () => {
    const threat = topThreatVsFlorida({
      slug: 'xander-edwards',
      ufRpmPct: 12,
      competingSchools: [
        { name: 'Notre Dame', pct: 38.1 },
        { name: 'Miami', pct: 21 },
      ],
    } as any);
    assert.ok(threat);
    assert.equal(threat.label, 'ND');
  });
});
