/**
 * Sport Classification Layer — football autoposter runs ONLY when sport === football.
 * Blocks baseball/basketball/other UF sports from entering the beat pipeline.
 */
const SPORTS = Object.freeze({
  FOOTBALL: 'football',
  BASKETBALL: 'basketball',
  BASEBALL: 'baseball',
  SOFTBALL: 'softball',
  GYMNASTICS: 'gymnastics',
  OTHER_UF: 'other_uf',
  NON_UF: 'non_uf',
  IRRELEVANT: 'irrelevant'
});

/** Absolute baseball — always baseball regardless of other sports mentioned. */
const BASEBALL_ABSOLUTE_RES = [
  /\bpitching coach\b/i,
  /\bhitting coach\b/i,
  /\bbullpen\b/i,
  /\bmound\b/i,
  /\bdiamond\b/i,
  /\bsec baseball\b/i,
  /\bgators baseball\b/i,
  /\bflorida baseball\b/i,
  /\b@?gatorsbsb\b/i,
  /\bbaseball\b/i,
  /\bpitcher\b/i,
  /\bstarting pitcher\b/i,
  /\brelief pitcher\b/i,
  /\bcollege world series\b/i,
  /\bncaa (?:baseball|regionals?|super regionals?)\b/i
];

/** Soft baseball signals — only when not softball. */
const BASEBALL_SOFT_RES = [
  /\bhome run\b/i,
  /\bhomers?\b/i,
  /\brbi(s)?\b/i,
  /\bstrikeout(s)?\b/i,
  /\binning(s)?\b/i,
  /\bbatting order\b/i,
  /\bdugout\b/i,
  /\bdouble[- ]play\b/i
];

const BASKETBALL_RES = [
  /\bbasketball\b/i,
  /\bhoops\b/i,
  /\bsec basketball\b/i,
  /\bgators basketball\b/i,
  /\bflorida basketball\b/i,
  /\b@?gatorsmbb\b/i,
  /\b@?floridambb\b/i,
  /\bmarch madness\b/i,
  /\bthree[- ]pointer\b/i,
  /\bthree[- ]point\b/i,
  /\bbackcourt\b/i,
  /\bfrontcourt\b/i,
  /\bfree throw\b/i,
  /\brebound(s)?\b/i,
  /\bncaa tournament\b/i,
  /\bsec tournament\b/i,
  /\btip[- ]off\b/i
];

const SOFTBALL_RES = [
  /\bsoftball\b/i,
  /\bgators softball\b/i,
  /\bflorida softball\b/i,
  /\b@?gatorssoftball\b/i,
  /\bsec softball\b/i
];

const GYMNASTICS_RES = [
  /\bgymnastics\b/i,
  /\bgators gymnastics\b/i,
  /\bflorida gymnastics\b/i,
  /\b@?gatorsgym\b/i,
  /\bfloor exercise\b/i,
  /\buneven bars\b/i,
  /\bbalance beam\b/i,
  /\bvault score\b/i
];

const OTHER_UF_SPORT_RES = [
  /\b(soccer|volleyball|lacrosse|tennis|swimming|track and field|cross country|golf|rowing|wrestling)\b/i,
  /\bgators (soccer|volleyball|lacrosse|tennis|swim|track|golf|wrestling)\b/i,
  /\bsec (soccer|volleyball|lacrosse|tennis|swim|track|golf)\b/i
];

const FOOTBALL_STRONG_RES = [
  /\bfootball\b/i,
  /\bgatorsfb\b/i,
  /\buffootball\b/i,
  /\bflorida football\b/i,
  /\buf football\b/i,
  /\b@?gatorsfb\b/i,
  /\brecruiting\b/i,
  /\bcommit(?:ted|ment)?\b/i,
  /\bdecommit(?:ted)?\b/i,
  /\bflip(?:ped)?\b/i,
  /\btransfer portal\b/i,
  /\bofficial visit\b/i,
  /\bunofficial visit\b/i,
  /\bov\b/i,
  /\buv\b/i,
  /\bclass of 20\d{2}\b/i,
  /\b\d+-star\b/i,
  /\bcommits to florida\b/i,
  /\bcommitted to florida\b/i,
  /\bflipped to florida\b/i,
  /\bWR\b/,
  /\bRB\b/,
  /\bTE\b/,
  /\bOL\b/,
  /\bDL\b/,
  /\bLB\b/,
  /\bCB\b/,
  /\bS\b/,
  /\bfuturecast\b/i,
  /\bcrystal ball\b/i,
  /\bprediction machine\b/i,
  /\bqb\b/i,
  /\bquarterback\b/i,
  /\brunning back\b/i,
  /\bwide receiver\b/i,
  /\btight end\b/i,
  /\boffensive line\b/i,
  /\bdefensive line\b/i,
  /\blinebacker\b/i,
  /\bcornerback\b/i,
  /\bsafety\b/i,
  /\bdefensive back\b/i,
  /\bdefensive end\b/i,
  /\bdefensive tackle\b/i,
  /\bedge rusher\b/i,
  /\b3-3-5\b/i,
  /\bspring game\b/i,
  /\bfall camp\b/i,
  /\bdepth chart\b/i,
  /\bsigning day\b/i,
  /\bnational signing day\b/i,
  /\bearly signing\b/i,
  /\bbilly napier\b/i,
  /\bnapier\b/i,
  /\bjon sumrall\b/i,
  /\bsumrall\b/i,
  /\bsec football\b/i,
  /\bcollege football\b/i,
  /\bthe swamp\b/i,
  /\bgator football\b/i
];

const UF_RELEVANCE_RES =
  /\b(florida|gators|gator|\buf\b|gainesville|floridagators|@gatorsfb|@floridagators|the swamp)\b/i;

const NON_UF_PROGRAM_RES =
  /\b(florida state|\bfsu\b|seminoles|\bgeorgia\b|\buga\b|bulldogs|\balabama\b|crimson tide|\bauburn\b|\blsu\b|\btennessee\b|volunteers|ole miss|mississippi state|south carolina|\bclemson\b|\bmiami\b|\bcanes\b|texas a&m|\baggies\b|ohio state|\bmichigan\b|\bnotre dame\b|\boklahoma\b|\btexas\b|\bpenn state\b)\b/i;

const SPORT_HANDLE_MAP = {
  baseball: ['gatorsbsb', 'floridabaseball', 'ufbaseball'],
  basketball: ['gatorsmbb', 'floridambb', 'ufmbb'],
  softball: ['gatorssoftball', 'ufsoftball'],
  gymnastics: ['gatorsgym', 'ufgymnastics'],
  football: ['gatorsfb', 'uffootball', 'floridafootball', 'gatorfootball', 'uf_football']
};

function normalizeText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function handleSportHint(post) {
  const handle = String(post?.handle || post?.writerId || '').toLowerCase().replace(/^@/, '');
  if (!handle) return null;
  for (const [sport, handles] of Object.entries(SPORT_HANDLE_MAP)) {
    if (handles.includes(handle)) return sport;
  }
  return null;
}

function firstMatchingRes(list, text) {
  for (const re of list) {
    if (re.test(text)) return re.source;
  }
  return null;
}

function classifySport(text, post = null) {
  const hay = normalizeText(text);
  if (!hay || hay.length < 8) {
    return { sport: SPORTS.IRRELEVANT, confidence: 95, reason: 'empty_or_too_short', signals: [] };
  }

  const signals = [];
  const handleHint = handleSportHint(post);
  if (handleHint) signals.push(`handle:${handleHint}`);

  for (const re of BASEBALL_ABSOLUTE_RES) {
    if (re.test(hay)) {
      signals.push(`baseball_hard:${re.source}`);
      return { sport: SPORTS.BASEBALL, confidence: 99, reason: 'baseball_hard_filter', signals };
    }
  }

  if (handleHint === 'baseball') {
    return { sport: SPORTS.BASEBALL, confidence: 98, reason: 'baseball_handle', signals };
  }

  const softballHit = firstMatchingRes(SOFTBALL_RES, hay);
  if (softballHit || handleHint === 'softball') {
    signals.push(softballHit ? `softball:${softballHit}` : 'handle:softball');
    return { sport: SPORTS.SOFTBALL, confidence: 92, reason: 'softball_signals', signals };
  }

  const basketballHit = firstMatchingRes(BASKETBALL_RES, hay);
  if (basketballHit || handleHint === 'basketball') {
    signals.push(basketballHit ? `basketball:${basketballHit}` : 'handle:basketball');
    return { sport: SPORTS.BASKETBALL, confidence: basketballHit ? 92 : 88, reason: 'basketball_signals', signals };
  }

  const gymHit = firstMatchingRes(GYMNASTICS_RES, hay);
  if (gymHit || handleHint === 'gymnastics') {
    signals.push(gymHit ? `gymnastics:${gymHit}` : 'handle:gymnastics');
    return { sport: SPORTS.GYMNASTICS, confidence: 92, reason: 'gymnastics_signals', signals };
  }

  for (const re of BASEBALL_SOFT_RES) {
    if (re.test(hay)) {
      signals.push(`baseball_soft:${re.source}`);
      return { sport: SPORTS.BASEBALL, confidence: 90, reason: 'baseball_soft_filter', signals };
    }
  }

  const otherUfHit = firstMatchingRes(OTHER_UF_SPORT_RES, hay);
  if (otherUfHit) {
    signals.push(`other_uf:${otherUfHit}`);
    return { sport: SPORTS.OTHER_UF, confidence: 88, reason: 'other_uf_sport', signals };
  }

  if (handleHint && handleHint !== 'football') {
    return { sport: SPORTS.OTHER_UF, confidence: 85, reason: 'non_football_handle', signals };
  }

  if (NON_UF_PROGRAM_RES.test(hay) && !/\b(florida|gators|\buf\b|gator)\b/i.test(hay)) {
    return { sport: SPORTS.NON_UF, confidence: 88, reason: 'other_program_primary', signals: ['non_uf_program'] };
  }

  const footballHits = FOOTBALL_STRONG_RES.filter((re) => re.test(hay));
  if (footballHits.length || handleHint === 'football') {
    for (const re of footballHits.slice(0, 4)) signals.push(`football:${re.source}`);
    if (handleHint === 'football') signals.push('handle:football');
    return {
      sport: SPORTS.FOOTBALL,
      confidence: Math.min(98, 70 + footballHits.length * 8 + (handleHint === 'football' ? 10 : 0)),
      reason: 'football_signals',
      signals
    };
  }

  if (!UF_RELEVANCE_RES.test(hay)) {
    if (NON_UF_PROGRAM_RES.test(hay)) {
      return { sport: SPORTS.NON_UF, confidence: 85, reason: 'other_program_no_uf', signals: ['non_uf_program'] };
    }
    return { sport: SPORTS.IRRELEVANT, confidence: 80, reason: 'no_uf_relevance', signals: [] };
  }

  if (!/\b(recruit|commit|portal|coach|roster|schedule|game|visit|offer|sign|camp|practice|nil|stadium|facility|athletics)\b/i.test(hay)) {
    return { sport: SPORTS.IRRELEVANT, confidence: 75, reason: 'uf_no_sport_content', signals: ['uf_generic'] };
  }

  if (NON_UF_PROGRAM_RES.test(hay) && !/\b(florida|gators|\buf\b)\b/i.test(hay)) {
    return { sport: SPORTS.NON_UF, confidence: 82, reason: 'other_program', signals: ['non_uf_program'] };
  }

  return {
    sport: SPORTS.OTHER_UF,
    confidence: 60,
    reason: 'uf_without_football_signals',
    signals: ['uf_generic']
  };
}

function isFootballSport(classification) {
  const sport = typeof classification === 'string' ? classification : classification?.sport;
  return sport === SPORTS.FOOTBALL;
}

function isFootballAutoposterEligible(text, post = null) {
  return isFootballSport(classifySport(text, post));
}

function buildNonFootballSkipPayload(classification, text) {
  return {
    skipReason: 'non_football_sport',
    _nonFootballSkip: true,
    sportClassification: classification,
    sport: classification?.sport || SPORTS.IRRELEVANT,
    triggerPhrase: normalizeText(text).slice(0, 160)
  };
}

function guardFootballOnly(text, post = null) {
  const classification = classifySport(text, post);
  if (isFootballSport(classification)) return null;
  return buildNonFootballSkipPayload(classification, text);
}

function logNonFootballSkip({ text, classification, post = null, subsystem = 'autoposter:sport-filter' } = {}) {
  const phrase = normalizeText(text).slice(0, 160);
  try {
    require('./ops-monitor').logEvent({
      subsystem,
      status: 'skipped',
      message: `non-football sport (${classification?.sport || 'unknown'})`,
      details: {
        sport: classification?.sport,
        confidence: classification?.confidence,
        reason: classification?.reason,
        signals: (classification?.signals || []).slice(0, 6),
        triggerPhrase: phrase,
        handle: post?.handle || null
      }
    });
  } catch {
    /* ops optional */
  }
}

function isNonFootballSkip(raw) {
  if (!raw) return false;
  return Boolean(raw._nonFootballSkip || raw.skipReason === 'non_football_sport');
}

function filterFootballBeatPosts(posts) {
  return (posts || []).filter((p) => isFootballAutoposterEligible(p?.text, p));
}

module.exports = {
  SPORTS,
  BASEBALL_ABSOLUTE_RES,
  BASEBALL_SOFT_RES,
  classifySport,
  isFootballSport,
  isFootballAutoposterEligible,
  guardFootballOnly,
  buildNonFootballSkipPayload,
  logNonFootballSkip,
  isNonFootballSkip,
  filterFootballBeatPosts
};
