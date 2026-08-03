/**
 * Airtight Fit % — Sumrall-staff scheme evidence + coverage gate.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assessFitEvidence,
  applyFitCoverageGate,
  resolveEvidenceBackedFitScore,
  loadRubric,
  normalizePos,
} = require('../lib/scheme-fit-evidence');

test('rubric staff is Sumrall / Faulkner / Brad White', () => {
  const r = loadRubric();
  assert.equal(r.staff.hc.name, 'Jon Sumrall');
  assert.equal(r.staff.oc.name, 'Buster Faulkner');
  assert.equal(r.staff.dc.name, 'Brad White');
  assert.ok(r.positions.EDGE.scheme.includes('3-3-5'));
  assert.ok(r.positions.QB.scheme.toLowerCase().includes('faulkner') || r.positions.QB.wanted.length > 3);
});

test('normalizePos maps DE → EDGE', () => {
  assert.equal(normalizePos('DE'), 'EDGE');
  assert.equal(normalizePos('og'), 'IOL');
});

test('Cyion Smith has full evidence → Fit scored', () => {
  const resolved = resolveEvidenceBackedFitScore(
    { slug: 'cyion-smith', position: 'S', fitScore: 84 },
    { existingFit: 84 }
  );
  assert.equal(resolved.evidence.level, 'full');
  assert.ok(resolved.fitScore != null && resolved.fitScore >= 50);
  assert.ok(resolved.fitScore <= 100);
});

test('no War Room / film evidence → Fit null (airtight)', () => {
  const resolved = resolveEvidenceBackedFitScore(
    { slug: 'no-such-recruit-xyz', position: 'WR', fitScore: 91 },
    {
      existingFit: 91,
      warRoom: null,
      film: null,
    }
  );
  assert.equal(resolved.evidence.level, 'none');
  assert.equal(resolved.fitScore, null);
});

test('thin evidence caps Fit at 60', () => {
  const evidence = assessFitEvidence('x', {
    warRoom: {
      strengths: ['length', 'burst'],
      schemeFit: '',
      comparison: '',
      projection: '',
    },
    film: { traits: [] },
  });
  assert.equal(evidence.level, 'thin');
  assert.equal(applyFitCoverageGate(88, evidence), 60);
});

test('full evidence allows high Fit', () => {
  const evidence = assessFitEvidence('x', {
    warRoom: {
      strengths: ['length', 'range', 'instincts'],
      schemeFit: 'Fits a length-first safety room that asks the deep defender to range the alley.',
      comparison: 'Comps to a rangy NFL free safety prototype.',
      projection: 'Develop into a Week-1 STAR / deep safety contributor.',
    },
    film: { traits: ['range', 'length', 'alley fill'] },
  });
  assert.equal(evidence.level, 'full');
  assert.equal(applyFitCoverageGate(88, evidence), 88);
});
