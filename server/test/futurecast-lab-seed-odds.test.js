/**
 * Seed HP rows must expose ufProbability so the Lab commit-likelihood meter paints.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

const SEED_PATH = path.join(__dirname, '../../client/lib/futurecast-lab-seed.json');
const SEED_TS = path.join(__dirname, '../../client/lib/futurecast-lab-seed.ts');

describe('FutureCast Lab seed commit likelihood', () => {
  it('stores ufProbability on high-priority seed rows (not only ufConfidence)', () => {
    const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
    assert.ok(Array.isArray(seed.highPriority) && seed.highPriority.length >= 8);
    const withUf = seed.highPriority.filter(
      (p) => p.ufProbability != null && Number(p.ufProbability) > 0
    );
    assert.ok(
      withUf.length >= 8,
      `expected ufProbability on seed HP rows, got ${withUf.length}`
    );
  });

  it('normalize helper accepts legacy ufConfidence-only rows', () => {
    const src = fs.readFileSync(SEED_TS, 'utf8');
    assert.match(src, /normalizeSeedHighPriorityPlayer/);
    assert.match(src, /ufProbability \?\? p\.ufConfidence/);
  });

  it('seed generator keeps processEvidence for Closest first paint', () => {
    const gen = fs.readFileSync(
      path.join(__dirname, '../../client/scripts/generate-futurecast-lab-seed.js'),
      'utf8'
    );
    assert.match(gen, /slimProcessEvidence/);
    assert.match(gen, /closestCommitEligible/);
  });

  it('Lab hook treats ufConfidence as usable odds', () => {
    const hook = fs.readFileSync(
      path.join(__dirname, '../../client/components/futurecast/lab/useFutureCastLabData.ts'),
      'utf8'
    );
    assert.match(hook, /ufConfidence/);
    assert.match(hook, /hpUfPct/);
  });
});
