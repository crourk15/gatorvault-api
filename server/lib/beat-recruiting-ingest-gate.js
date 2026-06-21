/**
 * Strict beat-writer recruiting ingest gate — ALL rules must pass or the post is dropped.
 *
 * 1. Allowed account (UF beat writers + UF official)
 * 2. Football signal in text
 * 3. Recruiting signal in text
 * 4. Class year 2027+ in text
 * 5. UF mention in text
 * 6. Player first + last name in text
 */
const beatFilters = require('./beat-writer-filters');

/** UF official program accounts (lowercase handles). */
const UF_OFFICIAL_HANDLES = new Set([
  'gatorsfb',
  'floridagators',
  'ufootball',
  'uf_football',
  'floridafootball',
  'gatorfootball',
  'ufathletics',
]);

const FOOTBALL_TERMS = [
  'football',
  'gators',
  'uf',
  'florida',
  'billy napier',
  'commit',
  'recruit',
  '4-star',
  '5-star',
  'qb',
  'wr',
  'dl',
  'ol',
  'cb',
  's',
  'ath',
];

const RECRUITING_TERMS = [
  'commit',
  'commitment',
  'pledge',
  'flips',
  'flip',
  'visits',
  'visit',
  'ov',
  'official visit',
  'recruiting',
  'offer',
  'top schools',
  'top 5',
  'top 10',
];

const CLASS_YEAR_RE = /20(27|28|29|30|31|32)/;
const UF_MENTION_RE = /(Florida|UF|Gators|GatorNation|Gator)/i;
const PLAYER_NAME_RE = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/;

function normalizeHandle(post) {
  return String(post?.handle || post?.writerId || '').toLowerCase().replace(/^@/, '');
}

function isUfOfficialAccount(post) {
  const handle = normalizeHandle(post);
  if (UF_OFFICIAL_HANDLES.has(handle)) return true;
  const outlet = String(post?.outlet || post?.writerName || '').toLowerCase();
  return /\buf official\b|florida gators football\b|@gatorsfb\b/i.test(outlet);
}

/** Rule 1 — beat writers + UF official accounts only. */
function isAllowedIngestAccount(post) {
  if (isUfOfficialAccount(post)) return true;
  const handle = normalizeHandle(post);
  if (beatFilters.BEAT_RECRUITING_INGEST_HANDLES?.has(handle)) return true;
  if (beatFilters.TRUSTED_HANDLES?.has(handle)) return true;
  return beatFilters.isTrustedBeatWriter?.(post) === true;
}

function postText(post, text) {
  return String(text ?? post?.text ?? post?.summary ?? post?.title ?? '').trim();
}

function matchesFootball(text) {
  const hay = text.toLowerCase();
  return FOOTBALL_TERMS.some((term) => hay.includes(term));
}

function matchesRecruiting(text) {
  const hay = text.toLowerCase();
  return RECRUITING_TERMS.some((term) => hay.includes(term));
}

function matchesClassYear(text) {
  return CLASS_YEAR_RE.test(text);
}

function matchesUfMention(text) {
  return UF_MENTION_RE.test(text);
}

function matchesPlayerName(text) {
  return PLAYER_NAME_RE.test(text);
}

/**
 * Evaluate all ingest rules. Returns { pass: true } or { pass: false, reason, failedRule }.
 */
function evaluateStrictRecruitingIngestGate(post, text) {
  const body = postText(post, text);
  if (!body) {
    return { pass: false, reason: 'empty_text', failedRule: 0 };
  }
  if (!isAllowedIngestAccount(post)) {
    return { pass: false, reason: 'disallowed_account', failedRule: 1 };
  }
  if (!matchesFootball(body)) {
    return { pass: false, reason: 'no_football_signal', failedRule: 2 };
  }
  if (!matchesRecruiting(body)) {
    return { pass: false, reason: 'no_recruiting_signal', failedRule: 3 };
  }
  if (!matchesClassYear(body)) {
    return { pass: false, reason: 'class_year_below_2027', failedRule: 4 };
  }
  if (!matchesUfMention(body)) {
    return { pass: false, reason: 'no_uf_mention', failedRule: 5 };
  }
  if (!matchesPlayerName(body)) {
    return { pass: false, reason: 'no_player_name', failedRule: 6 };
  }
  return { pass: true, reason: 'ok' };
}

function passesStrictRecruitingIngestGate(post, text) {
  return evaluateStrictRecruitingIngestGate(post, text).pass;
}

module.exports = {
  UF_OFFICIAL_HANDLES,
  FOOTBALL_TERMS,
  RECRUITING_TERMS,
  CLASS_YEAR_RE,
  UF_MENTION_RE,
  PLAYER_NAME_RE,
  isUfOfficialAccount,
  isAllowedIngestAccount,
  matchesFootball,
  matchesRecruiting,
  matchesClassYear,
  matchesUfMention,
  matchesPlayerName,
  evaluateStrictRecruitingIngestGate,
  passesStrictRecruitingIngestGate,
};
