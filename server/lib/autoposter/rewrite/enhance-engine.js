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

const {

  appendRankingTokensToIdentity,

  extractOn3RankingTokens,

  resolveStateAbbr

} = require('../on3-ranking-tokens');

const { isPr6GoldenBeat } = require('./golden-beats');

const {

  extractBeatFacts,

  selectAngleFromFacts,

  composeFromFacts

} = require('./beat-fact-extractor');

const { validateBannedPhrases, hasFactCompletenessForPr789 } = require('./fact-gates');

const { resolveValidCompSchools } = require('./comp-sourcing');



function buildIdentityWithRanking(identityLine, signal, opts = {}) {

  if (!identityLine) return identityLine;



  const rankingTokens =

    signal?.player?.rankingTokens || extractOn3RankingTokens(signal?.player || {});

  if (rankingTokens) {

    const stateAbbr = resolveStateAbbr(signal?.player || {});

    return appendRankingTokensToIdentity(identityLine, rankingTokens, signal?.player?.pos, {

      ...opts,

      stateAbbr

    });

  }



  const ranking = signal?.player?.ranking;

  if (!ranking) return identityLine;

  if (/On3 #/i.test(identityLine)) return identityLine;

  return `${identityLine} · On3 #${ranking}`;

}



function runPr789Gates(narrative1, narrative2, tweet, pr5Pack, signal) {

  const prose = [narrative1, narrative2].filter(Boolean);

  const sentenceLines = prose.flatMap((line) =>
    String(line || '')
      .split(/(?<=\.)\s+/)
      .filter(Boolean)
  );

  const gates = {

    sentence: validateSentences(sentenceLines.length ? sentenceLines : prose),

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



function enhanceFromBeatFacts(pr6Pack, pr5Pack, signal = {}) {

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

      pr6Pack,

      beatFacts: facts

    };

  }



  const anglePick = selectAngleFromFacts(facts, ctx.beatText);

  const composed = composeFromFacts(facts, anglePick, ctx, { mode: 'elite', trimTakeaway: true });

  const narrative1 = ensurePeriod(composed.narrative1 || composed.narrative);

  const narrative2 = null;

  const identityLine = buildIdentityWithRanking(pr6Pack.identityLine, signal);

  const cta = pr5Pack?.cta || pr6Pack.cta;

  const tweet = [identityLine, narrative1, narrative2, cta].filter(Boolean).join('\n');



  const compPack = resolveValidCompSchools({

    beatText: ctx.beatText,

    metrics: signal.metrics,

    player: signal.player,

    intel: signal.intelligence

  });

  const enrichedPack = {

    ...pr5Pack,

    beatText: ctx.beatText,

    compSchools: compPack.schools,

    beatFacts: facts

  };



  let { gates, allViolations, allPassed } = runPr789Gates(

    narrative1,

    narrative2,

    tweet,

    enrichedPack,

    { ...signal, metrics: { ...signal.metrics, compSchools: compPack.schools } }

  );



  if (!allPassed && tweet.length > CHAR_LIMIT) {
    const trimTiers = [
      {},
      { trimFollowUp: true },
      { trimFollowUp: true, trimTakeaway: true },
      { trimFollowUp: true, trimTakeaway: true, trimComp: true },
      { eliteShort: true, trimComp: false },
      { eliteShort: true, trimComp: true }
    ];

    for (const tier of trimTiers) {
      const elite = composeFromFacts(facts, anglePick, ctx, { mode: 'elite', ...tier });
      const eliteN1 = ensurePeriod(elite.narrative1 || elite.narrative);
      const compactIdentity = buildIdentityWithRanking(pr6Pack.identityLine, signal, { compact: true });
      const eliteTweet = [compactIdentity, eliteN1, cta].filter(Boolean).join('\n');
      if (eliteTweet.length > CHAR_LIMIT) continue;
      const eliteRetry = runPr789Gates(eliteN1, null, eliteTweet, enrichedPack, signal);
      if (eliteRetry.allPassed) {
        return {
          ok: true,
          identityLine: compactIdentity,
          narrative1: eliteN1,
          narrative2: null,
          rewrittenTweet: eliteTweet,
          charCount: eliteTweet.length,
          dominantAngle: anglePick.angle,
          beatFacts: facts,
          trace: { engine: 'pr789', mode: 'facts_elite_trim', gates: eliteRetry.gates, angle: anglePick, tier }
        };
      }
    }

    const compactIdentity = buildIdentityWithRanking(pr6Pack.identityLine, signal, { compact: true });
    const rankedDualTweet = [compactIdentity, narrative1, narrative2, cta].filter(Boolean).join('\n');
    if (rankedDualTweet.length <= CHAR_LIMIT) {
      const rankedRetry = runPr789Gates(narrative1, narrative2, rankedDualTweet, enrichedPack, signal);
      if (rankedRetry.allPassed) {
        return {
          ok: true,
          identityLine: compactIdentity,
          narrative1,
          narrative2,
          rewrittenTweet: rankedDualTweet,
          charCount: rankedDualTweet.length,
          dominantAngle: anglePick.angle,
          beatFacts: facts,
          trace: { engine: 'pr789', mode: 'facts_only_compact_ranks', gates: rankedRetry.gates, angle: anglePick }
        };
      }
    }

    const compactArc = composeFromFacts(facts, anglePick, ctx, { mode: 'single', compact: true }).narrative;
    const compactN1 = ensurePeriod(compactArc);
    const compactTweet = [compactIdentity, compactN1, cta].filter(Boolean).join('\n');
    const compactRetry = runPr789Gates(compactN1, null, compactTweet, enrichedPack, signal);
    if (compactRetry.allPassed) {
      return {
        ok: true,
        identityLine: compactIdentity,
        narrative1: compactN1,
        narrative2: null,
        rewrittenTweet: compactTweet,
        charCount: compactTweet.length,
        dominantAngle: anglePick.angle,
        beatFacts: facts,
        trace: { engine: 'pr789', mode: 'facts_only_compact', gates: compactRetry.gates, angle: anglePick }
      };
    }
  }

  if (!allPassed && narrative2 && tweet.length > CHAR_LIMIT) {

    let shortN1 = narrative1;

    if (facts.rpmTop?.length >= 2) {

      shortN1 = `${narrative1} ${facts.rpmTop[0].school} and ${facts.rpmTop[1].school} lead RPM, but UF stays in the mix.`;

    }

    const shorterTweet = [identityLine, shortN1, cta].filter(Boolean).join('\n');

    const retry = runPr789Gates(shortN1, null, shorterTweet, enrichedPack, signal);

    if (retry.allPassed) {

      return {

        ok: true,

        identityLine,

        narrative1: shortN1,

        narrative2: null,

        rewrittenTweet: shorterTweet,

        charCount: shorterTweet.length,

        dominantAngle: anglePick.angle,

        beatFacts: facts,

        trace: { engine: 'pr789', mode: 'facts_only_single', gates: retry.gates, angle: anglePick }

      };

    }

  }



  if (!allPassed) {

    return {

      ok: false,

      reason: allViolations[0]?.type || 'pr789_failed',

      fallback: true,

      pr6Pack,

      beatFacts: facts,

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

    dominantAngle: anglePick.angle,

    beatFacts: facts,

    competitionLine: buildCompetitionLine(enrichedPack, signal)?.clause || null,

    trajectoryLine: buildTrajectoryLine(enrichedPack, signal)?.clause || null,

    brandVoiceLine: buildBrandVoiceLine({ narrative1, narrative2 })?.clause || null,

    trace: {

      engine: 'pr789',

      mode: 'facts_only',

      angle: anglePick,

      gates,

      beatFacts: facts

    }

  };

}



function enhancePr6Pack(pr6Pack, pr5Pack, signal = {}) {

  if (!pr6Pack?.ok) {

    return { ok: false, reason: 'pr6_failed', fallback: true, pr6Pack };

  }



  if (isPr6GoldenBeat(signal)) {

    return enhanceFromBeatFacts(pr6Pack, pr5Pack, signal);

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

  enhanceFromBeatFacts,

  buildIdentityWithRanking,

  runPr789Gates

};

