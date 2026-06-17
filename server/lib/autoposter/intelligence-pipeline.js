/**
 * Autoposter intelligence pipeline — queue item → identity → context → GM2 rewrite → post prep.
 */
const template = require('../x-autoposter-template');
const intelStore = require('../recruiting-intel-store');
const identityMatcher = require('./identity-matcher');
const contextEnrichment = require('./context-enrichment');
const rewriteEngine = require('./rewrite-engine');
const qualityChecks = require('./quality-checks');
const monitoring = require('./autoposter-monitoring');
const pipelineGuards = require('../pipeline-guards');

function findIntelForItem(item = {}) {
  if (item.sourceIntelId) {
    const doc = intelStore.loadIntelDoc();
    return (doc.items || []).find((i) => i.id === item.sourceIntelId) || null;
  }
  if (item.intelFingerprint) {
    const doc = intelStore.loadIntelDoc();
    return (doc.items || []).find((i) => i.fingerprint === item.intelFingerprint) || null;
  }
  return null;
}

function intelToBeatText(intel, item) {
  return (
    item?.validationMeta?.beatText ||
    intel?.text ||
    intel?.detail ||
    item?.text ||
    ''
  );
}

function buildTweetFromRewrite(player, rewriteText) {
  const ctx = {
    name: player.name,
    pos: player.position,
    classYear: player.classYear,
    starsLabel: player.rating ? `${player.rating}-Star` : null,
    hasMinimumContext: !!(player.name && player.position),
    hasFullIdentity: !!(player.name && player.position && player.classYear)
  };
  const identity = ctx.hasFullIdentity ? template.buildRecruitingIdentity(ctx) : null;
  const body = String(rewriteText || '').trim();
  if (identity && !body.startsWith(player.name)) {
    return template.enforceTweetLimit(`${identity}\n${body}`, 280, { eliteMode: true });
  }
  return template.enforceTweetLimit(body, 280, { eliteMode: true });
}

async function prepareQueueItemForPost(item = {}) {
  if (!pipelineGuards.pipelinesEnabled()) {
    return { ok: true, item, skipped: true, reason: 'pipelines disabled' };
  }
  if (!pipelineGuards.intelRewriteEnabled()) {
    return { ok: true, item, skipped: true, reason: 'intel rewrite disabled' };
  }
  if (process.env.X_AUTOPOST_INTELLIGENCE_REWRITE === 'false') {
    return { ok: true, item, skipped: true, reason: 'rewrite_disabled' };
  }
  if (String(item.category || '').toLowerCase() !== 'news') {
    return { ok: true, item, skipped: true, reason: 'non_news' };
  }

  const intel = pipelineGuards.guardIntelForPipeline(findIntelForItem(item));
  const beatText = intelToBeatText(intel, item);
  if (!beatText) {
    return { ok: true, item, skipped: true, reason: 'no_beat_text' };
  }

  const player =
    identityMatcher.matchIntelToPlayer(intel || { playerName: item.playerName, playerSlug: item.playerSlug }) ||
    identityMatcher.matchIntelToPlayer({ playerName: item.playerName });

  if (!player) {
    monitoring.logAutoposterEvent('rewrite_skip', {
      itemId: item.id,
      reason: 'no_player_match',
      playerName: item.playerName
    });
    return { ok: true, item, skipped: true, reason: 'no_player_match' };
  }

  const context = contextEnrichment.enrichContext(player, intel || { eventType: item.intelType, text: beatText });
  const rewrite = await rewriteEngine.rewriteIntel(player, context, {
    ...(intel || {}),
    text: beatText,
    detail: beatText
  });

  let finalText = rewrite?.text;
  let quality = rewrite?.quality;

  if (!quality?.ok && rewriteEngine.isEnabled()) {
    const pipeline = await rewriteEngine.rewriteIntelPipeline({
      beatText,
      intel: intel || { playerName: player.name, eventType: item.intelType, detail: beatText },
      rewriteMetrics: {
        ufProbability: context.ufProbability,
        movementDelta: context.movementDelta,
        fitScore: context.fitScore
      }
    });
    if (pipeline.ok && pipeline.text) {
      finalText = pipeline.text;
      quality = qualityChecks.validateRewrite(beatText, pipeline.text);
    }
  }

  if (!finalText || !quality?.ok) {
    monitoring.trackRewriteOutcome(false);
    monitoring.logAutoposterEvent('rewrite_failed', {
      itemId: item.id,
      playerId: player.playerId,
      intelId: intel?.id,
      quality
    });
    return {
      ok: false,
      reason: 'rewrite_failed',
      quality,
      item
    };
  }

  monitoring.trackRewriteOutcome(true);
  const text = buildTweetFromRewrite(player, finalText);
  const prepared = {
    ...item,
    text,
    playerName: player.name,
    validationMeta: {
      ...(item.validationMeta || {}),
      beatText,
      rewriteQuality: quality,
      intelligencePipeline: true
    },
    templateBlocks: {
      identity: template.buildRecruitingIdentity({
        name: player.name,
        pos: player.position,
        classYear: player.classYear,
        starsLabel: player.rating,
        hasFullIdentity: true,
        hasMinimumContext: true
      }),
      context: finalText.split('. ').slice(0, 2).join('. '),
      insider: finalText.split('. ').slice(2).join('. ')
    }
  };

  monitoring.logAutoposterEvent('rewrite_success', {
    itemId: item.id,
    playerId: player.playerId,
    intelId: intel?.id,
    wordCount: String(finalText).split(/\s+/).filter(Boolean).length,
    overlap: quality.similarity
  });

  return { ok: true, item: prepared, rewrite: { text: finalText, quality }, player, context };
}

module.exports = {
  findIntelForItem,
  prepareQueueItemForPost,
  buildTweetFromRewrite
};
