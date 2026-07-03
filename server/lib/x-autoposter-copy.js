/**
 * Autoposter copy — verified insider report templates only. No headline-only posts.
 */
const playerContext = require('./x-autoposter-player-context');
const autoposterIdentity = require('./autoposter-identity');
const template = require('./x-autoposter-template');
const validation = require('./x-autoposter-validation');
const { isValidPlayerName } = playerContext;

const SITE_URL = process.env.SITE_URL || 'https://gatorvaultinsider.com';
const FUTURECAST_VISITS_URL = `${SITE_URL}/vault/futurecast#visits`;
const FUTURECAST_BOARD_URL = `${SITE_URL}/vault/futurecast#master-board`;

const SUBTLE_HOOKS = [
  'Full board read',
  'Track the FutureCast arc',
  'Visit timeline + RPM',
  'Board intel breakdown',
  'Class fit + movement'
];

function playerProfileUrl(slug, meta = {}) {
  if (!slug) return resolveAutoposterSiteUrl(meta);
  const et = String(meta.eventType || meta.triggerType || '').toLowerCase();
  const base = `${SITE_URL}/vault/futurecast/player/${encodeURIComponent(slug)}`;
  if (/visit|ov|uv/.test(et)) return `${base}#visits`;
  if (/prediction|futurecast|rpm|crystal/.test(et)) return `${base}#futurecast`;
  return base;
}

function buildSubtleDiscoveryLine(meta = {}) {
  if (process.env.X_AUTOPOST_SUBTLE_GV_HOOKS === 'false') return null;
  if (process.env.X_AUTOPOST_GV_CTA_ENABLED !== 'true') return null;
  const slug = meta.playerSlug || meta.validationMeta?.playerSlug || null;
  const url = playerProfileUrl(slug, meta);
  const hookIdx =
    Math.abs(
      String(slug || meta.playerName || 'gv')
        .split('')
        .reduce((a, c) => a + c.charCodeAt(0), 0)
    ) % SUBTLE_HOOKS.length;
  const hook = SUBTLE_HOOKS[hookIdx];
  return `${hook} \u2193\n${url.replace('https://', '')}`;
}

/** Chars consumed by appendSite hook (leading newline + hook block). */
function estimateHookBudget(meta = {}) {
  if (process.env.X_AUTOPOST_GV_CTA_ENABLED !== 'true') return 0;
  const subtle = buildSubtleDiscoveryLine(meta);
  if (subtle) return 1 + subtle.length;
  const landing = resolveAutoposterSiteUrl(meta).replace('https://', '');
  return 1 + landing.length;
}

const BROKEN_COPY_PATTERNS = [
  /\bour own pi\b/i,
  /\bHer — via\b/i,
  /\bHis — via\b/i,
  /\bThe — via\b/i,
  /\bNew — via\b/i,
  /\bFour — via\b/i,
  /\bOther — via\b/i,
  /reports that .+ has (committed|decommitted|entered)/i,
  /full rpm, visit intel, and predictions on futurecast\.?/i,
  /gatorvault detectives/i,
  /signal verified on a florida recruiting target/i,
  /logged a campus visit window/i,
  /beat intel confirmed uf football context/i,
  /failed first-pass filters/i,
  /beat trail and player profile on recruiting hub/i,
  /^florida recruiting intel$/im,
  /board analysis and futurecast breakdown rebuilt from beat signal/i,
  /face time with the prospect in gainesville/i,
  /campus visit window confirmed — florida had real face time with (?:the prospect|this target)/i,
  /^\d{4}\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\w/i,
  /the prospect is on uf's board/i,
  /quietly gaining traction here as the staff keeps the relationship active/i,
  /staff is tracking this 20\d{2} target/i,
  /^20\d{2}\.?$/m,
  /🐊/
];

const PLAYER_INTEL_SIGNALS = [
  /\b(commit(?:ted|ment)?|decommit(?:ted)?|flip(?:ped)?|portal|enroll(?:s|ed|ing)?)\b/i,
  /\b(official visit|\bov\b|\buv\b|unofficial visit|visit(?:ed|ing|s)? scheduled|cancel(?:led|s)?\s+(?:his|her|their)?\s*(?:ov|official))\b/i,
  /\b(?:trip|visit)\s+to\s+(?:gainesville|the swamp)\b/i,
  /\bstrong interest in the gators\b/i,
  /\b(interior ol|i ol|no\.?\s*1)\b/i,
  /\b(prediction machine|futurecast|expert pick|crystal ball|forecast logged|prediction logged|rpm)\b/i,
  /\b(offer(?:ed|s)?|verb(?:ed|al)?)\b/i,
  /\bClass of 20\d{2}\b/i,
  /\b20\d{2}\s+(?:\d+-Star\s+)?[A-Z]{1,4}\s+[A-Z][a-z]+/,
  /\btrend(?:ing)?\s+up\b/i,
  /\bstaff loves\b/i
];

const NAME_PART = `[A-Z][A-Za-z'.-]+`;
const NAME_SUFFIX = `(?:\\s+(?:Jr\\.?|Sr\\.?|II|III|IV|V))?`;
const NAME_CHUNK = `${NAME_PART}(?:\\s+${NAME_PART}){1,2}${NAME_SUFFIX}`;
const POS_TOKEN = `(?:QB|RB|WR|TE|OL|OT|OG|C|DL|DT|DE|EDGE|LB|CB|S|ATH|K|P)`;
const TRAILING_NAME_NOISE_RE =
  /\s+(?:can't|cant|won't|wont|doesn't|doesnt|isn't|isnt|aren't|arent|wasn't|wasnt|hasn't|hasnt|haven't|havent|didn't|didnt|ignore|ignores|ignored|could|would|should|will|can)\.?$/i;

function sanitizeExtractedPlayerName(name) {
  let n = String(name || '').trim();
  if (!n) return null;
  for (let i = 0; i < 3; i += 1) {
    const trimmed = n.replace(TRAILING_NAME_NOISE_RE, '').trim();
    if (trimmed === n) break;
    n = trimmed;
  }
  return isValidPlayerName(n) ? n : null;
}

function titleCaseToken(word) {
  return String(word || '')
    .split(/([-'])/)
    .map((part) => {
      if (part === '-' || part === "'") return part;
      if (!part) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
}

/** Normalize lowercase beat tweets so name regexes can match. */
function normalizeTextForNameExtract(text) {
  let t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t || t !== t.toLowerCase()) return t;

  t = t.replace(
    /\b(20\d{2})\s+(?:(\d+-star)\s+)?(qb|rb|wr|te|ol|ot|og|c|dl|dt|de|edge|lb|cb|s|ath|k|p)\s+([a-z'.-]+(?:\s+[a-z'.-]+){0,2}(?:\s+(?:jr\.?|sr\.?|ii|iii|iv|v))?)\b/gi,
    (_, yr, star, pos, name) =>
      `${yr}${star ? ` ${star}` : ''} ${pos.toUpperCase()} ${name
        .split(/\s+/)
        .map(titleCaseToken)
        .join(' ')}`
  );
  t = t.replace(
    /\b([a-z'.-]+)\s+([a-z'.-]+(?:\s+[a-z'.-]+)?(?:\s+(?:jr\.?|sr\.?|ii|iii|iv|v))?)\s+(is|has|will|was|to)\b/gi,
    (_, a, b, verb) => `${titleCaseToken(a)} ${b.split(/\s+/).map(titleCaseToken).join(' ')} ${verb}`
  );
  return t;
}

function extractAllPlayerNameCandidates(text) {
  const variants = [String(text || ''), normalizeTextForNameExtract(text)].filter(Boolean);
  const seen = new Set();
  const hits = [];
  for (const t of variants) {
    const re = new RegExp(`\\b(${NAME_CHUNK})\\b`, 'g');
    let m;
    while ((m = re.exec(t))) {
      const name = m[1]?.trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      const clean = sanitizeExtractedPlayerName(name);
      if (clean) hits.push(clean);
    }
  }
  return hits;
}

function extractPlayerFromText(text) {
  const variants = [String(text || ''), normalizeTextForNameExtract(text)].filter(Boolean);
  const patterns = [
    new RegExp(`\\b(?:Class of )?(20\\d{2})\\s+(?:\\d+-Star\\s+)?(?:${POS_TOKEN}\\s+)(${NAME_CHUNK})\\b`),
    new RegExp(`\\b(?:Class of 20\\d{2})\\s+(?:\\d+-Star\\s+)?(?:${POS_TOKEN}\\s+)?(${NAME_CHUNK})\\b`),
    new RegExp(`\\b(?:BREAKING:)\\s*(?:Class of 20\\d{2}\\s+)?(?:\\d+-Star\\s+)?(?:${POS_TOKEN}\\s+)?(${NAME_CHUNK})\\b`),
    new RegExp(`\\b(?:top[- ]?\\d+|top\\s+(?:\\d+|100|150))\\s+prospect\\s+(${NAME_CHUNK})\\b`, 'i'),
    new RegExp(`\\b(?:${POS_TOKEN})\\s+(${NAME_CHUNK})\\b`),
    new RegExp(`\\b(?:pick|prediction|forecast)\\s+for\\s+(${NAME_CHUNK})\\b`, 'i'),
    new RegExp(`\\bfor\\s+(${NAME_CHUNK})\\s+to\\s+Florida\\b`, 'i'),
    new RegExp(`\\b(${NAME_CHUNK})\\s+(?:has|have)\\s+(?:committed|cancelled|canceled|decommitted|flipped|enrolled|signed)\\b`),
    new RegExp(`\\b(${NAME_CHUNK})\\s+(?:will|to)\\s+(?:now\\s+)?(?:visit|take|officially)\\b`),
    new RegExp(`["'](${NAME_CHUNK})["']`),
    new RegExp(`\\b(${NAME_CHUNK})\\s*,\\s*(?:a|the)?\\s*(?:20\\d{2}|${POS_TOKEN})\\b`),
    new RegExp(`\\b(?:target|prospect|recruit|commit|flip|visit(?:er)?)\\s+(${NAME_CHUNK})(?=\\s+(?:can't|cannot|can\\s+not|won't|will|is|has|was|ignor|who|that|and)\\b|\\s*[.,!?]|\\s*$)`, 'i')
  ];
  for (const t of variants) {
    for (const re of patterns) {
      const m = t.match(re);
      const name = sanitizeExtractedPlayerName((m?.[2] || m?.[1])?.trim());
      if (name) return name;
    }
    const candidates = extractAllPlayerNameCandidates(t);
    if (candidates.length) return candidates[0];
  }
  return null;
}

function hasPlayerSpecificIntel(text) {
  const t = String(text || '');
  if (!PLAYER_INTEL_SIGNALS.some((re) => re.test(t))) return false;
  return !!extractPlayerFromText(t);
}

function isGeneralBeatCommentary(text) {
  const lower = String(text || '').toLowerCase();
  if (hasPlayerSpecificIntel(text)) return false;
  if (
    /still working|still chasing|still pushing|in the hunt|on the trail|weekend ahead|busy weekend|several targets|plenty of|lot of targets|working on targets|recruiting well|good momentum|big weekend coming|uf trending|trending for florida/i.test(
      lower
    )
  ) {
    return true;
  }
  return !extractPlayerFromText(text);
}

function isPredictionMachinePost(text) {
  return /prediction machine|futurecast|expert pick logged|prediction logged/i.test(String(text || ''));
}

function extractVerifiedPatchFromBeatText(text) {
  const t = String(text || '');
  const yearMatch = t.match(/\b(20\d{2})\b/);
  const posMatch = t.match(/\b20\d{2}\s+(?:\d+-Star\s+)?([A-Z]{1,4})\s+[A-Z]/);
  const starsMatch = t.match(/\b([1-5])-Star\b/i);
  return {
    classYear: yearMatch ? parseInt(yearMatch[1], 10) : null,
    pos: posMatch ? posMatch[1] : null,
    stars: starsMatch ? parseInt(starsMatch[1], 10) : null,
    category: yearMatch && parseInt(yearMatch[1], 10) >= 2024 ? 'recruit' : null
  };
}

/** Deep-link X posts to the FutureCast section that matches the intel type. */
function resolveAutoposterSiteUrl(meta = {}, bodyText = '') {
  const slug = meta.playerSlug || meta.validationMeta?.playerSlug || meta.context?.playerSlug || null;
  if (slug) return playerProfileUrl(slug, meta);
  const text = String(bodyText || meta.beatText || '').toLowerCase();
  const et = String(meta.eventType || meta.triggerType || meta.teamEventType || '').toLowerCase();
  if (
    et.includes('visit') ||
    /visit intel|official visit|\bov\b|visit window|visit tracked/.test(text)
  ) {
    return FUTURECAST_VISITS_URL;
  }
  if (/futurecast board|futurecast update|futurecast puts uf|full tracker/.test(text)) {
    return FUTURECAST_BOARD_URL;
  }
  if (/futurecast|visit intel|2027 visit/.test(text)) {
    return FUTURECAST_VISITS_URL;
  }
  return SITE_URL;
}

function appendSite(text, meta = {}) {
  const body = template.finalizeAutoposterCopy(template.stripEmojisHashtags(text), meta);
  if (!body) return '';
  const subtle = buildSubtleDiscoveryLine(meta);
  if (subtle) {
    const withHook = `${body}\n${subtle}`;
    if (withHook.length <= 280) return withHook;
  }
  const landing = resolveAutoposterSiteUrl(meta, body);
  const urlBit = landing.replace('https://', '');
  if (body.includes(urlBit) || body.includes(SITE_URL.replace('https://', ''))) {
    return template.enforceTweetLimit(body, 280, meta);
  }
  const withUrl = `${body}\n${urlBit}`;
  return withUrl.length <= 280 ? withUrl : template.enforceTweetLimit(withUrl, 280, meta);
}

function stripUrlsForBeatParse(text) {
  return String(text || '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectBeatNewsEvent(text) {
  const t = stripUrlsForBeatParse(text);
  if (/cancel(?:led|s)?\s+(?:his|her|their)?\s*(?:ov|official visit).*?(?:florida|gators|\buf\b)/i.test(t)) {
    const next = t.match(/visit\s+((?:South\s+Carolina|North\s+Carolina|Ole\s+Miss|[A-Z][a-z]+(?:\s+State)?))/i);
    const nextPart = next?.[1] ? ` and will visit ${next[1]} this weekend` : '';
    return `cancelled his OV to Florida${nextPart}`;
  }
  if (/\b(?:committed|commits)\b.*\b(florida|gators|\buf\b)/i.test(t)) return 'committed to Florida';
  if (/\bflip(?:ped)?\b.*\b(florida|gators|\buf\b)/i.test(t)) return 'committed to Florida';
  if (/\bdecommit/i.test(t)) {
    const m = t.match(/decommitted from ([A-Za-z0-9 .]+)/i);
    return m ? `decommitted from ${m[1].trim()}` : 'decommitted';
  }
  if (/\bportal\b/i.test(t) && /\b(florida|gators|\buf\b)/i.test(t)) return 'entered the transfer portal (UF target)';
  if (/\bportal\b/i.test(t)) return 'entered the transfer portal';
  if (
    /\bannouncement (?:coming|at|today|this morning|this afternoon)|decision day|deciding (?:today|at|between)|commits? at \d/i.test(
      t
    )
  ) {
    return 'approaches a commitment decision with UF in the mix';
  }
  if (/\bsurprised\b.*\bofficial visit\b/i.test(t) && /\b(florida|gators|\buf\b)/i.test(t)) {
    return 'had his Gainesville OV stand out among his official visits';
  }
  if (/\b(official visit|\bov\b).*?(?:florida|gators|gainesville|\buf\b)/i.test(t)) return 'scheduled an OV to Florida';
  if (/\b(unofficial visit|\buv\b).*?(?:florida|gators|gainesville|\buf\b)/i.test(t)) return 'scheduled a visit to Gainesville';
  if (
    /\b(another|return|next)\s+(?:trip|visit)\s+to\s+(?:gainesville|the swamp)\b/i.test(t) ||
    (/\b100\s*percent\b/i.test(t) && /\bgainesville\b/i.test(t))
  ) {
    return 'indicated strong interest in another Gainesville visit';
  }
  if (/\bstrong interest in the gators\b/i.test(t)) return 'signaled strong interest in Florida';
  if (/\boffer(?:ed|s)?\b.*\b(florida|gators|\buf\b)/i.test(t)) return 'received an offer from UF';
  if (isPredictionMachinePost(t)) return 'picked up a UF prediction';
  if (/\brpm\b/i.test(t) && /\b(florida|gators|\buf\b)/i.test(t)) return 'picked up a UF prediction';
  if (/\bprediction\b/i.test(t) && /\b(florida|gators|\buf\b)/i.test(t)) return 'picked up a UF prediction';
  return null;
}

function resolveBeatIntelEventType(text, newsEvent) {
  const t = stripUrlsForBeatParse(text);
  if (!newsEvent) return 'update';
  if (/decision|announcement|commits? at/i.test(newsEvent) || /decision day|announcement coming/i.test(t)) {
    return 'decision_day';
  }
  if (/surprised|ov stand out|official visit/i.test(newsEvent) && /\bsurprised\b/i.test(t)) {
    return 'official_visit';
  }
  if (/gainesville visit|strong interest|100 percent|another trip/i.test(String(newsEvent || '').toLowerCase())) {
    return 'unofficial_visit';
  }
  if (/picked up a uf prediction|\brpm\b/i.test(String(newsEvent).toLowerCase())) return 'prediction';
  if (/official visit|\bov\b/i.test(newsEvent)) return 'official_visit';
  return 'beat_intel';
}

function beatIntelFromPost(post, { playerName, playerSlug, text, analyst } = {}) {
  const on3Discovery = require('./on3-recruit-discovery');
  const fromUrl = on3Discovery.parseOn3BeatUrlIdentity(text, post?.url || null);
  const ts = post?.publishedAt || post?.fetchedAt || post?.createdAt || new Date().toISOString();
  const newsEvent = detectBeatNewsEvent(text);
  return {
    timestamp: ts,
    sourceEventCreatedAt: post?.publishedAt || post?.fetchedAt || ts,
    publishedAt: post?.publishedAt || null,
    sourceHandle: post?.handle || null,
    articleUrl: fromUrl?.on3ArticleUrl || post?.url || null,
    playerName: playerName || fromUrl?.playerName || null,
    playerSlug: playerSlug || fromUrl?.playerSlug || null,
    pos: fromUrl?.pos || null,
    classYear: fromUrl?.classYear || null,
    eventType: resolveBeatIntelEventType(text, newsEvent),
    sourceEventType: newsEvent ? 'beat_intel' : 'update',
    source: analyst || post?.writerName || post?.handle || 'Beat writer',
    detail: text
  };
}

function identitySkipFromEnrichment(enrichment, { playerName, playerSlug, triggerPhrase, fingerprint } = {}) {
  return autoposterIdentity.buildNeedsResolutionPayload({
    missingFields:
      enrichment?.missingFields ||
      autoposterIdentity.missingFieldsFromEnrichment(enrichment) ||
      [],
    playerName:
      playerName ||
      enrichment?.mergedSnapshot?.playerName ||
      enrichment?.contextual?.player?.name ||
      null,
    playerSlug:
      playerSlug ||
      enrichment?.mergedSnapshot?.playerSlug ||
      enrichment?.contextual?.player?.slug ||
      null,
    triggerPhrase: triggerPhrase || enrichment?.contextual?.clues?.raw || null,
    fingerprint
  });
}

async function resolveIntelForCopy(intel, opts = {}) {
  const resolution = await autoposterIdentity.resolveIntelForAutoposter(intel, {
    subsystem: 'autoposter:copy',
    ...opts
  });
  if (resolution.nonPlayerIntel) return { ok: false, payload: resolution.skip };
  if (!resolution.ok) return { ok: false, payload: resolution.skip };
  return { ok: true, intel: resolution.intel };
}

function newsPayloadFromBuilt(built, extra = {}) {
  if (built?.skipReason || built?._identitySkip || built?._needsResolution) return built;
  if (!built?.text) return null;
  const brand = require('./x-autoposter-brand');
  const copyMeta = {
    triggerType: extra.triggerType || built.triggerType || built.postKind || null,
    postKind: built.postKind || extra.triggerType || null,
    teamEventType: built.teamEventType || extra.teamEventType || built.validationMeta?.teamEventType || null,
    programNewsType: built.programNewsType || extra.programNewsType || built.validationMeta?.programNewsType || null,
    beatText: built.validationMeta?.beatText || extra.beatText || null,
    playerSlug: built.playerSlug || built.context?.playerSlug || built.validationMeta?.playerSlug || extra.playerSlug || null,
    playerName: built.playerName || extra.playerName || null,
    eventType: built.validationMeta?.eventType || extra.eventType || built.validationMeta?.situation || null
  };
  const text = brand.appendSiteOnce(built.text, copyMeta);
  const payload = {
    text,
    playerName: built.playerName,
    templateBlocks: built.templateBlocks,
    validationMeta: built.validationMeta,
    playerContext: built.context,
    ...extra
  };
  if (isBrokenCopy(text, payload)) return null;
  return payload;
}

async function buildPredictionMachineCopyAsync(post) {
  const prefilter = require('./beat-intel-prefilter');
  const text = String(post.text || '').replace(/\s+/g, ' ').trim();
  const guarded = await prefilter.guardBeatPost(post);
  if (!guarded.eligible) return guarded.skip;

  const playerName = guarded.playerName || extractPlayerFromText(text);
  if (!playerName || !isValidPlayerName(playerName)) return null;

  const prediction = require('./x-autoposter-prediction');
  const built = await prediction.buildPredictionPost({
    playerName,
    patch: { name: playerName, ...extractVerifiedPatchFromBeatText(text) },
    intel: {
      ...beatIntelFromPost(post, { playerName, playerSlug: guarded.playerSlug, text }),
      eventType: 'prediction',
      playerName,
      analystName: post.writerName || post.outlet || post.handle || 'Insider',
      detail: text
    },
    row: {
      analystName: post.writerName || post.outlet || post.handle || 'Insider',
      articleUrl: post.url || null
    },
    sourceLabel: post.writerName || post.outlet || 'Rivals'
  });
  if (!built?.ok) return null;
  return newsPayloadFromBuilt(built);
}

async function buildTeamEventCopyAsync(post, gate = {}) {
  const text = String(post?.text || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (template.HEADLINE_ONLY_RE.test(text)) return null;

  const analyst = post.writerName || post.outlet || post.handle || 'Beat writer';
  const built = playerContext.buildTeamEventPost({
    beatText: text,
    source: analyst,
    teamEventType: gate.teamEventType || gate.gate?.teamEventType || null,
    postUrl: post.url || null
  });
  return newsPayloadFromBuilt(built, { triggerType: 'team_event' });
}

async function buildProgramNewsCopyAsync(post, gate = {}) {
  const text = String(post?.text || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;

  const analyst = post.writerName || post.outlet || post.handle || 'Beat writer';
  const built = playerContext.buildProgramNewsPost({
    beatText: text,
    source: analyst,
    programNewsType: gate.programNewsType || gate.gate?.programNewsType || null,
    postUrl: post.url || null
  });
  if (!built?.text) return null;
  return newsPayloadFromBuilt(built, { triggerType: 'program_news' });
}

function buildTeamEventCopyFromSchedule(game) {
  if (!game?.game && !game?.opponent) return null;
  const opponent = game.opponent || String(game.game || '').replace(/^Florida vs\s+/i, '').trim();
  const when = game.date ? new Date(game.date) : null;
  const whenLabel =
    when && !Number.isNaN(when.getTime())
      ? when.toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'America/New_York',
          timeZoneName: 'short'
        })
      : null;
  const beatText = whenLabel
    ? `Florida vs ${opponent} kickoff set for ${whenLabel}${game.venue ? ` at ${game.venue}` : ''}.`
    : `Florida vs ${opponent} schedule update${game.venue ? ` at ${game.venue}` : ''}.`;
  const built = playerContext.buildTeamEventPost({
    beatText,
    source: 'Schedule',
    teamEventType: 'schedule'
  });
  if (!built?.text) return null;
  return newsPayloadFromBuilt(built, { triggerType: 'team_event' });
}

async function buildBeatIntelCopyAsync(post) {
  const prefilter = require('./beat-intel-prefilter');
  const sportClassifier = require('./x-autoposter-sport-classifier');
  const text = String(post.text || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;

  if (!sportClassifier.isFootballAutoposterEligible(text, post)) {
    return sportClassifier.buildNonFootballSkipPayload(sportClassifier.classifySport(text, post), text);
  }

  const guarded = await prefilter.guardBeatPost(post);
  if (!guarded.eligible) return guarded.skip;

  if (guarded.triggerType === 'program_news') {
    return buildProgramNewsCopyAsync(post, guarded);
  }

  if (guarded.triggerType === 'team_event') {
    return buildTeamEventCopyAsync(post, guarded);
  }

  if (template.HEADLINE_ONLY_RE.test(text)) return null;

  const analyst = post.writerName || post.outlet || post.handle || 'Beat writer';
  const playerName = guarded.playerName || extractPlayerFromText(text);

  if (isPredictionMachinePost(text)) {
    return buildPredictionMachineCopyAsync(post);
  }

  const on3Discovery = require('./on3-recruit-discovery');
  const urlIdentity = on3Discovery.parseOn3BeatUrlIdentity(text, post?.url || null);
  const resolvedPlayerSlug = guarded.playerSlug || urlIdentity?.playerSlug || null;

  const beatFilters = require('./beat-writer-filters');
  const isTeam =
    !hasPlayerSpecificIntel(text) &&
    !resolvedPlayerSlug &&
    beatFilters.matchesGatorFootballIntel(text) &&
    playerName &&
    isValidPlayerName(playerName);

  if (isTeam) {
    const newsEvent = detectBeatNewsEvent(text) || 'UF roster update';
    const built = await playerContext.buildPlayerNewsPost({
      source: analyst,
      newsEvent,
      playerName,
      beatText: text,
      patch: { name: playerName, ...extractVerifiedPatchFromBeatText(text) },
      postKind: 'team',
      teamContext: template.detectTeamContext(text)
    });
    return newsPayloadFromBuilt(built);
  }

  if (!hasPlayerSpecificIntel(text) && !playerName) return null;
  if (!playerName || !isValidPlayerName(playerName)) return null;

  const newsEvent = detectBeatNewsEvent(text);
  const hasMomentum = beatFilters.detectRecruitingMomentum(text);
  const visitInterest =
    /\b(another|return|next)\s+(?:trip|visit)\s+to\s+(?:gainesville|the swamp)\b/i.test(text) ||
    /\bstrong interest in the gators\b/i.test(text) ||
    (/\b100\s*percent\b/i.test(text) && /\bgainesville\b/i.test(text));
  if (!newsEvent && !hasMomentum && !visitInterest) return null;

  const built = await playerContext.buildPlayerNewsPost({
    source: analyst,
    newsEvent,
    playerName,
    playerSlug: resolvedPlayerSlug || guarded.playerSlug || null,
    beatText: text,
    intel: beatIntelFromPost(post, {
      playerName,
      playerSlug: resolvedPlayerSlug || guarded.playerSlug || null,
      text,
      analyst
    }),
    patch: {
      name: playerName,
      pos: urlIdentity?.pos || undefined,
      ...extractVerifiedPatchFromBeatText(text)
    }
  });
  return newsPayloadFromBuilt(built);
}

async function buildIntelCopyAsync(intel) {
  if (!intel?.eventType) return null;

  if (intel.eventType === 'program_news' || intel.triggerType === 'program_news') {
    const built = playerContext.buildProgramNewsPost({
      beatText: intel.detail || intel.status || '',
      source: intel.source || intel.analystName || 'Beat writer',
      programNewsType: intel.programNewsType || 'general'
    });
    return newsPayloadFromBuilt(built, { triggerType: 'program_news' });
  }

  if (intel.eventType === 'team_event' || intel.triggerType === 'team_event') {
    const built = playerContext.buildTeamEventPost({
      beatText: intel.detail || intel.status || '',
      source: intel.source || intel.analystName || 'Schedule',
      teamEventType: intel.teamEventType || 'general'
    });
    return newsPayloadFromBuilt(built, { triggerType: 'team_event' });
  }

  const resolved = await resolveIntelForCopy(intel, {
    beatText: intel.detail,
    fields: {
      playerName: intel.playerName,
      pos: intel.pos,
      classYear: intel.classYear,
      highSchool: intel.highSchool,
      hometownState: intel.hometownState,
      school: intel.school,
      stars: intel.stars,
      natlRank: intel.natlRank
    }
  });
  if (!resolved.ok) return resolved.payload;
  intel = resolved.intel;

  if (intel.eventType === 'prediction' || intel.eventType === 'prediction_change' || intel.eventType === 'rivals_futurecast') {
    const prediction = require('./x-autoposter-prediction');
    const built = await prediction.buildPredictionPost({
      intel,
      playerSlug: intel.playerSlug,
      playerName: intel.playerName,
      patch: playerContext.verifiedPatchFromIntel(intel),
      sourceLabel: playerContext.sourceLabelForIntel(intel),
      intelId: intel.id,
      skipIdentityLookup: true
    });
    if (!built?.ok) {
      if (built?.skipped) {
        return autoposterIdentity.buildNeedsResolutionPayload({
          missingFields: built.missingAfter || built.missing || [],
          playerName: intel.playerName,
          playerSlug: intel.playerSlug,
          triggerPhrase: intel.detail,
          fingerprint: intel.fingerprint
        });
      }
      return null;
    }
    return newsPayloadFromBuilt(built, {
      sources: built.sources?.filter((s) => s.url) || [{ label: intel.analystName || intel.source, url: intel.articleUrl }]
    });
  }

  if (!isValidPlayerName(intel.playerName)) {
    return autoposterIdentity.buildNeedsResolutionPayload({
      missingFields: ['fullName'],
      playerName: intel.playerName,
      playerSlug: intel.playerSlug,
      triggerPhrase: intel.detail,
      fingerprint: intel.fingerprint
    });
  }

  const newsEvent = playerContext.newsEventForIntel(intel);
  if (!newsEvent) return null;
  const source = playerContext.sourceLabelForIntel(intel);
  const built = await playerContext.buildPlayerNewsPost({
    source,
    newsEvent,
    playerSlug: intel.playerSlug,
    playerName: intel.playerName,
    patch: playerContext.verifiedPatchFromIntel(intel),
    intel,
    beatText: intel.detail || null,
    headline: intel.status || intel.detail?.slice(0, 120) || null,
    body: intel.detail || null,
    identityInferred: intel.identityInferred,
    identityConfidence: intel.identityConfidence
  });
  return newsPayloadFromBuilt(built);
}

async function buildMomentumCopyAsync(post) {
  const sportClassifier = require('./x-autoposter-sport-classifier');
  const textRaw = String(post?.text || '');
  if (!sportClassifier.isFootballAutoposterEligible(textRaw, post)) {
    return sportClassifier.buildNonFootballSkipPayload(sportClassifier.classifySport(textRaw, post), textRaw);
  }

  const prefilter = require('./beat-intel-prefilter');
  const guarded = await prefilter.guardBeatPost(post);
  if (!guarded.eligible) return guarded.skip;

  const beatFilters = require('./beat-writer-filters');
  const text = guarded.text || String(post.text || '');
  if (!beatFilters.detectRecruitingMomentum(text)) return null;
  if (!template.INSIDER_SIGNAL_RE.test(text)) return null;

  const playerName = guarded.playerName || extractPlayerFromText(text);
  if (!playerName || !isValidPlayerName(playerName)) return null;

  const source = post.writerName || post.outlet || post.handle || 'Insider';
  const built = await playerContext.buildPlayerNewsPost({
    source,
    newsEvent: null,
    playerName,
    beatText: text
  });
  return newsPayloadFromBuilt(built);
}

function buildVerifiedCommitEventCopy(ev, { source = 'On3' } = {}) {
  const player = ev.payload?.player || null;
  const playerName = player?.name || null;
  if (!playerName || !isValidPlayerName(playerName)) return null;
  const et = String(ev.eventType || 'commit').toLowerCase();
  if (!['commit', 'flip'].includes(et)) return null;

  const postSpec = require('./x-autoposter-post-spec');
  const patch = playerContext.verifiedPatchFromPlayer(player);
  const ctx = playerContext.formatPlayerContext({ ...player, ...patch, name: playerName });
  if (!ctx?.name || !ctx?.pos) return null;

  const situation = et === 'flip' ? 'commitment' : 'commitment';
  const composed = postSpec.composeStructuredPost(ctx, situation, {});
  if (!composed?.text || !composed.templateBlocks?.context || !composed.templateBlocks?.insider) {
    return null;
  }

  const text = appendSite(composed.text, { postKind: 'recruiting', triggerType: et });
  const payload = {
    text,
    playerName,
    templateBlocks: composed.templateBlocks,
    validationMeta: { verifiedCommit: true },
    verifiedCommit: true,
  };
  if (isBrokenCopy(text, payload)) return null;
  return payload;
}

async function buildRecruitingEventCopyAsync(ev, { source = 'On3' } = {}) {
  const player = ev.payload?.player || null;
  const playerName = player?.name || null;
  if (!isValidPlayerName(playerName)) return null;
  const newsEvent = playerContext.newsEventForRecruitingEvent(ev);
  if (!newsEvent) return null;
  const isPortal = ['portal_in', 'portal_out'].includes(String(ev.eventType || '').toLowerCase());
  const beatText = template
    .stripEmojisHashtags(
      [ev.title, ev.skinny, ev.detail, ev.payload?.summary].filter(Boolean).join('. ')
    )
    .trim();
  const built = await playerContext.buildPlayerNewsPost({
    source,
    newsEvent,
    playerSlug: ev.playerSlug || player?.slug,
    playerName,
    patch: playerContext.verifiedPatchFromPlayer(player),
    postKind: isPortal ? 'portal' : 'recruiting',
    portalStatus: isPortal ? 'Portal' : undefined,
    beatText,
    headline: ev.title || null,
    body: ev.skinny || ev.detail || null,
    intel: {
      timestamp: ev.createdAt || player?.commitDate || new Date().toISOString(),
      sourceEventCreatedAt: ev.createdAt || null,
      eventType: ev.eventType,
      sourceEventType: ev.eventType,
      source: ev.source || source,
      playerSlug: ev.playerSlug || player?.slug,
      playerName,
    },
  });
  let payload = newsPayloadFromBuilt(built);
  if ((!payload?.text || isBrokenCopy(payload.text, payload)) && !isPortal) {
    payload = buildVerifiedCommitEventCopy(ev, { source });
  }
  return payload;
}

async function buildPortalHeadlinerCopyAsync(headliner) {
  if (!headliner?.name || !isValidPlayerName(headliner.name)) return null;
  const newsEvent =
    headliner.category === 'portal' ? 'entered the transfer portal (UF target)' : 'committed to Florida';
  const built = await playerContext.buildPlayerNewsPost({
    source: 'On3',
    newsEvent,
    playerSlug: headliner.slug,
    playerName: headliner.name,
    patch: playerContext.verifiedPatchFromPlayer(headliner),
    postKind: headliner.category === 'portal' ? 'portal' : 'recruiting',
    portalStatus: 'Portal'
  });
  return newsPayloadFromBuilt(built);
}

async function buildArticleCopyAsync(article) {
  if (!article?.title) return null;
  const playerName = extractPlayerFromText(`${article.title} ${article.summary || article.excerpt || ''}`);
  if (!playerName) return null;
  const beatText = template.stripEmojisHashtags(
    `${article.title}. ${article.summary || article.excerpt || article.body || ''}`.trim()
  );
  if (!beatText || beatText.length < 20) return null;
  const built = await playerContext.buildPlayerNewsPost({
    source: article.author || article.sources?.[0]?.label || 'GatorVault',
    newsEvent: null,
    playerName,
    beatText,
    article,
    headline: article.title,
    body: article.summary || article.excerpt || article.body,
    postKind: 'recruiting'
  });
  return newsPayloadFromBuilt(built);
}

function postReferencesPlayerName(text, playerName) {
  const name = String(playerName || '').trim();
  if (!name || !isValidPlayerName(name)) return false;
  const parts = name.split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1]?.replace(/\./g, '');
  if (!last || last.length < 2) return false;
  return new RegExp(`\\b${last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(String(text || ''));
}

function isGenericRecruitingHubUrl(text) {
  const t = String(text || '');
  if (!/gatorvaultinsider\.com\/vault\/recruiting/i.test(t)) return false;
  return !/\/player\/|futurecast\/player\//i.test(t);
}

function isBrokenCopy(text, meta = {}) {
  const t = String(text || '');
  if (!t.trim()) return true;
  if (/full details via the original report/i.test(t)) return true;
  if (/^per .+ report\.?\s*$/im.test(t) && t.split('\n').filter(Boolean).length <= 2) return true;
  if (template.isTruncatedCopy(t)) return true;
  if (BROKEN_COPY_PATTERNS.some((re) => re.test(t))) return true;
  if (template.isHeadlineOnlyPost(t)) return true;
  if (!template.hasTemplateStructure(t)) return true;
  if (/^[A-Z][a-z]{1,3} — via /i.test(t)) return true;
  if (/(^|\s)#[A-Za-z_]\w*/.test(t)) return true;
  if (validation.hasDuplicateSentences(t, meta.templateBlocks)) return true;
  const blocks = meta.templateBlocks || validation.parseTemplateBlocks({ text: t });
  if (blocks.context && validation.isGenericSyntheticContext(blocks.context)) return true;
  if (blocks.insider && validation.isRankOnlyInsider(blocks.insider)) return true;
  if (blocks.insider && require('./x-autoposter-prediction').isBarePredictionLine(blocks.insider)) return true;
  if (blocks.context && require('./x-autoposter-prediction').isBarePredictionLine(blocks.context)) return true;
  const beatText = meta.validationMeta?.beatText || meta.beatText || null;
  if (
    beatText &&
    !meta.validationMeta?.verifiedCommit &&
    !meta.verifiedCommit &&
    !meta.validationMeta?.eliteCompose &&
    validation.hasExcessiveSourceOverlap(t, beatText)
  ) {
    return true;
  }
  const isRecruitingPlayerPost =
    meta.topic === 'recruiting' ||
    meta.validationMeta?.detectivesResolved ||
    String(meta.source || '').includes('detectives') ||
    String(meta.source || '').includes('beat-intel');
  if (isRecruitingPlayerPost && meta.playerName) {
    if (!postReferencesPlayerName(t, meta.playerName)) return true;
    if (isGenericRecruitingHubUrl(t)) return true;
  }
  return false;
}

module.exports = {
  SITE_URL,
  FUTURECAST_VISITS_URL,
  FUTURECAST_BOARD_URL,
  resolveAutoposterSiteUrl,
  buildSubtleDiscoveryLine,
  estimateHookBudget,
  playerProfileUrl,
  isValidPlayerName,
  extractPlayerFromText,
  sanitizeExtractedPlayerName,
  extractAllPlayerNameCandidates,
  normalizeTextForNameExtract,
  hasPlayerSpecificIntel,
  isGeneralBeatCommentary,
  isPredictionMachinePost,
  appendSite,
  newsPayloadFromBuilt,
  buildPredictionMachineCopyAsync,
  buildTeamEventCopyAsync,
  buildProgramNewsCopyAsync,
  buildTeamEventCopyFromSchedule,
  buildBeatIntelCopyAsync,
  buildIntelCopyAsync,
  buildMomentumCopyAsync,
  buildRecruitingEventCopyAsync,
  buildVerifiedCommitEventCopy,
  buildPortalHeadlinerCopyAsync,
  buildArticleCopyAsync,
  isBrokenCopy,
  postReferencesPlayerName,
  isGenericRecruitingHubUrl,
  detectBeatNewsEvent,
  stripUrlsForBeatParse
};
