/** PR-6 — trace for shadow mode + Detectives. */

function buildRewriteTrace({
  pr5Pack,
  rewritten,
  gates = {},
  attempts = 1,
  mode = 'shadow'
}) {
  return {
    engine: 'pr6',
    mode,
    attempts,
    original: {
      identity: pr5Pack?.identityLine || null,
      intel: pr5Pack?.intelLine || null,
      context: pr5Pack?.contextLine || null,
      strategy: pr5Pack?.strategyLine || null
    },
    rewritten: {
      identity: rewritten?.identityLine || null,
      intel: rewritten?.narrative1 || null,
      context: rewritten?.narrative2 || null,
      strategy: rewritten?.narrative2 || null,
      tweet: rewritten?.tweet || null
    },
    gates: {
      sentence: gates.sentence || null,
      tone: gates.tone || null,
      narrative: gates.narrative || null,
      provenance: gates.provenance || null,
      length: gates.length || null
    },
    passed: gates.allPassed === true,
    violations: gates.allViolations || []
  };
}

module.exports = {
  buildRewriteTrace
};
