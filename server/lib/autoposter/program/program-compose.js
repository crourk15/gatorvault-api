/**
 * Program elite compose — facts, arcs, gates, dedupe.
 */
const template = require('../../x-autoposter-template');
const { getTweetCharLimit } = require('../tweet-char-limit');
const { extractProgramFacts } = require('./program-fact-extractor');
const { composeProgramArc } = require('./compose-program-arc');
const {
  THIN_FALLBACK_RE,
  passesProgramDetectionGate,
  validateProgramCompose,
  hasFactCompleteness
} = require('./program-gates');
const { computeProgramDedupeKey } = require('./program-dedupe');

function eliteComposeEnabled() {
  return process.env.X_AUTOPOST_PROGRAM_ELITE_COMPOSE !== 'false';
}

function composeProgramElitePost({ beatText, source, programNewsType = null, post = null } = {}) {
  if (!eliteComposeEnabled()) return { ok: false, reason: 'elite_disabled' };
  const beat = String(beatText || '').replace(/\s+/g, ' ').trim();
  if (!beat) return { ok: false, reason: 'empty_beat' };

  const gate = passesProgramDetectionGate(beat, { ...(post || {}), programNewsType });
  if (!gate.ok) return { ok: false, reason: gate.reason };

  const facts = extractProgramFacts(beat, { programNewsType });
  if (!hasFactCompleteness(facts, { programNewsType })) return { ok: false, reason: 'incomplete_facts' };

  const arcPack = composeProgramArc(facts, { programNewsType });
  const copyMeta = {
    triggerType: 'program_news',
    postKind: 'program_news',
    programNewsType: programNewsType || facts.program_type || 'general',
    beatText: beat
  };

  const raw = template.composeInsiderReport({
    identity: arcPack.identity,
    context: arcPack.context,
    insider: arcPack.insider
  });

  const validation = validateProgramCompose(raw);
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
      programNews: true,
      programEliteCompose: true,
      programNewsType: copyMeta.programNewsType,
      arc: arcPack.arc,
      source: String(source || post?.writerName || 'Beat writer').trim(),
      beatText: beat,
      dedupeKey: computeProgramDedupeKey(facts)
    },
    dedupeKey: computeProgramDedupeKey(facts)
  };
}

module.exports = {
  THIN_FALLBACK_RE,
  eliteComposeEnabled,
  composeProgramElitePost
};