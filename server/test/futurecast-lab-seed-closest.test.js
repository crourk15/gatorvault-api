/**
 * Closest to commit must first-paint from the Lab seed — not wait on live HP.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

const SEED_PATH = path.join(__dirname, '../../client/lib/futurecast-lab-seed.json');
const GEN_PATH = path.join(__dirname, '../../client/scripts/generate-futurecast-lab-seed.js');

function hasClosestProcess(p) {
  if (p.closestCommitEligible === true) return true;
  const ev = p.processEvidence;
  if (!ev) return false;
  if (ev.closestEligible === true) return true;
  if (ev.allowlisted === false) return false;
  return Boolean(ev.hasProcess && ev.stillWarm);
}

describe('FutureCast Lab seed Closest to commit', () => {
  it('keeps processEvidence in the seed generator', () => {
    const src = fs.readFileSync(GEN_PATH, 'utf8');
    assert.match(src, /function slimProcessEvidence/);
    assert.match(src, /closestCommitEligible/);
    assert.match(src, /slimHighPriorityList/);
  });

  it('bakes process-backed 2028 HP so Closest is not empty on first paint', () => {
    const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
    assert.ok(Array.isArray(seed.highPriority) && seed.highPriority.length >= 8);
    const withProcess = seed.highPriority.filter((p) => p.processEvidence || p.closestCommitEligible);
    const closest = seed.highPriority.filter(hasClosestProcess);
    assert.ok(
      withProcess.length >= 8,
      `expected processEvidence on seed HP, got ${withProcess.length}`
    );
    assert.ok(closest.length >= 5, `expected Closest-eligible seed HP, got ${closest.length}`);
    const withOdds = closest.filter(
      (p) => p.ufProbability != null && Number(p.ufProbability) > 0
    );
    assert.ok(withOdds.length >= 3, 'Closest seed rows need UF% for the panel');
  });
});
