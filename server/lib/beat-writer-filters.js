/**
 * Beat writer filtering — Chad Simmons Florida-only gate, momentum detection, trusted handles.
 */
const FLORIDA_TEXT_RE =
  /\b(florida|gators|gator nation|gainesville|\buf\b|#gators|#gatornation|@gatorsfb|florida gators)\b/i;

const FLORIDA_URL_RE =
  /florida|gators|gator|uf\.edu|on3\.com\/teams\/florida|gatorsonline|247sports\.com\/.*florida|floridagators\.com/i;

/** National reporters — only UF-related posts pass through. */
const NATIONAL_UF_ONLY_HANDLES = new Set(['chadsimmons_', 'hayesfawcett3']);

const CHAD_SIMMONS_HANDLES = NATIONAL_UF_ONLY_HANDLES;

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

function isNationalUfOnlyReporter(post) {
  const handle = String(post.handle || post.writerId || '').toLowerCase();
  const writer = String(post.writerName || '');
  if (NATIONAL_UF_ONLY_HANDLES.has(handle)) return true;
  if (/chad\s*simmons|chadsimmons/i.test(writer)) return true;
  if (/hayes\s*fawcett|hayesfawcett/i.test(writer)) return true;
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

function isFloridaRelatedText(text) {
  return FLORIDA_TEXT_RE.test(String(text || ''));
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

function isFloridaRelatedPost(post) {
  const text = `${post.text || ''} ${post.summary || ''}`;
  if (isFloridaRelatedText(text)) return true;
  return postUrls(post).some(isFloridaRelatedUrl);
}

/** National reporters (Chad Simmons, Hayes Fawcett) — only UF-related posts pass through. */
function shouldIncludeBeatPost(post) {
  if (isNationalUfOnlyReporter(post) && !isFloridaRelatedPost(post)) return false;
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
  if (!isFloridaRelatedText(text) && !RECRUITING_SIGNAL_RE.test(text)) return false;
  return true;
}

function extractPlayerFromText(text) {
  const t = String(text || '');
  const m = t.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})(?:\s+(?:Jr\.|III|II|IV))?\b/);
  return m ? m[1].trim() : null;
}

function matchesGatorFootballIntel(text) {
  const lower = String(text || '').toLowerCase();
  if (!isFloridaRelatedText(text)) return false;
  return RECRUITING_SIGNAL_RE.test(lower) || /\b(game|kickoff|swamp|sumrall|faulkner|white|spring|fall camp|depth chart|roster|sec)\b/i.test(lower);
}

module.exports = {
  FLORIDA_TEXT_RE,
  MOMENTUM_KEYWORDS,
  NATIONAL_UF_ONLY_HANDLES,
  isNationalUfOnlyReporter,
  isChadSimmonsPost,
  isHayesFawcettPost,
  isFloridaRelatedText,
  isFloridaRelatedPost,
  shouldIncludeBeatPost,
  isTrustedBeatWriter,
  detectRecruitingMomentum,
  extractPlayerFromText,
  matchesGatorFootballIntel
};
