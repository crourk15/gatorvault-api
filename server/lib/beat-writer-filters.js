/**
 * Beat writer filtering — national UF-only gates, momentum detection, trusted handles.
 */
const FLORIDA_URL_RE =
  /florida|gators|gator|uf\.edu|on3\.com\/teams\/florida|gatorsonline|247sports\.com\/.*florida|floridagators\.com/i;

/** National reporters — only UF-related posts pass through. */
const NATIONAL_UF_ONLY_HANDLES = new Set([
  'chadsimmons_',
  'hayesfawcett3',
  'charlespower',
  'stevewiltfong'
]);

const TRUSTED_HANDLES = new Set([
  'corey_bender',
  'blake_alderman',
  'keithniebuhr',
  'chadsimmons_',
  'hayesfawcett3',
  'ttjharden8',
  'zachabolverdi',
  'gatorsonline',
  'gatorsbreakdown',
  'jamieivins',
  'charlespower',
  'stevewiltfong',
  'grahamhall_',
  'nickdelatorregc',
  'onlygators',
  'alligatorarmy'
]);

const TRUSTED_PATTERN =
  /bender|alderman|niebuhr|simmons|fawcett|harden|abolverdi|gatorsonline|ivins|wiltfong|power|gators breakdown/i;

const MOMENTUM_KEYWORDS = [
  'trending up',
  'trend up',
  'trending',
  'heating up',
  'momentum',
  'buzz',
  'smoke',
  'chatter',
  'rising',
  'moving up'
];

const RECRUITING_SIGNAL_RE =
  /\b(recruit|commit|visit|portal|offer|flip|decommit|depth|injury|scheme|coach|transfer|verb|crystal|rpm|247|on3|quarterback|qb|signing|class|target|official|unofficial|prediction|forecast)\b/i;

const UF_COACH_STAFF_RE =
  /\b(billy napier|jon sumrall|buster faulkner|brad white|rob ashford|austin bailey|will black|juan carlos delgado|austin lehman)\b/i;

/** Other programs — block when UF is not mentioned. */
const OTHER_PROGRAM_RE =
  /\b(florida state|\bfsu\b|seminoles|\bgeorgia\b|\buga\b|bulldogs|\balabama\b|crimson tide|\bauburn\b|tigers|\blsu\b|\btennessee\b|volunteers|ole miss|mississippi state|south carolina|\bclemson\b|\bmiami\b|\bcanes\b|texas a&m|\baggies\b|ohio state|\bmichigan\b|\bnotre dame\b|\boklahoma\b|\btexas\b|\bpenn state\b)\b/i;

const NATIONAL_ROUNDUP_RE =
  /\b(top \d+|national roundup|around the country|across the sec|sec update|national recruiting|recruiting roundup)\b/i;

function isNationalUfOnlyReporter(post) {
  const handle = String(post.handle || post.writerId || '').toLowerCase();
  const writer = String(post.writerName || '');
  if (NATIONAL_UF_ONLY_HANDLES.has(handle)) return true;
  if (/chad\s*simmons|chadsimmons/i.test(writer)) return true;
  if (/hayes\s*fawcett|hayesfawcett/i.test(writer)) return true;
  if (/charles\s*power|chuck\s*power|charlespower/i.test(writer)) return true;
  if (/steve\s*wiltfong|stevewiltfong/i.test(writer)) return true;
  return false;
}

function isChadSimmonsPost(post) {
  return isNationalUfOnlyReporter(post) && /chad\s*simmons|chadsimmons/i.test(String(post.writerName || post.handle || ''));
}

function isHayesFawcettPost(post) {
  const handle = String(post.handle || post.writerId || '').toLowerCase();
  const writer = String(post.writerName || '');
  return handle === 'hayesfawcett3' || /hayes\s*fawcett|hayesfawcett/i.test(writer);
}

function isCharlesPowerPost(post) {
  const handle = String(post.handle || post.writerId || '').toLowerCase();
  const writer = String(post.writerName || '');
  return handle === 'charlespower' || /charles\s*power|chuck\s*power|charlespower/i.test(writer);
}

function isSteveWiltfongPost(post) {
  const handle = String(post.handle || post.writerId || '').toLowerCase();
  const writer = String(post.writerName || '');
  return handle === 'stevewiltfong' || /steve\s*wiltfong|stevewiltfong/i.test(writer);
}

/**
 * Hard UF relevance gate — national beat items must match Florida Gators context.
 */
function isFloridaRelevant(text) {
  const t = String(text || '');
  if (!t.trim()) return false;

  const hasUfSignal =
    /\b(florida gators|florida football|uf football|gator nation|gator football|\bgators\b|\bgator\b|\buf\b|@gatorsfb|#gators|#gatornation|the swamp|gainesville)\b/i.test(
      t
    ) ||
    UF_COACH_STAFF_RE.test(t) ||
    /\bbilly napier\b/i.test(t) ||
    /\bbrad white\b/i.test(t);

  if (hasUfSignal) return true;

  // Standalone "Florida" — not Florida State / FSU
  if (/\bflorida\b/i.test(t) && !/\bflorida state\b/i.test(t)) return true;

  return false;
}

function isFloridaRelatedUrl(url) {
  return FLORIDA_URL_RE.test(String(url || '').toLowerCase());
}

function postUrls(post) {
  const urls = [];
  if (Array.isArray(post.attachmentUrls)) urls.push(...post.attachmentUrls);
  const text = String(post.text || '');
  const fromText = text.match(/https?:\/\/[^\s]+/g) || [];
  urls.push(...fromText);
  if (post.url) urls.push(post.url);
  return urls;
}

function isFloridaRelevantPost(post) {
  const text = `${post.text || ''} ${post.summary || ''} ${post.title || ''}`;
  if (isFloridaRelevant(text)) return true;
  return postUrls(post).some(isFloridaRelatedUrl);
}

/** @deprecated use isFloridaRelevant */
function isFloridaRelatedText(text) {
  return isFloridaRelevant(text);
}

/** @deprecated use isFloridaRelevantPost */
function isFloridaRelatedPost(post) {
  return isFloridaRelevantPost(post);
}

function isHardBlockedNonUfContent(text) {
  const t = String(text || '');
  if (isFloridaRelevant(t)) return false;
  if (OTHER_PROGRAM_RE.test(t) && RECRUITING_SIGNAL_RE.test(t)) return true;
  if (NATIONAL_ROUNDUP_RE.test(t)) return true;
  if (/\b(commits? to|committed to|flips? to|pledges? to|signs? with)\b/i.test(t) && OTHER_PROGRAM_RE.test(t)) {
    return true;
  }
  return false;
}

function shouldIncludeBeatPost(post, options = {}) {
  const onBlock = typeof options.onBlock === 'function' ? options.onBlock : null;
  const text = `${post.text || ''} ${post.summary || ''} ${post.title || ''}`;

  if (isHardBlockedNonUfContent(text)) {
    if (onBlock) onBlock(post, 'hard_block_non_uf');
    return false;
  }

  if (isNationalUfOnlyReporter(post)) {
    if (!isFloridaRelevantPost(post)) {
      if (onBlock) onBlock(post, 'non_florida');
      return false;
    }
  }

  return true;
}

function isTrustedBeatWriter(post) {
  const handle = String(post.handle || '').toLowerCase();
  const writer = String(post.writerName || '');
  return TRUSTED_HANDLES.has(handle) || TRUSTED_PATTERN.test(writer) || TRUSTED_PATTERN.test(handle);
}

function hasMomentumSignal(text) {
  const lower = String(text || '').toLowerCase();
  return MOMENTUM_KEYWORDS.some((kw) => lower.includes(kw));
}

function detectRecruitingMomentum(text) {
  if (!hasMomentumSignal(text)) return false;
  if (!isFloridaRelevant(text) && !RECRUITING_SIGNAL_RE.test(text)) return false;
  return true;
}

function extractPlayerFromText(text) {
  return require('./x-autoposter-copy').extractPlayerFromText(text);
}

function isGeneralBeatCommentary(text) {
  return require('./x-autoposter-copy').isGeneralBeatCommentary(text);
}

function hasPlayerSpecificBeatIntel(text) {
  return require('./x-autoposter-copy').hasPlayerSpecificIntel(text);
}

function matchesGatorFootballIntel(text) {
  const lower = String(text || '').toLowerCase();
  if (!isFloridaRelevant(text)) return false;
  return RECRUITING_SIGNAL_RE.test(lower) || /\b(game|kickoff|swamp|sumrall|faulkner|white|spring|fall camp|depth chart|roster|sec)\b/i.test(lower);
}

module.exports = {
  FLORIDA_URL_RE,
  MOMENTUM_KEYWORDS,
  NATIONAL_UF_ONLY_HANDLES,
  isNationalUfOnlyReporter,
  isChadSimmonsPost,
  isHayesFawcettPost,
  isCharlesPowerPost,
  isSteveWiltfongPost,
  isFloridaRelevant,
  isFloridaRelevantPost,
  isFloridaRelatedText,
  isFloridaRelatedPost,
  isHardBlockedNonUfContent,
  shouldIncludeBeatPost,
  isTrustedBeatWriter,
  detectRecruitingMomentum,
  extractPlayerFromText,
  isGeneralBeatCommentary,
  hasPlayerSpecificBeatIntel,
  matchesGatorFootballIntel
};
