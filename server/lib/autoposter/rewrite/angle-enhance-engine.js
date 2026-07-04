/** PR-789 dominant angle — one arc, one takeaway (shadow-safe). */



const { CHAR_LIMIT, isPr789AngleShadowMode, isPr789AngleEnabled } = require('./rewrite-types');

const { shouldUsePr789AngleLive, isPr6GoldenBeat } = require('./golden-beats');

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

const {

  extractBeatFacts,

  selectAngleFromFacts,

  composeFromFacts

} = require('./beat-fact-extractor');

const { validateBannedPhrases, hasFactCompletenessForPr789 } = require('./fact-gates');

const { resolveValidCompSchools } = require('./comp-sourcing');



function runAngleGates(narrative, tweet, pr5Pack, signal) {

  const sentenceLines = String(narrative || '')
    .split(/(?<=\.)\s+/)
    .filter(Boolean);

  const prose = sentenceLines.length ? sentenceLines : [narrative];

  const gates = {

    sentence: validateSentences(prose),

    tone: validatePackTone(prose),

    narrative: isNarrativeFlow(prose, pr5Pack),

    provenance: isProvenanceSafe(prose.join(' '), pr5Pack),

    banned: validateBannedPhrases(prose.join(' ')),

    competition: validateCompetitionLine(prose.join(' '), pr5Pack, signal),

    trajectory: validateTrajectoryLine(prose.join(' '), pr5Pack, signal),

    brand: validateBrandVoiceLine(prose.join(' ')),

    length: { ok: tweet.length <= CHAR_LIMIT, chars: tweet.length, limit: CHAR_LIMIT }

  };



  const allViolations = [

    ...(gates.sentence.violations || []),

    ...(gates.tone.violations || []),

    ...(gates.narrative.violations || []),

    ...(gates.provenance.violations || []),

    ...(gates.banned.violations || []),

    ...(gates.competition.violations || []),

    ...(gates.brand.violations || []),

    ...(gates.trajectory.violations || []),

    ...(gates.length.ok ? [] : [{ type: 'char_limit', chars: tweet.length }])

  ];



  return { gates, allViolations, allPassed: allViolations.length === 0 };

}



function enhanceAngleFromBeatFacts(pr6Pack, pr5Pack, signal = {}, pr789Pack = null) {

  const ctx = buildPr789Context(pr5Pack, signal);

  const facts = extractBeatFacts(ctx.beatText, {

    signal,

    metrics: signal.metrics,

    player: signal.player,

    intel: signal.intelligence || signal.metrics?.intelligence

  });



  if (!hasFactCompletenessForPr789(facts, ctx.beatText)) {

    return {

      ok: false,

      reason: 'intel_incomplete',

      fallback: true,

      dominantAngle: null,

      pr6Pack,

      pr789Pack,

      beatFacts: facts

    };

  }



  const anglePick = selectAngleFromFacts(facts, ctx.beatText);

  const composed = composeFromFacts(facts, anglePick, ctx, { mode: 'single', compact: true });

  const narrative = ensurePeriod(composed.narrative);

  const identityLine = buildIdentityWithRanking(pr6Pack.identityLine, signal);

  const cta = pr5Pack?.cta || pr6Pack.cta;

  const tweet = [identityLine, narrative, cta].filter(Boolean).join('\n');



  const compPack = resolveValidCompSchools({

    beatText: ctx.beatText,

    metrics: signal.metrics,

    player: signal.player

  });

  const enrichedPack = { ...pr5Pack, beatText: ctx.beatText, compSchools: compPack.schools, beatFacts: facts };

  const enrichedSignal = { ...signal, metrics: { ...signal.metrics, compSchools: compPack.schools } };



  const { gates, allViolations, allPassed } = runAngleGates(narrative, tweet, enrichedPack, enrichedSignal);



  if (!allPassed) {

    return {

      ok: false,

      reason: allViolations[0]?.type || 'angle_failed',

      fallback: true,

      dominantAngle: anglePick.angle,

      pr6Pack,

      pr789Pack,

      beatFacts: facts,

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

    dominantAngle: anglePick.angle,

    angleReason: anglePick.reason,

    takeaway: null,

    beatFacts: facts,

    rewrittenTweet: tweet,

    charCount: tweet.length,

    trace: {

      engine: 'pr789_angle',

      mode: 'facts_only',

      angle: anglePick,

      gates,

      beatFacts: facts

    }

  };

}



function enhancePr6PackDominantAngle(pr6Pack, pr5Pack, signal = {}, pr789Pack = null) {

  if (!pr6Pack?.ok) {

    return { ok: false, reason: 'pr6_failed', fallback: true, pr6Pack };

  }



  if (isPr6GoldenBeat(signal)) {

    return enhanceAngleFromBeatFacts(pr6Pack, pr5Pack, signal, pr789Pack);

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

  enhanceAngleFromBeatFacts,

  runAngleGates,

  shouldRunAngleEnhance

};

