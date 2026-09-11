const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('tsx/cjs');

describe('Closest-to-commit process evidence', () => {
  it('requires UF process - Hudson qualifies, Leserra does not', () => {
    const {
      buildClosestCommitEvidenceIndex,
      getClosestCommitEvidence,
      clearClosestCommitEvidenceCache,
    } = require('../../lib/closest-commit-evidence');
    clearClosestCommitEvidenceCache();
    const index = buildClosestCommitEvidenceIndex({ classYear: 2028, days: 180 });

    const hudson = getClosestCommitEvidence(index, 'hudson-west');
    assert.equal(hudson.allowlisted, true, 'Hudson is allowlisted');
    assert.equal(hudson.hasUFOffer, true, 'Hudson has UF offer on file');
    assert.ok(hudson.floridaVisits >= 1, 'Hudson has Florida visits');
    assert.equal(hudson.hasProcess, true);
    assert.equal(hudson.closestEligible, true, 'Hudson is Closest-eligible');

    const taylor = getClosestCommitEvidence(index, 'josiah-taylor');
    assert.equal(taylor.allowlisted, true, 'Taylor is allowlisted after FAU gameday');
    assert.ok(taylor.floridaVisits >= 1, 'Taylor has Florida visits');
    assert.equal(taylor.hasProcess, true);
    assert.equal(taylor.closestEligible, true, 'Taylor is Closest-eligible on process');

    const leserra = getClosestCommitEvidence(index, 'hamilton-leserra');
    assert.equal(leserra.allowlisted, false, 'Leserra is not on locked allowlist');
    assert.equal(leserra.hasUFOffer, false, 'Leserra has no UF offer log');
    assert.equal(
      leserra.closestEligible,
      false,
      'Leserra must not get Closest stamp from thin odds'
    );
  });

  it('high-priority 2028 payload attaches processEvidence', async () => {
    const { buildHighPriorityPayload } = require('../../api/futurecast/high-priority.ts');
    const payload = await buildHighPriorityPayload(2028);
    const hudson = payload.players.find((p) => p.slug === 'hudson-west');
    assert.ok(hudson, 'Hudson on HP board');
    assert.ok(hudson.processEvidence, 'processEvidence attached');
    assert.equal(hudson.closestCommitEligible, true);

    const taylorHp = payload.players.find((p) => p.slug === 'josiah-taylor');
    assert.ok(taylorHp, 'Taylor on HP board so Closest can rank him');
    assert.equal(taylorHp.closestCommitEligible, true);
    assert.ok(
      Number(taylorHp.ufProbability) >= 50,
      `Taylor needs a GV board lead for Closest, got ${taylorHp.ufProbability}`
    );

    const leserra = payload.players.find((p) => p.slug === 'hamilton-leserra');
    if (leserra) {
      assert.equal(leserra.closestCommitEligible, false);
    }
  });

  it('reuses the Closest evidence index so Lab HP rebuilds skip a second players.json parse', () => {
    const {
      buildClosestCommitEvidenceIndex,
      clearClosestCommitEvidenceCache,
    } = require('../../lib/closest-commit-evidence');
    clearClosestCommitEvidenceCache();
    const first = buildClosestCommitEvidenceIndex({ classYear: 2028, days: 180 });
    const second = buildClosestCommitEvidenceIndex({ classYear: 2028, days: 180 });
    assert.equal(second, first, 'TTL cache must return the same index object');
    const fresh = buildClosestCommitEvidenceIndex({ classYear: 2028, days: 180, fresh: true });
    assert.notEqual(fresh, first, 'fresh:true must rebuild');
    assert.equal(fresh.bySlug.get('hudson-west')?.closestEligible, true);
  });
});
