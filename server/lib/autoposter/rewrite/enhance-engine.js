/** PR-7/8/9 — merge competition, trajectory, and brand into PR-6 narratives. */

const { CHAR_LIMIT } = require('./rewrite-types');
const { ensurePeriod, validateSentences } = require('./sentence-gate');
const { validatePackTone } = require('./tone-engine');
const { isNarrativeFlow } = require('./narrative-gate');
const { isProvenanceSafe } = require('./provenance-gate');
const { validateCompetitionLine } = require('./competition-engine');
const { validateTrajectoryLine } = require('./trajectory-engine');
const { validateBrandVoiceLine } = require('./brandvoice-engine');
const { pickPr789Rewrite, buildPr789Context } = require('./enhance-templates');
const { buildCompetitionLine } = require('./competition-engine');
const { buildTrajectoryLine } = require('./trajectory-engine');
const { buildBrandVoiceLine } = require('./brandvoice-engine');

function buildIdentityWithRanking(identityLine, signal) {
  const ranking = signal?.player?.ranking;
  if (!identityLine || !ranking) return identityLine;
  if (/On3 #/i.test(identityLine)) return identityLine;
  return `${identityLine} · On3 #${ranking}`;
}

function runPr789Gates(narrative1, narrative2, tweet, pr5Pack, signal) {
  const gates = {
    sentence: validateSentences([narrative1, narrative2]),
    tone: validatePackTone([narrative1, narrative2]),
    narrative: isNarrativeFlow([narrative1, narrative2], pr5Pack),
    provenance: isProvenanceSafe(`${narrative1} ${narrative2}`, pr5Pack),
    competition: validateCompetitionLine(`${narrative1} ${narrative2}`, pr5Pack, signal),
    trajectory: validateTrajectoryLine(`${narrative1} ${narrative2}`, pr5Pack, signal),
    brand: validateBrandVoiceLine(`${narrative1} ${narrative2}`),
    length: { ok: tweet.length <= CHAR_LIMIT, chars: tweet.length, limit: CHAR_LIMIT }
  };

  const allViolations = [
    ...(gates.sentence.violations || []),
    ...(gates.tone.violations || []),
    ...(gates.narrative.violations || []),
    ...(gates.provenance.violations || []),
    ...(gates.competition.violations || []),
    ...(gates.brand.violations || []),
    ...(gates.trajectory.violations || []),
    ...(gates.length.ok ? [] : [{ type: 'char_limit', chars: tweet.length }])
  ];

  return { gates, allViolations, allPassed: allViolations.length === 0 };
}

function enhancePr6Pack(pr6Pack, pr5Pack, signal = {}) {
  if (!pr6Pack?.ok) {
    return { ok: false, reason: 'pr6_failed', fallback: true, pr6Pack };
  }

  const ctx = buildPr789Context(pr5Pack, signal);
  const picked = pickPr789Rewrite(ctx);
  const narrative1 = ensurePeriod(picked.narrative1);
  const narrative2 = ensurePeriod(picked.narrative2);
  const identityLine = buildIdentityWithRanking(pr6Pack.identityLine, signal);
  const cta = pr5Pack?.cta || pr6Pack.cta;
  const tweet = [identityLine, narrative1, narrative2, cta].filter(Boolean).join('\n');

  let { gates, allViolations, allPassed } = runPr789Gates(narrative1, narrative2, tweet, pr5Pack, signal);

  if (!allPassed && tweet.length > CHAR_LIMIT) {
    const fallbackN2 = ensurePeriod(pr6Pack.narrative2);
    const fallbackTweet = [identityLine, narrative1, fallbackN2, cta].filter(Boolean).join('\n');
    const retry = runPr789Gates(narrative1, fallbackN2, fallbackTweet, pr5Pack, signal);
    if (retry.allPassed) {
      return {
        ok: true,
        identityLine,
        narrative1,
        narrative2: fallbackN2,
        rewrittenTweet: fallbackTweet,
        charCount: fallbackTweet.length,
        competitionLine: buildCompetitionLine(pr5Pack, signal)?.clause || null,
        trajectoryLine: buildTrajectoryLine(pr5Pack, signal)?.clause || null,
        brandVoiceLine: buildBrandVoiceLine(pr6Pack)?.clause || null,
        trace: {
          engine: 'pr789',
          mode: 'n2_pr6_fallback',
          gates: retry.gates,
          pr6Original: { narrative1: pr6Pack.narrative1, narrative2: pr6Pack.narrative2 }
        }
      };
    }
  }

  if (!allPassed) {
    return {
      ok: false,
      reason: allViolations[0]?.type || 'pr789_failed',
      fallback: true,
      pr6Pack,
      violations: allViolations,
      gates
    };
  }

  return {
    ok: true,
    identityLine,
    narrative1,
    narrative2,
    rewrittenTweet: tweet,
    charCount: tweet.length,
    competitionLine: buildCompetitionLine(pr5Pack, signal)?.clause || null,
    trajectoryLine: buildTrajectoryLine(pr5Pack, signal)?.clause || null,
    brandVoiceLine: buildBrandVoiceLine({ narrative1, narrative2 })?.clause || null,
    trace: {
      engine: 'pr789',
      mode: 'template',
      gates,
      pr6Original: {
        narrative1: pr6Pack.narrative1,
        narrative2: pr6Pack.narrative2,
        tweet: pr6Pack.rewrittenTweet
      }
    }
  };
}

module.exports = {
  enhancePr6Pack,
  buildIdentityWithRanking,
  runPr789Gates
};
