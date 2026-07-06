/**
 * Portal elite compose — player portal beats with identity, arcs, gates, dedupe.
 */
const template = require('../../x-autoposter-template');
const { getTweetCharLimit } = require('../tweet-char-limit');
const { formatPlayerContext } = require('../../x-autoposter-player-context');
const { extractPortalFacts } = require('./portal-fact-extractor');
const { composePortalArc } = require('./compose-portal-arc');
const {
  THIN_FALLBACK_RE,
  passesPortalDetectionGate,
  validatePortalCompose,
  hasFactCompleteness
} = require('./portal-gates');
const { computePortalDedupeKey } = require('./portal-dedupe');

function eliteComposeEnabled() {
  return process.env.X_AUTOPOST_PORTAL_ELITE_COMPOSE !== 'false';
}

function composePortalElitePost({
  beatText,
  source,
  portalEventType = null,
  playerName = null,
  playerSlug = null,
  pos = null,
  formerSchool = null,
  patch = null,
  post = null
} = {}) {
  if (!eliteComposeEnabled()) return { ok: false, reason: 'elite_disabled' };
  const beat = String(beatText || '').replace(/\s+/g, ' ').trim();
  if (!beat) return { ok: false, reason: 'empty_beat' };

  const gate = passesPortalDetectionGate(beat, {
    ...(post || {}),
    portalEventType,
    playerName: playerName || post?.playerName,
    playerSlug: playerSlug || post?.playerSlug,
    pos
  });
  if (!gate.ok) return { ok: false, reason: gate.reason };

  const facts = extractPortalFacts(beat, {
    portalEventType,
    playerName: playerName || gate.playerName,
    playerSlug,
    pos
  });
  if (formerSchool && !facts.former_school) facts.former_school = formerSchool;
  if (!hasFactCompleteness(facts, { portalEventType })) return { ok: false, reason: 'incomplete_facts' };

  const arcPack = composePortalArc(facts, { portalEventType });
  const ctx = formatPlayerContext({
    name: facts.player_name,
    pos: facts.pos,
    formerSchool: facts.former_school,
    school: facts.former_school,
    ...(patch || {})
  });
  const identity = template.buildPortalIdentity(ctx, arcPack.identityStatus);
  const copyMeta = {
    triggerType: 'portal_elite',
    postKind: 'portal',
    portalEventType: portalEventType || facts.portal_type || 'portal_in',
    beatText: beat,
    playerSlug: facts.player_slug || playerSlug || null
  };

  const raw = template.composeInsiderReport({
    identity,
    context: arcPack.context,
    insider: arcPack.insider
  });

  const validation = validatePortalCompose(raw);
  if (!validation.ok) return { ok: false, reason: validation.reason, facts, arc: arcPack.arc };

  const text = template.enforceTweetLimit(raw, getTweetCharLimit(), copyMeta);
  if (!text) return { ok: false, reason: 'tweet_limit_empty', facts, arc: arcPack.arc };
  if (THIN_FALLBACK_RE.test(text)) return { ok: false, reason: 'thin_fallback', facts, arc: arcPack.arc };

  const dedupeKey = computePortalDedupeKey(facts);
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
      portalElite: true,
      portalEliteCompose: true,
      portalEventType: copyMeta.portalEventType,
      eventType: copyMeta.portalEventType,
      arc: arcPack.arc,
      source: String(source || post?.writerName || 'Beat writer').trim(),
      beatText: beat,
      portalDedupeKey: dedupeKey,
      dedupeKey,
      playerSlug: facts.player_slug || playerSlug || null,
      isPortal: true
    },
    dedupeKey,
    context: { isPortal: true, name: facts.player_name, playerSlug: facts.player_slug || playerSlug || null }
  };
}

module.exports = {
  THIN_FALLBACK_RE,
  eliteComposeEnabled,
  composePortalElitePost
};