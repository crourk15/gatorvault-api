/** PR-789 dominant angle — one arc, one takeaway (shadow-safe). */

const { CHAR_LIMIT, isPr789AngleShadowMode, isPr789AngleEnabled } = require('./rewrite-types');
const { shouldUsePr789AngleLive } = require('./golden-beats');
const { ensurePeriod, validateSentences } = require('./sentence-gate');
const { validatePackTone } = require('./tone-engine');
const { isNarrativeFlow } = require('./narrative-gate');
const { isProvenanceSafe } = require('./provenance-gate');
const { validateCompetitionLine } = require('./competition-engine');
const { validateTrajectoryLine } = require('./trajectory-engine');
const { validateBrandVoiceLine } = require('./brandvoice-engine');
const { buildPr789Context } = require('./enhance-templates');
const { buildIdentityWithRanking } = require('./enhance-engine');
const { selectDominantAngle } = require('./angle-engine');
const { pickDominantArc } = require('./dominant-angle-templates');

function runAngleGates(narrative, tweet, pr5Pack, signal) {
  const prose = [narrative];
  const gates = {
    sentence: validateSentences(prose),
    tone: validatePackTone(prose),
    narrative: isNarrativeFlow(prose, pr5Pack),
    provenance: isProvenanceSafe(narrative, pr5Pack),
    competition: validateCompetitionLine(narrative, pr5Pack, signal),
    trajectory: validateTrajectoryLine(narrative, pr5Pack, signal),
    brand: validateBrandVoiceLine(narrative),
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

function enhancePr6PackDominantAngle(pr6Pack, pr5Pack, signal = {}, pr789Pack = null) {
  if (!pr6Pack?.ok) {
    return { ok: false, reason: 'pr6_failed', fallback: true, pr6Pack };
  }

  const ctx = buildPr789Context(pr5Pack, signal);
  const picked = selectDominantAngle(ctx, pr5Pack);
  const arc = pickDominantArc(ctx, picked.angle);
  const narrative = ensurePeriod(arc.narrative);
  const identityLine = buildIdentityWithRanking(pr6Pack.identityLine, signal);
  const cta = pr5Pack?.cta || pr6Pack.cta;
  const tweet = [identityLine, narrative, cta].filter(Boolean).join('\n');

  const { gates, allViolations, allPassed } = runAngleGates(narrative, tweet, pr5Pack, signal);

  if (!allPassed) {
    return {
      ok: false,
      reason: allViolations[0]?.type || 'angle_failed',
      fallback: true,
      dominantAngle: picked.angle,
      pr6Pack,
      pr789Pack,
      violations: allViolations,
      gates
    };
  }

  return {
    ok: true,
    identityLine,
    narrative,
    narrative1: narrative,
    narrative2: null,
    dominantAngle: picked.angle,
    angleReason: picked.reason,
    takeaway: arc.takeaway,
    rewrittenTweet: tweet,
    charCount: tweet.length,
    trace: {
      engine: 'pr789_angle',
      mode: 'dominant_arc',
      angle: picked.angle,
      angleScores: picked.scores,
      gates,
      pr789Original: pr789Pack
        ? { rewrittenTweet: pr789Pack.rewrittenTweet, narrative1: pr789Pack.narrative1, narrative2: pr789Pack.narrative2 }
        : null,
      pr6Original: { rewrittenTweet: pr6Pack.pr6OnlyTweet || pr6Pack.rewrittenTweet }
    }
  };
}

function shouldRunAngleEnhance() {
  return isPr789AngleShadowMode() || isPr789AngleEnabled();
}

module.exports = {
  enhancePr6PackDominantAngle,
  runAngleGates,
  shouldRunAngleEnhance
};
