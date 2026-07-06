/**
 * Recruiting narrative fact extraction — trust, contender, relationship, quotes.
 */
const { isValidPlayerName } = require('../../x-autoposter-player-context');
const { isRetrospectiveOfferBeat, hasOfferLanguage } = require('../recruiting-offer-disambiguation');

const NARRATIVE_SIGNAL_RES = [
  { type: 'trust', re: /\b(build(?:ing)?\s+trust|trustworthy|honest(?:y)?|transparen|straight\s+talk|integrity|resonating)\b/i },
  { type: 'authenticity', re: /\b(authentic|genuine|real\s+talk|down\s+to\s+earth)\b/i },
  { type: 'contender', re: /\b(major\s+contender|cementing|in\s+the\s+mix|top\s+choice|legit\s+shot|real\s+chance|cementing\s+themselves)\b/i },
  { type: 'relationship', re: /\b(relationship\s+with|bond|connection|family\s+atmosphere|feels\s+like\s+home)\b/i },
  { type: 'program_pitch', re: /\b(development\s+path|scheme\s+fit|program\s+culture|coach(?:ing)?\s+staff|player\s+development)\b/i }
];

const POS_RE = /\b(QB|RB|WR|TE|OL|OT|OG|C|DL|DE|EDGE|LB|CB|S|ATH|K|P)\b/;
const STARS_RE = /\b([1-5])-star\b/i;
const CLASS_RE = /\b(?:Class of )?(20\d{2})\b/;

function normalizeBeat(beatText = '') {
  return String(beatText || '').replace(/\s+/g, ' ').trim();
}

function extractQuote(beatText = '') {
  const beat = normalizeBeat(beatText);
  const m = beat.match(/['"]([^'"]{8,140})['"]/);
  return m?.[1]?.trim() || null;
}

function detectNarrativeTypes(beatText = '') {
  const beat = normalizeBeat(beatText);
  const types = [];
  for (const item of NARRATIVE_SIGNAL_RES) {
    if (item.re.test(beat)) types.push(item.type);
  }
  return types;
}

function hasNarrativeSignals(beatText = '') {
  return detectNarrativeTypes(beatText).length > 0 || !!extractQuote(beatText);
}

function extractPlayerName(beatText = '', ctx = {}) {
  ctx = ctx || {};
  const hinted = String(ctx.playerName || '').trim();
  if (hinted && isValidPlayerName(hinted)) return hinted;
  const beat = normalizeBeat(beatText);
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
  ctx = ctx || {};
  if (ctx.pos) return String(ctx.pos).trim();
  const beat = normalizeBeat(beatText);
  const m = beat.match(POS_RE);
  return m?.[1] || null;
}

function extractStars(beatText = '') {
  const beat = normalizeBeat(beatText);
  const m = beat.match(STARS_RE);
  return m ? parseInt(m[1], 10) : null;
}

function extractClassYear(beatText = '') {
  const beat = normalizeBeat(beatText);
  const m = beat.match(CLASS_RE);
  return m ? parseInt(m[1], 10) : null;
}

function narrativeStrength(beatText = '', types = []) {
  let score = types.length;
  if (extractQuote(beatText)) score += 2;
  if (isRetrospectiveOfferBeat(beatText)) score += 1;
  return score;
}

function selectNarrativeArc(facts = {}) {
  const types = facts.narrative_types || [];
  if (types.includes('trust') || facts.quote) return 'trust';
  if (types.includes('contender')) return 'contender';
  if (types.includes('relationship')) return 'relationship';
  if (types.includes('program_pitch')) return 'program_pitch';
  if (types.includes('authenticity')) return 'trust';
  return 'contender';
}

function extractNarrativeFacts(beatText = '', ctx = {}) {
  ctx = ctx || {};
  const beat = normalizeBeat(beatText);
  const narrative_types = detectNarrativeTypes(beat);
  const quote = extractQuote(beat);
  const player_name = extractPlayerName(beat, ctx);
  const has_retrospective_offer = isRetrospectiveOfferBeat(beat);
  return {
    player_name,
    player_slug: ctx.playerSlug || null,
    pos: extractPos(beat, ctx),
    stars: extractStars(beat),
    class_year: extractClassYear(beat),
    quote,
    narrative_types,
    narrative_strength: narrativeStrength(beat, narrative_types),
    has_retrospective_offer,
    has_offer_language: hasOfferLanguage(beat)
  };
}

module.exports = {
  NARRATIVE_SIGNAL_RES,
  normalizeBeat,
  extractQuote,
  detectNarrativeTypes,
  hasNarrativeSignals,
  extractPlayerName,
  extractNarrativeFacts,
  selectNarrativeArc,
  narrativeStrength
};