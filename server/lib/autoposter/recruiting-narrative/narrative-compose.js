/**
 * Recruiting narrative elite compose — facts, arcs, gates, dedupe.
 */
const template = require('../../x-autoposter-template');
const { getTweetCharLimit } = require('../tweet-char-limit');
const { formatPlayerContext } = require('../../x-autoposter-player-context');
const { extractNarrativeFacts } = require('./narrative-fact-extractor');
const { composeNarrativeArc } = require('./compose-narrative-arc');
const {
  THIN_FALLBACK_RE,
  passesNarrativeDetectionGate,
  validateNarrativeCompose,
  hasFactCompleteness
} = require('./narrative-gates');
const { computeNarrativeDedupeKey } = require('./narrative-dedupe');

function eliteComposeEnabled() {
  return process.env.X_AUTOPOST_RECRUITING_NARRATIVE_ELITE_COMPOSE !== 'false';
}

function composeRecruitingNarrativeElitePost({
  beatText,
  source,
  playerName = null,
  playerSlug = null,
  pos = null,
  patch = null,
  post = null
} = {}) {
  if (!eliteComposeEnabled()) return { ok: false, reason: 'elite_disabled' };
  const beat = String(beatText || '').replace(/\s+/g, ' ').trim();
  if (!beat) return { ok: false, reason: 'empty_beat' };

  const gate = passesNarrativeDetectionGate(beat, {
    ...(post || {}),
    playerName: playerName || post?.playerName,
    playerSlug: playerSlug || post?.playerSlug,
    pos
  });
  if (!gate.ok) return { ok: false, reason: gate.reason };

  const facts = extractNarrativeFacts(beat, {
    playerName: playerName || gate.playerName,
    playerSlug,
    pos
  });
  if (!hasFactCompleteness(facts)) return { ok: false, reason: 'incomplete_facts' };

  const arcPack = composeNarrativeArc(facts);
  const ctx = formatPlayerContext({
    name: facts.player_name,
    pos: facts.pos,
    classYear: facts.class_year,
    stars: facts.stars,
    ...(patch || {})
  });
  const identity = template.buildNarrativeIdentity(ctx, arcPack.identityStatus);
  const copyMeta = {
    triggerType: 'recruiting_narrative_elite',
    postKind: 'recruiting_narrative',
    eventType: 'recruiting_narrative',
    beatText: beat,
    playerSlug: facts.player_slug || playerSlug || null
  };

  const raw = template.composeInsiderReport({
    identity,
    context: arcPack.context,
    insider: arcPack.insider
  });

  const validation = validateNarrativeCompose(raw);
  if (!validation.ok) return { ok: false, reason: validation.reason, facts, arc: arcPack.arc };

  const text = template.enforceTweetLimit(raw, getTweetCharLimit(), copyMeta);
  if (!text) return { ok: false, reason: 'tweet_limit_empty', facts, arc: arcPack.arc };
  if (THIN_FALLBACK_RE.test(text)) return { ok: false, reason: 'thin_fallback', facts, arc: arcPack.arc };

  const dedupeKey = computeNarrativeDedupeKey(facts);
  return {
    ok: true,
    text,
    facts,
    arc: arcPack.arc,
    playerName: facts.player_name,
    playerSlug: facts.player_slug || playerSlug || null,
    templateBlocks: {
      identity,
      context: arcPack.context,
      insider: arcPack.insider
    },
    validationMeta: {
      narrativeElite: true,
      narrativeEliteCompose: true,
      eventType: 'recruiting_narrative',
      arc: arcPack.arc,
      source: String(source || post?.writerName || 'Beat writer').trim(),
      beatText: beat,
      narrativeDedupeKey: dedupeKey,
      dedupeKey,
      playerSlug: facts.player_slug || playerSlug || null,
      hasRetrospectiveOffer: facts.has_retrospective_offer
    },
    dedupeKey,
    context: {
      recruitingNarrative: true,
      name: facts.player_name,
      playerSlug: facts.player_slug || playerSlug || null
    }
  };
}

module.exports = {
  THIN_FALLBACK_RE,
  eliteComposeEnabled,
  composeRecruitingNarrativeElitePost
};