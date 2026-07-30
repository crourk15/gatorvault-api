/**
 * Beat writer filtering — national UF-only gates, momentum detection, trusted handles.
 */
/** Florida URL gate — keep specific; bare "gator" matched "aggregator" and leaked national posts. */
const FLORIDA_URL_RE =
  /(?:\bflorida\b|\bgators\b|gator\s?nation|gatorsfb|gatorsonline|gatorsterritory|insidethegators|floridagators|onlygators|alligatorarmy|gatorvault|gatorvaultinsider|uf\.edu|on3\.com\/teams\/florida|247sports\.com\/[^?\s]*florida)/i;

/** Own brand — show on GNL Live, never feed back into recruiting ingest (echo loop). */
const BRAND_LIVE_FEED_HANDLES = new Set(['gatorvault']);

/** National reporters — only UF-related posts pass through. */
const NATIONAL_UF_ONLY_HANDLES = new Set([
  'chadsimmons_',
  'hayesfawcett3',
  'charlespower',
  'stevewiltfong'
]);

/** Multi-program / aggregate feeds — require UF context or a locked UF target name. */
const REQUIRES_UF_CONTEXT_HANDLES = new Set([
  ...NATIONAL_UF_ONLY_HANDLES,
  'ejhollandon3',
  'on3recruits',
  'rivalsportal'
]);

/** Primary beat writers for rival programs — blocked unless UF is also mentioned. */
const OTHER_PROGRAM_REPORTER_HANDLES = new Set([
  'andyhaggard',
  'stateoftheu',
  'caneswatch',
  'tomahawknation',
  'noles247',
  'dawgsports',
  'georgiadogs',
  'bamainsider',
  'rolltide',
  'lsufootball',
  'volswire',
  'gamecocksonline'
]);

const UF_OFFICIAL_HANDLES = new Set([
  'gatorsfb',
  'floridagators',
  'ufootball',
  'uf_football',
  'floridafootball',
  'gatorfootball',
  'ufathletics'
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
  'andrew_ivins',
  'jamieivins',
  'charlespower',
  'stevewiltfong',
  'grahamhall_',
  'nickdelatorregc',
  'thomasgoldkamp',
  'onlygators',
  'alligatorarmy',
  'ejhollandon3',
  'on3recruits',
  'rivalsportal',
  'gatorsterritory',
  'insidethegators',
  'gatorvault'
]);

/** All beat writers polled for recruiting ingest (lowercase handles). */
const BEAT_RECRUITING_INGEST_HANDLES = new Set(
  [...TRUSTED_HANDLES, 'keithniebuhr', 'nickdelatorregc', 'thomasgoldkamp'].filter(
    (handle) => !BRAND_LIVE_FEED_HANDLES.has(handle)
  )
);

const TRUSTED_PATTERN =
  /bender|alderman|niebuhr|simmons|fawcett|harden|abolverdi|gatorsonline|ivins|wiltfong|power|gators breakdown|gatorsterritory|insidethegators|on3recruits|rivalsportal|gatorvault/i;

function isBrandLiveFeedAccount(post) {
  const handle = String(post?.handle || post?.writerId || '')
    .toLowerCase()
    .replace(/^@/, '');
  return BRAND_LIVE_FEED_HANDLES.has(handle);
}

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
  /\b(florida state|\bfsu\b|seminoles|\bgeorgia\b|\buga\b|bulldogs|\balabama\b|crimson tide|\bauburn\b|\blsu\b|\btennessee\b|volunteers|ole miss|mississippi state|south carolina|\bclemson\b|\bmiami\b|\bcanes\b|\bhurricanes\b|texas a&m|\baggies\b|ohio state|\bmichigan\b|\bnotre dame\b|\boklahoma\b|\btexas longhorns\b|\bpenn state\b)\b/i;

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

/** Explicit UF keyword gate — required for Steve Wiltfong national posts. */
const EXPLICIT_UF_KEYWORD_RES = [
  /\bflorida\b/i,
  /\bgators\b/i,
  /\buf\b/i,
  /\bgainesville\b/i,
  /\bbilly napier\b/i,
  /\buf staff\b/i,
  /\bflorida visit\b/i,
  /\bflorida commit\b/i,
  /\bflorida target\b/i
];

function matchesExplicitUfKeywords(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (/\bflorida state\b/i.test(t) && !/\bflorida gators\b/i.test(t) && !/\bflorida football\b/i.test(t)) {
    if (!/\bgators\b/i.test(t) && !/\buf\b/i.test(t)) return false;
  }
  return EXPLICIT_UF_KEYWORD_RES.some((re) => re.test(t));
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

function normalizeHandle(post) {
  return String(post?.handle || post?.writerId || '').toLowerCase().replace(/^@/, '');
}

function isUfOfficialAccount(post) {
  const handle = normalizeHandle(post);
  if (UF_OFFICIAL_HANDLES.has(handle)) return true;
  const outlet = String(post?.outlet || post?.writerName || '').toLowerCase();
  return /\buf official\b|florida gators football\b|@gatorsfb\b/i.test(outlet);
}

function isOtherProgramReporter(post) {
  const handle = normalizeHandle(post);
  if (OTHER_PROGRAM_REPORTER_HANDLES.has(handle)) return true;
  const outlet = String(post?.outlet || post?.writerName || '').toLowerCase();
  return /\bmiami\b|\bcanes\b|\bseminoles\b|\bfsu\b|\bbulldogs\b|\bcrimson tide\b|\broll tide\b|\blsu tigers\b/i.test(
    outlet
  );
}

function requiresUfContextReporter(post) {
  const handle = normalizeHandle(post);
  return REQUIRES_UF_CONTEXT_HANDLES.has(handle) || isOtherProgramReporter(post);
}

function mentionsOtherProgram(text) {
  return OTHER_PROGRAM_RE.test(String(text || ''));
}

function hasUfContextInText(text, post = null) {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (isFloridaRelevant(t)) return true;
  if (matchesUfTargetNameInText(t)) return true;
  if (/"[^"]*(?:florida|gators|\buf\b|gainesville|the swamp)[^"]*"/i.test(t)) return true;
  if (/'[^']*(?:florida|gators|\buf\b|gainesville|the swamp)[^']*'/i.test(t)) return true;
  if (post && postUrls(post).some(isFloridaRelatedUrl)) return true;
  return t
    .split(/[.!?]+/)
    .some((sentence) => isFloridaRelevant(sentence) || matchesUfTargetNameInText(sentence));
}

function mentionsOtherProgramWithoutUf(text, post = null) {
  const t = String(text || '');
  if (!mentionsOtherProgram(t)) return false;
  return !hasUfContextInText(t, post);
}

function hasUfIngestContext(post, text) {
  return isFloridaRelevantPost(post) || hasUfContextInText(text, post);
}

let _ufTargetNamePatterns = null;

function getUfTargetNamePatterns() {
  if (_ufTargetNamePatterns) return _ufTargetNamePatterns;
  let names = [];
  try {
    const allowlist = require('./recruiting-target-allowlist');
    names = Object.values(allowlist.getMergedCanonicalNames?.() || allowlist.CANONICAL_TARGET_NAMES || {});
  } catch {
    names = [];
  }
  _ufTargetNamePatterns = names
    .map((name) => String(name || '').trim())
    .filter((name) => name.length >= 5)
    .map((name) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'));
  return _ufTargetNamePatterns;
}

function matchesUfTargetNameInText(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  return getUfTargetNamePatterns().some((re) => re.test(t));
}

function strictUfOnlyBlockReason(post, text) {
  if (
    (requiresUfContextReporter(post) || isNationalUfOnlyReporter(post) || isSteveWiltfongPost(post)) &&
    !hasExplicitUfReporterContext(post, text)
  ) {
    return isSteveWiltfongPost(post) ? 'wiltfong_non_uf_keywords' : 'national_missing_explicit_uf';
  }
  if (isOtherProgramReporter(post) && !hasUfIngestContext(post, text)) return 'rival_program_reporter';
  if (mentionsOtherProgramWithoutUf(text, post)) return 'other_program_without_uf';
  if (!hasUfIngestContext(post, text)) return 'missing_uf_context';
  if (hasUfIngestContext(post, text) && !isUfFootballEligible(post, text)) return 'non_football_sport';
  return 'hard_block_non_uf';
}

function isHardBlockedNonUfContent(text, post = null) {
  const t = String(text || '');
  if (isFloridaRelevant(t)) return false;
  if (mentionsOtherProgramWithoutUf(t, post)) return true;
  if (NATIONAL_ROUNDUP_RE.test(t)) return true;
  if (/\b(commits? to|committed to|flips? to|pledges? to|signs? with)\b/i.test(t) && OTHER_PROGRAM_RE.test(t)) {
    return true;
  }
  return false;
}

function isUfFootballEligible(post, text) {
  const body = `${text || ''} ${post?.summary || ''} ${post?.title || ''}`.trim();
  if (!body) return false;
  try {
    const sportClassifier = require('./x-autoposter-sport-classifier');
    return sportClassifier.isFootballAutoposterEligible(body, post);
  } catch {
    // Classifier missing — fall back to football keyword heuristic
    return matchesGatorFootballIntel(body) || /\b(football|recruit|commit|qb|wr|rb|portal|sumrall|napier)\b/i.test(body);
  }
}

/**
 * National / multi-program reporters must mention UF explicitly (or link a Florida URL).
 * Allowlisted recruit names alone are not enough — that leaked national commitment chatter
 * (e.g. Chad Simmons on Trace Hawkins) into Live Stream.
 */
function hasExplicitUfReporterContext(post, text) {
  const body = `${text || ''} ${post?.summary || ''} ${post?.title || ''}`.trim();
  if (!body) return false;
  if (matchesExplicitUfKeywords(body)) return true;
  if (postUrls(post).some(isFloridaRelatedUrl)) return true;
  return false;
}

/** Strict UF football-only gate for beat ingest + Movement Intel surfacing. */
function passesStrictUfOnlyFilter(post, text) {
  const body = `${text || ''} ${post?.summary || ''} ${post?.title || ''}`.trim();
  if (!body) return false;

  if (isUfOfficialAccount(post) && isFloridaRelevant(body)) {
    return isUfFootballEligible(post, body);
  }
  if (isHardBlockedNonUfContent(body, post)) return false;
  if (mentionsOtherProgramWithoutUf(body, post)) return false;

  // National + multi-program handles: UF keywords/URL required (not target-name-only).
  if (requiresUfContextReporter(post) || isNationalUfOnlyReporter(post)) {
    if (!hasExplicitUfReporterContext(post, body)) return false;
    return isUfFootballEligible(post, body);
  }

  if (!hasUfIngestContext(post, body)) return false;
  return isUfFootballEligible(post, body);
}

function shouldIncludeBeatPost(post, options = {}) {
  const onBlock = typeof options.onBlock === 'function' ? options.onBlock : null;
  const text = `${post.text || ''} ${post.summary || ''} ${post.title || ''}`;

  if (!passesStrictUfOnlyFilter(post, text)) {
    if (onBlock) onBlock(post, strictUfOnlyBlockReason(post, text));
    return false;
  }

  return true;
}

function filterUfOnlyIntelRows(rows) {
  return (rows || []).filter((row) => {
    const detail = String(row?.detail || row?.text || row?.summary || '');
    if (!detail.trim()) return false;
    const post = {
      handle: row?.sourceHandle || row?.source_handle || null,
      text: detail,
    };
    return passesStrictUfOnlyFilter(post, detail);
  });
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

const TRUSTED_COMMIT_HANDLE_RES =
  /^(?:hayesfawcett3|chadsimmons_|corey_bender|gatorsonline|stevewiltfong|charlespower)$/i;

const FL_COMMIT_RES = [
  /\b(?:has\s+)?(?:committed|commits|verbally committed|pledged|pledges)\s+to\s+(?:the\s+)?(?:florida|gators|\buf\b)\b/i,
  /\b(?:flips?|flipped)\s+to\s+(?:the\s+)?(?:florida|gators|\buf\b)\b/i,
  /\b(?:florida|gators|\buf\b)\s+has\s+(?:landed|secured|added|picked up|got)\s+(?:a\s+)?commit(?:ment)?\s+from\b/i,
  /\b(?:florida|gators|\buf\b)\s+(?:lands?|landed|secures?|secured|adds?|added)\s+(?:a\s+)?commit(?:ment)?\s+from\b/i,
  /\bbreaking:\s*(?:florida|gators|\buf\b)\s+has\s+landed\s+a\s+commit(?:ment)?\s+from\b/i
];

const DECOMMIT_RES = [
  /\bdecommit(?:ted|s|ment)?\b/i,
  /\bflipped?\s+away\s+from\s+(?:the\s+)?(?:florida|gators|\buf\b)\b/i,
  /\b(?:opened|reopened)\s+(?:his|her|their)\s+recruitment\b/i
];

const RUMOR_ONLY_RES = [
  /\b(?:expected to commit|leaning toward|will commit|decision soon|commitment watch)\b/i
];

function normalizeCommitText(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function mentionsFloridaCommit(text = '') {
  return /\b(?:florida|gators|\buf\b|gator nation)\b/i.test(text);
}

function isFloridaDecommitBeat(text = '') {
  const t = normalizeCommitText(text);
  if (!t) return false;
  return DECOMMIT_RES.some((re) => re.test(t)) && mentionsFloridaCommit(t);
}

function isFloridaCommitBeat(text = '') {
  const t = normalizeCommitText(text);
  if (!t || !mentionsFloridaCommit(t)) return false;
  if (isFloridaDecommitBeat(t)) return false;
  const explicit = FL_COMMIT_RES.some((re) => re.test(t));
  if (!explicit) return false;
  if (RUMOR_ONLY_RES.some((re) => re.test(t)) && !/\b(?:has|have)\s+(?:committed|landed)\b/i.test(t)) {
    return false;
  }
  return true;
}

function resolveCommitEventType(text = '') {
  if (!isFloridaCommitBeat(text)) return null;
  if (/\bflip(?:ped)?\s+to\s+(?:the\s+)?(?:florida|gators|\buf\b)\b/i.test(text)) return 'flip';
  return 'commit';
}

function isTrustedCommitHandle(handle = '') {
  return TRUSTED_COMMIT_HANDLE_RES.test(String(handle || '').trim().toLowerCase());
}

function isCommitLikeSignal({ text = '', eventType = '', newsEvent = '' } = {}) {
  const et = String(eventType || '').toLowerCase();
  if (et === 'commit' || et === 'commitment' || et === 'flip') return true;
  const ne = String(newsEvent || '').toLowerCase();
  if (/committed to florida|flipped to florida/.test(ne)) return true;
  return isFloridaCommitBeat(text);
}

function extractCommitQuote(text = '') {
  const t = normalizeCommitText(text);
  const curly = t.match(/[\u201c]([^\u201d]{8,220})[\u201d]/);
  if (curly?.[1]) return curly[1].trim();
  const spoken = t.match(/(?:said|tells me)[,:]?\s+[\u201c"]?([^\u201d".]{8,180})/i);
  if (spoken?.[1]) return spoken[1].trim();
  const straightAll = [...t.matchAll(/"([^"]{8,220})"/g)];
  for (let i = straightAll.length - 1; i >= 0; i--) {
    const q = straightAll[i][1].trim();
    if (/^\d/.test(q) && /\b(?:CB|RB|WR|TE|OL|QB|DL|LB|EDGE|S|ATH|K|P)\b/.test(q)) continue;
    if (q.length >= 8) return q;
  }
  return null;
}

module.exports = {
  FLORIDA_URL_RE,
  MOMENTUM_KEYWORDS,
  NATIONAL_UF_ONLY_HANDLES,
  REQUIRES_UF_CONTEXT_HANDLES,
  OTHER_PROGRAM_REPORTER_HANDLES,
  UF_OFFICIAL_HANDLES,
  BRAND_LIVE_FEED_HANDLES,
  TRUSTED_HANDLES,
  BEAT_RECRUITING_INGEST_HANDLES,
  isBrandLiveFeedAccount,
  isNationalUfOnlyReporter,
  isOtherProgramReporter,
  requiresUfContextReporter,
  isUfOfficialAccount,
  isChadSimmonsPost,
  isHayesFawcettPost,
  isCharlesPowerPost,
  isSteveWiltfongPost,
  matchesExplicitUfKeywords,
  EXPLICIT_UF_KEYWORD_RES,
  isFloridaRelevant,
  isFloridaRelevantPost,
  postUrls,
  isFloridaRelatedUrl,
  isFloridaRelatedText,
  isFloridaRelatedPost,
  mentionsOtherProgram,
  mentionsOtherProgramWithoutUf,
  hasUfContextInText,
  matchesUfTargetNameInText,
  hasUfIngestContext,
  hasExplicitUfReporterContext,
  passesStrictUfOnlyFilter,
  isUfFootballEligible,
  strictUfOnlyBlockReason,
  filterUfOnlyIntelRows,
  isHardBlockedNonUfContent,
  shouldIncludeBeatPost,
  isTrustedBeatWriter,
  detectRecruitingMomentum,
  extractPlayerFromText,
  isGeneralBeatCommentary,
  hasPlayerSpecificBeatIntel,
  matchesGatorFootballIntel,
  FL_COMMIT_RES,
  TRUSTED_COMMIT_HANDLE_RES,
  isFloridaCommitBeat,
  isFloridaDecommitBeat,
  resolveCommitEventType,
  isTrustedCommitHandle,
  isCommitLikeSignal,
  extractCommitQuote
};
