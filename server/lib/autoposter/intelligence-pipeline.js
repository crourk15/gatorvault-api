/**
 * Autoposter intelligence pipeline — queue item → identity → context → GM2 rewrite → post prep.
 */
const template = require('../x-autoposter-template');
const intelStore = require('../recruiting-intel-store');
const policy = require('../x-autoposter-policy');
const identityMatcher = require('./identity-matcher');
const contextEnrichment = require('./context-enrichment');
const rewriteEngine = require('./rewrite-engine');
const qualityChecks = require('./quality-checks');
const monitoring = require('./autoposter-monitoring');
const pipelineGuards = require('../pipeline-guards');
const insiderTone = require('./insider-tone');

const MIN_REWRITE_WORDS = parseInt(process.env.X_AUTOPOST_MIN_REWRITE_WORDS || '40', 10);
const VERIFIED_MIN_WORDS = parseInt(process.env.X_AUTOPOST_VERIFIED_MIN_WORDS || '18', 10);

function isVerifiedCommitItem(item = {}) {
  return !!(item.verifiedCommit || item.validationMeta?.verifiedCommit);
}

/** On3/template commits already pass quality gates — GM2 rewrite often fails on short copy. */
function bypassRewriteForVerifiedCommit(item = {}) {
  if (!isVerifiedCommitItem(item)) return null;
  const check = policy.validatePostContent(item);
  if (!check.valid) return null;
  monitoring.logAutoposterEvent('rewrite_bypass', {
    itemId: item.id,
    reason: 'verified_commit_premade',
    playerName: item.playerName
  });
  return {
    ok: true,
    item,
    skipped: true,
    reason: 'verified_commit_premade',
    bypass: true
  };
}

function rewriteFallbackEnabled() {
  return process.env.X_AUTOPOST_REWRITE_FALLBACK !== 'false';
}

function buildFallbackResult(item, beatText, reason, extra = {}) {
  const queuedText = String(item.text || '').trim();
  if (!rewriteFallbackEnabled() || !queuedText) return null;
  const minWords = isVerifiedCommitItem(item) ? VERIFIED_MIN_WORDS : MIN_REWRITE_WORDS;
  const words = queuedText.split(/\s+/).filter(Boolean).length;
  if (words < minWords) return null;
  const tone = insiderTone.validateInsiderTone(queuedText, { minWords });
  if (tone.errors.length) return null;

  monitoring.logAutoposterEvent('rewrite_fallback', {
    itemId: item.id,
    reason,
    ...extra
  });
  return {
    ok: true,
    item: {
      ...item,
      text: queuedText,
      validationMeta: {
        ...(item.validationMeta || {}),
        beatText,
        rewriteFallback: true,
        rewriteFallbackReason: reason
      }
    },
    fallback: true,
    reason: 'rewrite_fallback'
  };
}

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

function buildTweetFromRewrite(player, rewriteText, meta = {}) {
  const brand = require('../x-autoposter-brand');
  const ctx = {
    name: player.name,
    pos: player.position,
    classYear: player.classYear,
    school: player.school || player.hometown,
    starsLabel: player.rating ? `${player.rating}-Star` : null,
    hasMinimumContext: !!(player.name && player.position),
    hasFullIdentity: !!(player.name && player.position && player.classYear)
  };
  const useCompact = brand.useCompactRecruitingIdentity(meta);
  const identity =
    ctx.hasFullIdentity || ctx.hasMinimumContext
      ? useCompact
        ? template.buildCompactRecruitingIdentity(ctx)
        : template.buildRecruitingIdentity(ctx)
      : null;
  const body = String(rewriteText || '').trim();
  let text =
    identity && !body.startsWith(player.name)
      ? template.enforceTweetLimit(`${identity}\n${body}`, 280, { eliteMode: true })
      : template.enforceTweetLimit(body, 280, { eliteMode: true });
  if (process.env.X_AUTOPOST_GV_CTA_ENABLED === 'true' && meta.playerSlug) {
    text =
      brand.appendSiteOnce(text, {
        playerSlug: meta.playerSlug,
        playerName: player.name,
        eventType: meta.eventType,
        eliteMode: true
      }) || text;
  }
  return text;
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

  const verifiedBypass = bypassRewriteForVerifiedCommit(item);
  if (verifiedBypass) return verifiedBypass;

  const eliteCaption = require('../x-autoposter-elite-caption');
  if (eliteCaption.isEliteModeEnabled()) {
    const intelForElite = pipelineGuards.guardIntelForPipeline(findIntelForItem(item));
    const beatForElite = intelToBeatText(intelForElite, item);
    const playerName = item.playerName || intelForElite?.playerName;
    const playerSlug = item.playerSlug || intelForElite?.playerSlug;
    if (playerName && (beatForElite || playerSlug)) {
      try {
        const elite = await eliteCaption.buildElitePlayerPost({
          playerName,
          playerSlug,
          beatText: beatForElite || null,
          intel: intelForElite || {
            playerName,
            playerSlug,
            detail: beatForElite || item.text,
            eventType: item.intelType || item.sourceEventType,
            source: item.source
          },
          source: item.source
        });
        if (elite?.ok && elite.text) {
          monitoring.logAutoposterEvent('elite_compose_success', {
            itemId: item.id,
            playerName: elite.playerName,
            eventType: elite.validationMeta?.eventType
          });
          return {
            ok: true,
            item: {
              ...item,
              text: elite.text,
              playerName: elite.playerName || item.playerName,
              playerSlug: elite.playerSlug || item.playerSlug,
              templateBlocks: elite.templateBlocks,
              validationMeta: {
                ...(item.validationMeta || {}),
                ...(elite.validationMeta || {}),
                eliteCompose: true,
                beatText: beatForElite
              }
            },
            elite: true
          };
        }
      } catch (err) {
        monitoring.logAutoposterEvent('elite_compose_skip', {
          itemId: item.id,
          error: err.message
        });
      }
    }
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
    const fallback = buildFallbackResult(item, beatText, 'no_player_match', {
      playerName: item.playerName
    });
    if (fallback) return fallback;
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
    const fallback = buildFallbackResult(item, beatText, 'rewrite_failed', {
      playerId: player.playerId,
      intelId: intel?.id
    });
    if (fallback) return fallback;
    return {
      ok: false,
      reason: 'rewrite_failed',
      quality,
      item
    };
  }

  monitoring.trackRewriteOutcome(true);
  const text = buildTweetFromRewrite(player, finalText, {
    playerSlug: item.playerSlug || player.slug || null,
    eventType: item.intelType || item.sourceEventType || intel?.eventType
  });
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
