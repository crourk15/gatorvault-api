/**
 * Portal beat fact extraction — player name, direction, former school, UF interest.
 */
const { isValidPlayerName } = require('../../x-autoposter-player-context');

const PORTAL_NAME_RE =
  /\b([A-Z][a-z'.-]+\s+[A-Z][a-z'.-]+(?:\s+[A-Z][a-z'.-]+)?)\s+(?:has\s+)?(?:entered|enters|is entering|in)\s+(?:the\s+)?transfer\s+portal\b/i;
const PORTAL_NAME_ALT_RE =
  /\b(?:Former|Ex-)\s+([A-Z][a-z'.-]+\s+[A-Z][a-z'.-]+(?:\s+[A-Z][a-z'.-]+)?)\b/i;
const POS_RE = /\b(QB|RB|WR|TE|OL|OT|OG|C|DL|DE|EDGE|LB|CB|S|ATH|K|P)\b/;
const FORMER_SCHOOL_RE =
  /\b(?:from|leaving|exiting|departing)\s+([A-Z][A-Za-z0-9 .&'-]+?)(?:\s+(?:entered|has|is|was|in|to|,|\.|roster|football)|$)/i;
const FORMER_SCHOOL_ALT_RE = /\bformer\s+([A-Z][A-Za-z0-9 .&'-]+?)\s+(?:qb|rb|wr|te|ol|dl|de|lb|cb|s|ath|player)\b/i;

function normalizeBeat(beatText = '') {
  return String(beatText || '').replace(/\s+/g, ' ').trim();
}

function extractPlayerName(beatText = '', ctx = {}) {
  const hinted = String(ctx.playerName || '').trim();
  if (hinted && isValidPlayerName(hinted)) return hinted;
  const beat = normalizeBeat(beatText);
  const direct = beat.match(PORTAL_NAME_RE);
  if (direct?.[1] && isValidPlayerName(direct[1].trim())) return direct[1].trim();
  const alt = beat.match(PORTAL_NAME_ALT_RE);
  if (alt?.[1] && isValidPlayerName(alt[1].trim())) return alt[1].trim();
  try {
    const copy = require('../../x-autoposter-copy');
    const fromCopy = copy.extractPlayerFromText(beat);
    if (fromCopy && isValidPlayerName(fromCopy)) return fromCopy;
  } catch {
    /* optional */
  }
  return null;
}

function extractPos(beatText = '', ctx = {}) {
  if (ctx.pos) return String(ctx.pos).trim();
  const beat = normalizeBeat(beatText);
  const m = beat.match(POS_RE);
  return m?.[1] || null;
}

function extractFormerSchool(beatText = '') {
  const beat = normalizeBeat(beatText);
  const alt = beat.match(FORMER_SCHOOL_ALT_RE);
  if (alt?.[1]) return alt[1].replace(/\s+$/, '').trim();
  const from = beat.match(FORMER_SCHOOL_RE);
  if (from?.[1]) {
    const school = from[1].replace(/\s+$/, '').trim();
    if (!/^(Florida|Gators|UF)$/i.test(school)) return school;
  }
  return null;
}

function inferPortalDirection(beatText = '', ctx = {}) {
  const hinted = String(ctx.portalEventType || '').toLowerCase();
  if (hinted && hinted !== 'general') return hinted;
  const beat = normalizeBeat(beatText);
  if (
    /\b(transfers? to|transferring to|committed to|commits to|lands at|picked up|signs with|chooses)\s+(?:florida|the gators|\buf\b)/i.test(
      beat
    )
  ) {
    return 'portal_landing';
  }
  if (
    /\b(from florida|leaving florida|florida roster|gators roster|uf roster|off the florida roster|out of gainesville)\b/i.test(
      beat
    ) &&
    /\bportal\b/i.test(beat)
  ) {
    return 'portal_out';
  }
  if (/\bportal\b/i.test(beat) && /\b(florida|gators|\buf\b)\b/i.test(beat)) return 'portal_in';
  if (/\bportal\b/i.test(beat)) return 'portal_in';
  return 'portal_in';
}

function extractPortalFacts(beatText = '', ctx = {}) {
  const beat = normalizeBeat(beatText);
  const facts = {
    beatText: beat,
    portal_type: null,
    player_name: null,
    player_slug: ctx.playerSlug || null,
    pos: null,
    former_school: null,
    uf_interest: false
  };

  if (!beat) return facts;

  facts.player_name = extractPlayerName(beat, ctx);
  facts.pos = extractPos(beat, ctx);
  facts.former_school = extractFormerSchool(beat);
  facts.portal_type = inferPortalDirection(beat, ctx);
  facts.uf_interest =
    facts.portal_type === 'portal_in' ||
    facts.portal_type === 'portal_landing' ||
    /\b(florida|gators|\buf\b)\b/i.test(beat);

  return facts;
}

function selectPortalArc(facts = {}) {
  const type = facts.portal_type || 'portal_in';
  if (type === 'portal_out') return 'portal_out';
  if (type === 'portal_landing') return 'portal_landing';
  return 'portal_in';
}

module.exports = {
  extractPortalFacts,
  selectPortalArc,
  normalizeBeat,
  extractPlayerName,
  extractFormerSchool,
  inferPortalDirection
};