/**
 * Strict beat-writer recruiting ingest gate — ALL rules must pass or the post is dropped.
 *
 * 1. Allowed account (UF beat writers + UF official)
 * 2. Football signal in text
 * 3. Recruiting signal in text
 * 4. Class year 2027–2028 in scope (2026 and earlier blocked; 2029+ blocked unless override; missing year allowed)
 * 5. UF mention or locked UF target name in text
 * 6. Player first + last name in text (regex + extractor + roster sync)
 * 7. No rival-program mention without UF context
 */
const fs = require('fs');
const path = require('path');
const beatFilters = require('./beat-writer-filters');
const { extractPlayerFromText, extractAllPlayerNameCandidates } = require('./x-autoposter-copy');
const { isValidPlayerName } = require('./x-autoposter-player-context');
const { slugify } = require('./slug');

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
  'top-100',
  'top 100',
  'prospect',
  'pushing hard',
  'in the building',
  'connection in the building',
  'gainesville',
  'target',
  'targets',
  'priority',
  'intel',
  '4-star',
  '5-star',
  'star wr',
  'star qb',
  'interior ol',
  'official',
  'unofficial',
  'prediction',
  'futurecast',
  'rpm',
  'prediction machine',
  'top remaining',
  'decision date',
  'flip target',
  'recruitment',
  'recruited',
  'the swamp',
  'friday night lights',
  'fnl',
];

const CLASS_YEAR_RE = /20(?:28|29|30|31|32)/;
const PLAYER_NAME_RE = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z'-]+){1,2}(?:\s+(?:Jr\.?|Sr\.?|II|III|IV|V))?\b/;

const PLAYERS_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'players.json');
const FUZZY_THRESHOLD = 0.82;
let rosterCache = null;
let rosterCacheAt = 0;

function loadRosterPlayers() {
  if (rosterCache && Date.now() - rosterCacheAt < 60_000) return rosterCache;
  try {
    const raw = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf8'));
    rosterCache = Array.isArray(raw) ? raw : raw.players || Object.values(raw.players || raw) || [];
  } catch {
    rosterCache = [];
  }
  rosterCacheAt = Date.now();
  return rosterCache;
}

function nameSimilarity(a, b) {
  const postSpec = require('./x-autoposter-post-spec');
  return Math.max(postSpec.textSimilarity(a, b), postSpec.jaccardSimilarity(a, b));
}

function matchRosterByName(name) {
  const key = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!key) return null;
  const players = loadRosterPlayers();
  const exact = players.find((p) => String(p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '') === key);
  if (exact) return exact;
  let best = null;
  let bestScore = 0;
  for (const p of players) {
    const score = nameSimilarity(name, p.name);
    if (score >= FUZZY_THRESHOLD && score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

function extractClassYears(text) {
  const years = [];
  const re = /\b(20(?:2[0-9]|3[0-5]))\b/g;
  let m;
  while ((m = re.exec(String(text || '')))) years.push(parseInt(m[1], 10));
  return years;
}

function resolvePlayerFromTextSync(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  let teaser = null;
  try {
    teaser = require('./beat-teaser-resolve');
  } catch {
    teaser = null;
  }
  const t = teaser?.textWithoutRelationalNames ? teaser.textWithoutRelationalNames(raw) : raw;
  const relationalOk = (name) => !(teaser?.isRelationalMention && teaser.isRelationalMention(raw, name));

  const cleanName = (n) => {
    let s = String(n || '').trim();
    // "Davin Davidson's" → Davin Davidson
    s = s.replace(/['’]s$/i, '').trim();
    return s || null;
  };
  let name = cleanName(extractPlayerFromText(t));
  if (name && !relationalOk(name)) name = null;
  if (!name) {
    const candidates = extractAllPlayerNameCandidates(t) || [];
    name = cleanName(candidates.find((n) => relationalOk(cleanName(n) || n)) || null);
  }
  if (!name) {
    try {
      const allowlist = require('./recruiting-target-allowlist');
      const names = Object.values(allowlist.getMergedCanonicalNames?.() || allowlist.CANONICAL_TARGET_NAMES || {});
      for (const n of names) {
        const re = new RegExp(`\\b${String(n).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (re.test(t) && relationalOk(n)) {
          name = n;
          break;
        }
      }
    } catch {
      /* optional */
    }
  }
  if (!name) return null;
  const roster = matchRosterByName(name);
  if (roster?.name) {
    return {
      playerName: roster.name,
      playerSlug: roster.slug || slugify(roster.name),
      classYear: roster.classYear != null ? Number(roster.classYear) : null,
      matchMode: 'roster_sync'
    };
  }
  if (isValidPlayerName(name)) {
    return { playerName: name, playerSlug: slugify(name), classYear: null, matchMode: 'text_extract' };
  }
  return null;
}

function normalizeHandle(post) {
  return String(post?.handle || post?.writerId || '').toLowerCase().replace(/^@/, '');
}

function isUfOfficialAccount(post) {
  return beatFilters.isUfOfficialAccount(post);
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

function matchesRecruiting(text, post = null) {
  const hay = text.toLowerCase();
  if (RECRUITING_TERMS.some((term) => hay.includes(term))) return true;
  // Cousin / family-hook teasers are recruiting intel even without classic verbs.
  if (/\bcousin/.test(hay) && /\b(florida|gators|uf)\b/.test(hay) && /\b(prospect|top[\s-]?100|ranked|pushing)\b/.test(hay)) {
    return true;
  }
  try {
    const prefilter = require('./beat-intel-prefilter');
    if (prefilter.hasStrongRecruitingSignals(text, post)) return true;
  } catch {
    /* optional */
  }
  try {
    const teaser = require('./beat-teaser-resolve');
    if (teaser.hasResolvableOn3Article(post || { text })) return true;
    const sync = teaser.parseSyncOn3Identity(post || { text });
    if (sync?.playerSlug) return true;
  } catch {
    /* optional */
  }
  try {
    const { parseOn3BeatUrlIdentity } = require('./on3-recruit-discovery');
    if (parseOn3BeatUrlIdentity(text, post?.url)?.playerSlug) return true;
  } catch {
    /* optional */
  }
  return false;
}

function matchesClassYear(text, post = null) {
  const years = extractClassYears(text);
  if (!years.length) return true;
  const allowFuture = post?.manualClassYearOverride || process.env.BEAT_INGEST_ALLOW_CLASS_2029 === 'true';
  if (years.some((y) => y >= 2029) && !allowFuture) return false;
  // Closing class 2027 + discovery 2028 are in scope. Mixed headlines stay eligible if either is present.
  if (years.some((y) => y === 2027 || y === 2028)) return true;
  if (years.some((y) => y >= 2028)) return true;
  // Explicit pre-2027 only (e.g. 2026 portal/HS) stays out of recruiting beat ingest.
  if (years.every((y) => y < 2027)) return false;
  return true;
}

function matchesUfMention(text, post) {
  return beatFilters.hasUfIngestContext(post || { text }, text);
}

function passesOtherProgramGate(text, post) {
  return !beatFilters.mentionsOtherProgramWithoutUf(text, post);
}

function matchesPlayerName(text, post = null) {
  const body = String(text || '');
  if (/\b(db battles|battles heat up|first 20\d{2} commit lands|recruiting storylines?|flip targets|decision dates dropping)\b/i.test(body)) {
    return false;
  }

  let teaser = null;
  try {
    teaser = require('./beat-teaser-resolve');
  } catch {
    teaser = null;
  }

  const cleaned = teaser?.textWithoutRelationalNames ? teaser.textWithoutRelationalNames(body) : body;
  const fromExtract = extractPlayerFromText(cleaned);
  if (fromExtract && isValidPlayerName(fromExtract) && !(teaser?.isRelationalMention && teaser.isRelationalMention(body, fromExtract))) {
    return true;
  }
  if (PLAYER_NAME_RE.test(cleaned)) {
    const m = cleaned.match(PLAYER_NAME_RE);
    if (m?.[0] && isValidPlayerName(m[0]) && !(teaser?.isRelationalMention && teaser.isRelationalMention(body, m[0]))) {
      return true;
    }
  }
  const resolved = resolvePlayerFromTextSync(body);
  if (resolved?.playerName && isValidPlayerName(resolved.playerName)) return true;

  // Nameless teaser with an On3 article link — identity comes from the article.
  if (teaser?.hasResolvableOn3Article?.(post || { text: body })) return true;

  try {
    const { parseOn3BeatUrlIdentity } = require('./on3-recruit-discovery');
    if (parseOn3BeatUrlIdentity(text, post?.url)?.playerSlug) return true;
  } catch {
    /* optional */
  }
  return false;
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
  if (!beatFilters.passesStrictUfOnlyFilter(post, body)) {
    return {
      pass: false,
      reason: beatFilters.strictUfOnlyBlockReason(post, body),
      failedRule: 1,
    };
  }
  if (!matchesFootball(body)) {
    return { pass: false, reason: 'no_football_signal', failedRule: 2 };
  }
  if (!matchesRecruiting(body, post)) {
    return { pass: false, reason: 'no_recruiting_signal', failedRule: 3 };
  }
  if (!matchesClassYear(body, post)) {
    const years = extractClassYears(body);
    const reason = years.some((y) => y >= 2029)
      ? 'class_year_above_2028'
      : years.every((y) => y < 2027)
        ? 'class_year_below_2027'
        : 'class_year_out_of_scope';
    return { pass: false, reason, failedRule: 4 };
  }
  if (!matchesUfMention(body, post)) {
    return { pass: false, reason: 'no_uf_mention', failedRule: 5 };
  }
  if (!passesOtherProgramGate(body, post)) {
    return { pass: false, reason: 'other_program_without_uf', failedRule: 5 };
  }
  if (!matchesPlayerName(body, post)) {
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
  PLAYER_NAME_RE,
  isUfOfficialAccount,
  isAllowedIngestAccount,
  matchesFootball,
  matchesRecruiting,
  matchesClassYear,
  matchesUfMention,
  passesOtherProgramGate,
  matchesPlayerName,
  evaluateStrictRecruitingIngestGate,
  passesStrictRecruitingIngestGate,
  extractClassYears,
  resolvePlayerFromTextSync,
  matchRosterByName
};
