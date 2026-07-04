/** PR-6 — rewrite PR-5 output into elite insider copy (shadow-safe). */

const { CHAR_LIMIT, MAX_REWRITE_ATTEMPTS, isPr789ShadowMode, isPr789Enabled } = require('./rewrite-types');
const { shouldUsePr789Live } = require('./golden-beats');
const { validateSentences, ensurePeriod } = require('./sentence-gate');
const { validatePackTone } = require('./tone-engine');
const { isNarrativeFlow } = require('./narrative-gate');
const { isProvenanceSafe } = require('./provenance-gate');
const { pickRewrite, pickShortRewrite, buildRewriteContext } = require('./rewrite-templates');
const { buildRewriteTrace } = require('./rewrite-trace');
const { enhancePr6Pack } = require('./enhance-engine');
const { enhancePr6PackDominantAngle, shouldRunAngleEnhance } = require('./angle-enhance-engine');
const { shouldUsePr789AngleLive } = require('./golden-beats');

function assembleTweet(identityLine, narrative1, narrative2, cta) {
  return [identityLine, narrative1, narrative2, cta].filter(Boolean).join('\n');
}

function runGates(proseLines, pr5Pack, tweetLength) {
  const sentence = validateSentences(proseLines);
  const tone = validatePackTone(proseLines);
  const narrative = isNarrativeFlow(proseLines, pr5Pack);
  const provenance = isProvenanceSafe(proseLines.join(' '), pr5Pack);
  const length = { ok: tweetLength <= CHAR_LIMIT, chars: tweetLength, limit: CHAR_LIMIT };

  const allViolations = [
    ...(sentence.violations || []),
    ...(tone.violations || []),
    ...(narrative.violations || []),
    ...(provenance.violations || []),
    ...(length.ok ? [] : [{ type: 'char_limit', chars: tweetLength }])
  ];

  return {
    sentence,
    tone,
    narrative,
    provenance,
    length,
    allPassed: sentence.ok && tone.ok && narrative.ok && provenance.ok && length.ok,
    allViolations
  };
}

function rewriteStrategyPack(pr5Pack, signal = {}, opts = {}) {
  const identityLine = pr5Pack?.identityLine || pr5Pack?.identity?.line || null;
  const cta = pr5Pack?.cta || opts.cta || null;
  const ctx = buildRewriteContext(pr5Pack, signal);

  let narrative1 = null;
  let narrative2 = null;
  let gates = null;
  let attempts = 0;

  for (attempts = 1; attempts <= MAX_REWRITE_ATTEMPTS; attempts += 1) {
    const picked = attempts >= 2 ? pickShortRewrite(ctx) : pickRewrite(ctx);
    narrative1 = ensurePeriod(picked.narrative1);
    narrative2 = ensurePeriod(picked.narrative2);

    const tweet = assembleTweet(identityLine, narrative1, narrative2, cta);
    gates = runGates([narrative1, narrative2], pr5Pack, tweet.length);
    if (gates.allPassed) break;
  }

  const tweet = assembleTweet(identityLine, narrative1, narrative2, cta);
  const trace = buildRewriteTrace({
    pr5Pack,
    rewritten: { identityLine, narrative1, narrative2, tweet },
    gates,
    attempts,
    mode: opts.mode || 'shadow'
  });

  const pr6Result = {
    ok: gates?.allPassed === true,
    identityLine,
    rewrittenIntel: narrative1,
    rewrittenContext: narrative2,
    rewrittenStrategy: narrative2,
    rewrittenTweet: tweet,
    pr6OnlyTweet: tweet,
    pr6OnlyCharCount: tweet.length,
    narrative1,
    narrative2,
    charCount: tweet.length,
    trace,
    reason: gates?.allPassed ? null : gates?.allViolations?.[0]?.type || 'rewrite_failed',
    cta
  };

  if ((isPr789ShadowMode() || isPr789Enabled()) && pr6Result.ok) {
    const pr789 = enhancePr6Pack(pr6Result, pr5Pack, signal);
    pr6Result.pr789 = pr789;
    if (shouldUsePr789Live(signal, pr789)) {
      pr6Result.rewrittenTweet = pr789.rewrittenTweet;
      pr6Result.narrative1 = pr789.narrative1;
      pr6Result.narrative2 = pr789.narrative2;
      pr6Result.identityLine = pr789.identityLine;
      pr6Result.charCount = pr789.charCount;
      pr6Result.pr789Live = true;
    }
  }

  if (shouldRunAngleEnhance() && pr6Result.ok) {
    const anglePack = enhancePr6PackDominantAngle(pr6Result, pr5Pack, signal, pr6Result.pr789 || null);
    pr6Result.pr789Angle = anglePack;
    if (shouldUsePr789AngleLive(signal, anglePack)) {
      pr6Result.rewrittenTweet = anglePack.rewrittenTweet;
      pr6Result.narrative1 = anglePack.narrative1;
      pr6Result.narrative2 = anglePack.narrative2;
      pr6Result.identityLine = anglePack.identityLine;
      pr6Result.charCount = anglePack.charCount;
      pr6Result.pr789AngleLive = true;
    }
  }

  return pr6Result;
}

function buildPr5PackFromBlocks(blocks, signal) {
  const player = signal?.player || {};
  return {
    identityLine: blocks?.identity?.line || null,
    intelLine: blocks?.intel || null,
    contextLine: blocks?.context || null,
    strategyLine: blocks?.strategy || null,
    strategyTrace: blocks?.strategyTrace || null,
    beatText: signal?.beatText || signal?.event?.description || '',
    cta: blocks?.cta || null,
    compSchools: signal?.metrics?.compSchools || [],
    position: player.pos || null,
    classYear: player.classYear || null
  };
}

module.exports = {
  rewriteStrategyPack,
  buildPr5PackFromBlocks,
  assembleTweet,
  runGates
};
