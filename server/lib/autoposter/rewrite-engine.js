/**
 * Autoposter Rewrite Engine — intel → identity → context → GM2 rewrite → quality → regen.
 */
const template = require('../x-autoposter-template');
const postSpec = require('../x-autoposter-post-spec');
const quoteRewriter = require('../x-autoposter-recruiting-quote-rewriter');
const insiderPrompt = require('../x-autoposter-insider-prompt');
const store = require('../x-autoposter-store');
const gm2Client = require('../gm2-client');
const gm2Prompt = require('./gm2-rewrite-prompt');
const identityMatcher = require('./identity-matcher');
const contextEnrichment = require('./context-enrichment');
const qualityChecks = require('./quality-checks');
const monitoring = require('./autoposter-monitoring');

const MAX_REGEN_ATTEMPTS = parseInt(process.env.X_AUTOPOST_QUOTE_REGEN_ATTEMPTS || '3', 10);

function logRewriteOp(action, payload = {}) {
  try {
    store.appendOpsLog({ action, subsystem: 'rewrite-engine', ...payload });
    monitoring.logAutoposterEvent(action, payload);
  } catch {
    /* non-fatal */
  }
}

function isEnabled() {
  return quoteRewriter.isRewriterEnabled();
}

function isStubCall(arg1, arg2, arg3) {
  return (
    arg1 &&
    typeof arg1 === 'object' &&
    (arg1.name || arg1.playerId) &&
    arg2 &&
    typeof arg2 === 'object' &&
    arg3 &&
    typeof arg3 === 'object' &&
    (arg3.text != null || arg3.detail != null)
  );
}

async function buildPrompt(player, context, intel) {
  return gm2Prompt.formatGM2PromptBundle({
    beatText: intel.text || intel.detail,
    identity: player,
    context,
    intel,
    metrics: {
      ufProbability: context.ufProbability,
      movementDelta: context.movementDelta,
      fitScore: context.fitScore
    }
  });
}

async function rewriteIntelStub(player, context, intel) {
  const prompt = await buildPrompt(player, context, intel);
  const sourceText = String(intel.text || intel.detail || '');
  let attempts = 0;
  let lastRewrite = null;

  while (attempts < MAX_REGEN_ATTEMPTS) {
    const rewrite = await gm2Client.complete({ player, context, intel, prompt });
    const result = qualityChecks.validateRewrite(sourceText, rewrite, { eventType: intel?.eventType });
    if (result.ok) {
      monitoring.trackRewriteOutcome(true);
      logRewriteOp('rewrite_success', {
        playerName: player.name,
        attempts: attempts + 1,
        wordCount: rewrite.split(/\s+/).length,
        mode: 'stub'
      });
      return { text: rewrite, quality: result };
    }
    lastRewrite = { text: rewrite, quality: result };
    logRewriteOp('rewrite_regen', { attempt: attempts + 1, errors: result, playerName: player.name, mode: 'stub' });
    attempts += 1;
  }

  monitoring.trackRewriteOutcome(false);
  logRewriteOp('rewrite_failed', {
    playerName: player.name,
    attempts,
    mode: 'stub',
    quality: lastRewrite?.quality
  });
  return lastRewrite;
}

async function rewriteIntelPipeline(input = {}) {
  const {
    beatText,
    ctx = null,
    intel: rawIntel = null,
    research = null,
    newsEvent = null,
    eventType = null,
    sourceLabel = null,
    postKind = 'recruiting',
    sport = 'football',
    rewriteMetrics = null
  } = input;
  const intel = rawIntel || {};

  if (sport !== 'football') {
    logRewriteOp('rewrite_skip', { reason: 'non_football_sport', sport });
    return { ok: false, reason: 'non_football_sport', sport };
  }
  if (!isEnabled() || !beatText) {
    logRewriteOp('rewrite_skip', { reason: 'disabled_or_empty' });
    return { ok: false, reason: 'disabled_or_empty' };
  }

  const identityResult = ctx?.hasMinimumContext
    ? { ok: true, ctx, rewriteMetrics: rewriteMetrics || ctx.rewriteMetrics }
    : await identityMatcher.matchIdentity({ ...intel, beatText, detail: beatText });

  const metrics =
    rewriteMetrics ||
    research?.rewriteMetrics ||
    intel?.rewriteMetrics ||
    identityResult.rewriteMetrics ||
    {};

  const enriched = await contextEnrichment.enrichContextFull(
    identityResult.identity || identityResult || {},
    intel || {},
    research
  );

  const promptBundle = gm2Prompt.formatGM2PromptBundle({
    beatText,
    identity: identityResult.identity || identityResult.data || identityResult || {},
    context: enriched,
    intel,
    metrics: { ...metrics, ...enriched.metrics }
  });

  const signal = quoteRewriter.analyzeRecruitingSignal({
    beatText,
    ctx: ctx || identityResult.ctx,
    intel,
    research,
    eventType: eventType || research?.eventType || intel?.eventType,
    newsEvent
  });
  signal.situation = postSpec.detectSituation(beatText, signal.eventType);
  const sourceText = template.stripEmojisHashtags(beatText);

  const insiderBlocks = insiderPrompt.composeInsiderBlocks({
    signal,
    research,
    metrics: { ...metrics, ...enriched.metrics },
    intel,
    sourceLabel: sourceLabel || intel?.source || research?.source,
    situation: signal.situation
  });

  let contextLine = insiderBlocks.contextLine;
  let insiderLine = insiderBlocks.insiderLine;
  let attempt = 0;

  for (attempt = 0; attempt < MAX_REGEN_ATTEMPTS; attempt += 1) {
    const combined = `${contextLine} ${insiderLine}`.trim();
    const check = qualityChecks.runQualityChecks({
      text: combined,
      beatText: sourceText,
      blocks: { contextLine, insiderLine }
    });
    if (check.ok) break;

    logRewriteOp('rewrite_regen', {
      attempt: attempt + 1,
      errors: check.errors,
      playerName: intel?.playerName || identityResult.name,
      overlapRatio: check.overlapRatio,
      mode: 'pipeline'
    });

    const contextVariants = quoteRewriter.buildContextVariants(
      signal,
      ctx || identityResult.ctx,
      research,
      beatText
    );
    const insiderVariants = quoteRewriter.buildInsiderVariants(
      signal,
      ctx || identityResult.ctx,
      research,
      contextLine,
      beatText
    );
    contextLine =
      quoteRewriter.pickNonOverlapping(contextVariants, sourceText) ||
      contextVariants[attempt] ||
      contextLine;
    insiderLine =
      quoteRewriter.pickNonOverlapping(insiderVariants, sourceText) ||
      insiderVariants[attempt] ||
      insiderLine;
  }

  const finalCombined = `${contextLine} ${insiderLine}`.trim();
  const finalCheck = qualityChecks.runQualityChecks({
    text: finalCombined,
    beatText: sourceText,
    blocks: { contextLine, insiderLine }
  });
  const quality = qualityChecks.validateRewrite(sourceText, finalCombined);

  if (!finalCheck.ok) {
    monitoring.trackRewriteOutcome(false);
    logRewriteOp('rewrite_failed', {
      reason: finalCheck.errors[0],
      errors: finalCheck.errors,
      attempts: attempt + 1,
      playerName: intel?.playerName || identityResult.name,
      promptVersion: 'gm2_exact_v1',
      mode: 'pipeline'
    });
    return {
      ok: false,
      reason: finalCheck.errors[0] || 'rewrite_failed',
      errors: finalCheck.errors,
      signal,
      gm2Prompt: promptBundle,
      text: finalCombined,
      quality
    };
  }

  monitoring.trackRewriteOutcome(true);
  logRewriteOp('rewrite_success', {
    playerName: intel?.playerName || identityResult.name,
    attempts: attempt + 1,
    wordCount: finalCheck.wordCount,
    overlapRatio: finalCheck.overlapRatio,
    mode: 'pipeline'
  });

  return {
    ok: true,
    contextLine,
    insiderLine,
    text: finalCombined,
    quality,
    leadInsight: insiderBlocks.leadInsight,
    contextBlock: insiderBlocks.contextBlock,
    projection: insiderLine,
    signal,
    gm2Prompt: promptBundle,
    meta: {
      template: 'gm2_exact_v1',
      overlapRatio: finalCheck.overlapRatio,
      wordCount: finalCheck.wordCount,
      regenAttempts: attempt + 1,
      rewriteMetrics: { ...metrics, ...enriched.metrics }
    }
  };
}

async function rewriteIntel(arg1, arg2, arg3) {
  if (isStubCall(arg1, arg2, arg3)) {
    return rewriteIntelStub(arg1, arg2, arg3);
  }
  return rewriteIntelPipeline(arg1);
}

function rewriteBeatUpdate(input = {}) {
  return rewriteIntelPipeline(input);
}

module.exports = {
  isEnabled,
  buildPrompt,
  rewriteIntel,
  rewriteIntelStub,
  rewriteIntelPipeline,
  rewriteBeatUpdate,
  logRewriteOp,
  MAX_REGEN_ATTEMPTS
};
