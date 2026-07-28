/**
 * Retrospective vs fresh offer detection — shared by ingest and copy resolvers.
 */
const RETROSPECTIVE_TIME_RE =
  /\b(?:in\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|spring|summer|fall|winter)|months?\s+(?:later|ago|earlier)|years?\s+ago|last\s+(?:year|season|spring|summer|fall|winter|month|week)|previously|earlier|back\s+in|a\s+while\s+ago)\b/i;

const FRESH_OFFER_RE =
  /\b(?:today|this\s+(?:morning|afternoon|evening|week|weekend)|just\s+(?:offered|got|received)|new\s+offer|re-?offered|sources?\s+confirm(?:s|ed)?\s+(?:the\s+)?offer|broke\s+the\s+news|per\s+(?:the\s+)?(?:beat|report).*offer|(?:has|have)\s+offered)\b/i;

/** Present announcement of a UF offer (not a months-later quote about an old offer). */
const ACTIVE_OFFER_ANNOUNCE_RE =
  /\b(?:has|have)\s+offered\b|\b(?:florida|the\s+gators|gators|\buf\b)\s+(?:have\s+|has\s+)?offered\b|\boffered\s+(?:a\s+)?(?:scholarship\s+to\s+)?(?:an?\s+)?(?:\d+-star\s+)?(?:[A-Z]{1,5}\s+)?[A-Z][a-zA-Z'.-]+/i;

const NARRATIVE_PIVOT_RE =
  /\b(?:months?\s+later|now\s+says|says\s+the\s+gators|told\s+(?:reporters|us)|said\s+(?:that|the)|cementing|resonating|build(?:ing)?\s+trust|major\s+contender)\b/i;

function normalizeBeat(beatText = '') {
  return String(beatText || '').replace(/\s+/g, ' ').trim();
}

function hasOfferLanguage(beatText = '') {
  return /\boffer(?:ed|s)?\b/i.test(normalizeBeat(beatText));
}

function isRetrospectiveOfferBeat(beatText = '') {
  const beat = normalizeBeat(beatText);
  if (!hasOfferLanguage(beat)) return false;
  if (FRESH_OFFER_RE.test(beat)) return false;
  // "Florida has offered X… relationship with Coach Y" is a FRESH offer, not a retrospective narrative.
  // Only keep retrospective when explicit time-ago language is present.
  if (ACTIVE_OFFER_ANNOUNCE_RE.test(beat) && !RETROSPECTIVE_TIME_RE.test(beat)) {
    return false;
  }
  if (RETROSPECTIVE_TIME_RE.test(beat)) return true;
  if (NARRATIVE_PIVOT_RE.test(beat) && /\boffer(?:ed|s)?\b/i.test(beat)) return true;
  return false;
}

function isFreshOfferBeat(beatText = '') {
  const beat = normalizeBeat(beatText);
  if (!hasOfferLanguage(beat)) return false;
  if (isRetrospectiveOfferBeat(beat)) return false;
  return true;
}

module.exports = {
  RETROSPECTIVE_TIME_RE,
  FRESH_OFFER_RE,
  ACTIVE_OFFER_ANNOUNCE_RE,
  NARRATIVE_PIVOT_RE,
  isRetrospectiveOfferBeat,
  isFreshOfferBeat,
  hasOfferLanguage,
  normalizeBeat
};
