/**
 * Recruiting narrative elite gates — rumor block, UF relevance, no implied events.
 */
const { isValidPlayerName } = require('../../x-autoposter-player-context');
const { isFreshOfferBeat } = require('../recruiting-offer-disambiguation');
const {
  normalizeBeat,
  extractPlayerName,
  hasNarrativeSignals,
  extractQuote
} = require('./narrative-fact-extractor');

const RUMOR_RE =
  /\b(rumor|rumors|hearing|heard that|could land|might land|may land|sources? tell|per sources|nothing confirmed|unconfirmed|still fluid|take this with a grain|expected to miss|likely out|game-time decision)\b/i;

const UF_RE = /\b(florida|gators|gator|\buf\b|gainesville|swamp)\b/i;

const HARD_EVENT_RE =
  /\b(?:committed|commits?|decommit|flip(?:ped)?|entered the portal|official visit|\bov\b|decision day|announcement (?:coming|today))\b/i;

const IMPLIED_EVENT_RE =
  /\b(just\s+offered|received\s+an?\s+offer\s+today|re-?offered\s+today|leaning\s+to|top\s+(?:\d+|five|three|two)\s+schools?|crystal\s+ball|prediction\s+machine)\b/i;

const THIN_FALLBACK_RE = /^recruiting update\.?$/i;

function isRumorBeat(beatText = '') {
  return RUMOR_RE.test(normalizeBeat(beatText));
}

function isFloridaRelevant(beatText = '') {
  return UF_RE.test(normalizeBeat(beatText));
}

function hasQuoteAttribution(beatText = '') {
  const quote = extractQuote(beatText);
  if (!quote) return true;
  const beat = normalizeBeat(beatText);
  return /\b(says?|said|told|explained|noted|added|on florida|about florida|gators)\b/i.test(beat);
}

function isRecruitingNarrativeBeat(beatText = '', ctx = {}) {
  ctx = ctx || {};
  const beat = normalizeBeat(beatText);
  if (!beat || !isFloridaRelevant(beat)) return false;
  if (isRumorBeat(beat)) return false;
  if (HARD_EVENT_RE.test(beat)) return false;
  if (isFreshOfferBeat(beat)) return false;
  if (!hasNarrativeSignals(beat)) return false;
  const playerName = extractPlayerName(beat, ctx);
  if (!playerName || !isValidPlayerName(playerName)) return false;
  if (extractQuote(beat) && !hasQuoteAttribution(beat)) return false;
  return true;
}

function passesNarrativeDetectionGate(beatText = '', post = null) {
  const beat = normalizeBeat(beatText);
  if (!beat) return { ok: false, reason: 'empty_beat' };
  if (!isFloridaRelevant(beat)) return { ok: false, reason: 'not_uf' };
  if (isRumorBeat(beat)) return { ok: false, reason: 'rumor_blocked' };
  if (HARD_EVENT_RE.test(beat)) return { ok: false, reason: 'hard_event' };
  if (isFreshOfferBeat(beat)) return { ok: false, reason: 'fresh_offer' };
  if (!hasNarrativeSignals(beat)) return { ok: false, reason: 'no_narrative_signal' };
  const playerName = extractPlayerName(beat, post || {});
  if (!playerName || !isValidPlayerName(playerName)) return { ok: false, reason: 'no_player' };
  if (extractQuote(beat) && !hasQuoteAttribution(beat)) return { ok: false, reason: 'quote_unattributed' };
  return { ok: true, playerName };
}

function hasFactCompleteness(facts = {}) {
  if (!facts.player_name) return false;
  if (!facts.narrative_types?.length && !facts.quote) return false;
  return facts.narrative_strength >= 1;
}

function validateNarrativeCompose(text = '') {
  const t = String(text || '').trim();
  if (!t) return { ok: false, reason: 'empty_copy' };
  if (THIN_FALLBACK_RE.test(t)) return { ok: false, reason: 'thin_fallback' };
  if (IMPLIED_EVENT_RE.test(t)) return { ok: false, reason: 'implied_event' };
  if (!UF_RE.test(t)) return { ok: false, reason: 'missing_uf' };
  return { ok: true };
}

module.exports = {
  RUMOR_RE,
  THIN_FALLBACK_RE,
  isRumorBeat,
  isFloridaRelevant,
  isRecruitingNarrativeBeat,
  passesNarrativeDetectionGate,
  hasFactCompleteness,
  validateNarrativeCompose
};