/**
 * Portal elite compose gates — rumor block, player identity, UF relevance.
 */
const { isValidPlayerName } = require('../../x-autoposter-player-context');
const { normalizeBeat, extractPlayerName } = require('./portal-fact-extractor');

const RUMOR_RE =
  /\b(rumor|rumors|hearing|heard that|could land|might land|may land|sources? tell|per sources|nothing confirmed|unconfirmed|still fluid|take this with a grain|expected to miss|likely out|game-time decision)\b/i;

const PORTAL_SIGNAL_RE =
  /\b(transfer portal|entered the portal|portal entry|in the portal|portal exit|transfer(?:ring)? to florida|transfer(?:ring)? to the gators)\b/i;

const THIN_FALLBACK_RE =
  /^entered the transfer portal\.?$/i;

const THIN_PORTAL_COPY_RES = [
  /^entered the transfer portal\.?$/i,
  /^entered the transfer portal per .+\.?$/i,
  /^entered the transfer portal; florida is among the programs tracking\.?$/i,
  /^entered the transfer portal; florida is among the programs tracking per .+\.?$/i
];

function isRumorBeat(beatText = '') {
  return RUMOR_RE.test(normalizeBeat(beatText));
}

function hasPortalSignal(beatText = '') {
  return PORTAL_SIGNAL_RE.test(normalizeBeat(beatText)) || /\bportal\b/i.test(normalizeBeat(beatText));
}

function isFloridaRelevant(beatText = '', portalEventType = null) {
  const beat = normalizeBeat(beatText);
  if (portalEventType === 'portal_out') return true;
  return /\b(florida|gators|gator|\buf\b|gainesville|swamp)\b/i.test(beat);
}

function passesPortalDetectionGate(beatText = '', post = null) {
  const beat = normalizeBeat(beatText);
  if (!beat) return { ok: false, reason: 'empty_beat' };
  if (!hasPortalSignal(beat) && !post?.portalEventType) return { ok: false, reason: 'no_portal_signal' };
  if (isRumorBeat(beat)) return { ok: false, reason: 'rumor_blocked' };
  const portalEventType = post?.portalEventType || null;
  if (!isFloridaRelevant(beat, portalEventType)) return { ok: false, reason: 'not_uf' };
  const playerName = extractPlayerName(beat, post || {});
  if (!playerName || !isValidPlayerName(playerName)) return { ok: false, reason: 'no_player' };
  return { ok: true, playerName };
}

function hasFactCompleteness(facts = {}, ctx = {}) {
  if (!facts?.player_name) return false;
  const type = String(ctx.portalEventType || facts.portal_type || 'portal_in').toLowerCase();
  if (type === 'portal_out') return Boolean(facts.player_name);
  if (type === 'portal_landing') return Boolean(facts.player_name);
  return Boolean(facts.player_name && (facts.uf_interest || facts.former_school || /\bportal\b/i.test(facts.beatText || '')));
}

function validatePortalCompose(text = '') {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t || t.length < 40) return { ok: false, reason: 'too_short' };
  if (THIN_FALLBACK_RE.test(t)) return { ok: false, reason: 'thin_fallback' };
  if (THIN_PORTAL_COPY_RES.some((re) => re.test(t))) return { ok: false, reason: 'thin_fallback' };
  if (RUMOR_RE.test(t)) return { ok: false, reason: 'rumor_copy' };
  return { ok: true };
}

module.exports = {
  RUMOR_RE,
  THIN_FALLBACK_RE,
  THIN_PORTAL_COPY_RES,
  isRumorBeat,
  hasPortalSignal,
  passesPortalDetectionGate,
  validatePortalCompose,
  hasFactCompleteness
};