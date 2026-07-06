/**
 * Team event elite compose — facts, arcs, gates, dedupe.
 */
const template = require('../../x-autoposter-template');
const { getTweetCharLimit } = require('../tweet-char-limit');
const { extractTeamFacts } = require('./team-fact-extractor');
const { composeTeamArc } = require('./compose-team-arc');
const {
  THIN_FALLBACK_RE,
  passesTeamDetectionGate,
  validateTeamCompose,
  hasFactCompleteness
} = require('./team-gates');
const { computeTeamDedupeKey } = require('./team-dedupe');

function eliteComposeEnabled() {
  return process.env.X_AUTOPOST_TEAM_ELITE_COMPOSE !== 'false';
}

function composeTeamElitePost({ beatText, source, teamEventType = null, post = null } = {}) {
  if (!eliteComposeEnabled()) return { ok: false, reason: 'elite_disabled' };
  const beat = String(beatText || '').replace(/\s+/g, ' ').trim();
  if (!beat) return { ok: false, reason: 'empty_beat' };

  const gate = passesTeamDetectionGate(beat, { ...(post || {}), teamEventType });
  if (!gate.ok) return { ok: false, reason: gate.reason };

  const facts = extractTeamFacts(beat, { teamEventType });
  if (!hasFactCompleteness(facts, { teamEventType })) return { ok: false, reason: 'incomplete_facts' };

  const arcPack = composeTeamArc(facts, { teamEventType });
  const copyMeta = {
    triggerType: 'team_event',
    postKind: 'team_event',
    teamEventType: teamEventType || facts.event_type || 'general',
    beatText: beat
  };

  const raw = template.composeInsiderReport({
    identity: arcPack.identity,
    context: arcPack.context,
    insider: arcPack.insider
  });

  const validation = validateTeamCompose(raw);
  if (!validation.ok) return { ok: false, reason: validation.reason, facts, arc: arcPack.arc };

  const text = template.enforceTweetLimit(raw, getTweetCharLimit(), copyMeta);
  if (!text) return { ok: false, reason: 'tweet_limit_empty', facts, arc: arcPack.arc };
  if (THIN_FALLBACK_RE.test(text)) return { ok: false, reason: 'thin_fallback', facts, arc: arcPack.arc };

  return {
    ok: true,
    text,
    facts,
    arc: arcPack.arc,
    templateBlocks: {
      identity: arcPack.identity,
      context: arcPack.context,
      insider: arcPack.insider
    },
    validationMeta: {
      teamEvent: true,
      teamEliteCompose: true,
      teamEventType: copyMeta.teamEventType,
      arc: arcPack.arc,
      source: String(source || post?.writerName || 'Beat writer').trim(),
      beatText: beat,
      teamDedupeKey: computeTeamDedupeKey(facts),
      dedupeKey: computeTeamDedupeKey(facts)
    },
    dedupeKey: computeTeamDedupeKey(facts)
  };
}

module.exports = {
  THIN_FALLBACK_RE,
  eliteComposeEnabled,
  composeTeamElitePost
};