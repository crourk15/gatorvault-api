const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('tsx/cjs');

describe('Closest-to-commit process evidence', () => {
  it('requires UF process - Hudson qualifies, Leserra does not', () => {
    const {
      buildClosestCommitEvidenceIndex,
      getClosestCommitEvidence,
    } = require('../../lib/closest-commit-evidence');
    const index = buildClosestCommitEvidenceIndex({ classYear: 2028, days: 180 });

    const hudson = getClosestCommitEvidence(index, 'hudson-west');
    assert.equal(hudson.allowlisted, true, 'Hudson is allowlisted');
    assert.equal(hudson.hasUFOffer, true, 'Hudson has UF offer on file');
    assert.ok(hudson.floridaVisits >= 1, 'Hudson has Florida visits');
    assert.equal(hudson.hasProcess, true);
    assert.equal(hudson.closestEligible, true, 'Hudson is Closest-eligible');

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

    const leserra = payload.players.find((p) => p.slug === 'hamilton-leserra');
    if (leserra) {
      assert.equal(leserra.closestCommitEligible, false);
    }
  });
});
