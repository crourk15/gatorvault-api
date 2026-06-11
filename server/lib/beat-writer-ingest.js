/**
 * Beat Writer Ingest — visit intel from trusted UF beat writers → intel store → autoposter.
 * Runs Player Identity Lookup + Confirmation before posting. Skips if unconfirmed.
 */
const fs = require('fs');
const path = require('path');
const { getBeatPosts } = require('./live-beat');
const beatFilters = require('./beat-writer-filters');
const cancelParser = require('./beat-visit-intel-parser');
const store = require('./recruiting-store');
const intelStore = require('./recruiting-intel-store');
const liveStore = require('./live-store');
const { clearHeatCheckCache } = require('./heat-check-store');
const { buildOn3ProfileUrl } = require('./on3-urls');
const { slugify } = require('./slug');

const DATA_DIR = path.join(__dirname, '..', 'data', 'recruiting');
const SNAPSHOT_PATH = path.join(DATA_DIR, 'beat-writer-ingest-snapshot.json');
const SITE_URL = process.env.SITE_URL || 'https://gatorvaultinsider.com';

/** Trusted handles for recruiting ingest — UF beat + national UF-only reporters. */
const VISIT_INGEST_HANDLES = new Set([
  'ttjharden8',
  'corey_bender',
  'gatorsonline',
  'grahamhall_',
  'nickdelatorregc',
  'thomasgoldkamp',
  'blake_alderman',
  'keithniebuhr',
  'chadsimmons_',
  'hayesfawcett3',
  'zachabolverdi',
  'andrew_ivins',
  'jamieivins',
  'charlespower',
  'stevewiltfong',
  'ejhollandon3',
  'on3recruits',
  'rivalsportal',
  'gatorsterritory',
  'insidethegators',
  'onlygators',
  'alligatorarmy',
  'gatorsbreakdown'
]);

const RECRUITING_INTEL_SIGNAL_RES = [
  /\b(?:commit(?:ted|ment)?|decommit(?:ted)?|flip(?:ped)?|portal|offer(?:ed|s)?|verb(?:ed|al)?)\b/i,
  /\b(?:official visit|\bov\b|\buv\b|unofficial visit|on campus|in gainesville|the swamp)\b/i,
  /\b(?:prediction machine|futurecast|expert pick|crystal ball|rpm|rivals)\b/i,
  /\b(?:recruiting battle|flip race|pulling ahead|leaning|momentum|heating up|staff loves)\b/i,
  /\b20\d{2}\s+(?:\d+-[Ss]tar\s+)?(?:QB|RB|WR|TE|OL|OT|OG|C|DL|DT|DE|EDGE|LB|CB|S|ATH)\s+[A-Z]/,
  /\b(?:Class of 20\d{2})\b/i
];

const VISIT_SIGNAL_RES = [
  /(?:official\s+visit|\bov\b).*?(?:florida|gators|gainesville|\buf\b|the\s+swamp)/i,
  /(?:florida|gators|gainesville|\buf\b|the\s+swamp).*?(?:official\s+visit|\bov\b)/i,
  /(?:on\s+campus|in\s+gainesville|at\s+the\s+swamp|the\s+swamp).*?(?:today|tonight|this\s+weekend|friday|saturday|sunday|monday|tomorrow)/i,
  /(?:returning\s+to\s+gainesville|back\s+in\s+gainesville|arrived\s+in\s+gainesville)/i,
  /set\s+to\s+(?:officially\s+)?visit.*?(?:florida|gators|gainesville|\buf\b|the\s+swamp)/i,
  /(?:will|is\s+set\s+to|plans\s+to|scheduled\s+to)\s+(?:officially\s+)?visit.*?(?:florida|gators|gainesville|\buf\b)/i,
  /(?:taking|took|heads?\s+to|heading\s+to)\s+(?:an?\s+)?(?:official\s+)?visit.*?(?:florida|gators|gainesville|\buf\b)/i
];

const UNOFFICIAL_VISIT_RE = /unofficial\s+visit|\buv\b|on\s+campus|in\s+gainesville|the\s+swamp/i;

const VISIT_DATE_RES = [
  { re: /this\s+weekend/i, label: 'this weekend' },
  { re: /\b(friday|saturday|sunday|monday|thursday|tuesday|wednesday)\b/i, label: null },
  { re: /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}\b/i, label: null },
  { re: /\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/, label: null },
  { re: /\btoday\b/i, label: 'today' },
  { re: /\btomorrow\b/i, label: 'tomorrow' }
];

const SCHOOL_RE =
  /\b(?:from|at)\s+([A-Z][A-Za-z0-9 .'-]+(?:High(?:\s+School)?|HS|Academy|Prep|Christian|Catholic|School))\b/;

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadSnapshot() {
  return readJson(SNAPSHOT_PATH, { version: 1, fingerprints: {}, lastRun: null });
}

function saveSnapshot(doc) {
  doc.lastRun = new Date().toISOString();
  writeJson(SNAPSHOT_PATH, doc);
}

function isVisitIngestWriter(post) {
  const handle = String(post.handle || post.writerId || '').toLowerCase();
  if (VISIT_INGEST_HANDLES.has(handle)) return true;
  if (beatFilters.isTrustedBeatWriter(post)) return true;
  const writer = String(post.writerName || post.outlet || '').toLowerCase();
  return (
    /harden|bender|gatorsonline|gators online|swamp247|graham hall|de la torre|goldkamp|goodall|alderman|holland|ivins|simmons|fawcett|gatorsterritory|insidethegators|on3recruits|rivalsportal/i.test(
      writer
    ) ||
    /harden|bender|gatorsonline|swamp247|grahamhall|nickdelatorre|thomasgoldkamp|blake_alderman|ejholland|andrew_ivins|chadsimmons|on3recruits|rivalsportal|gatorsterritory|insidethegators/i.test(
      handle
    )
  );
}

function logBeatPostSkip(post, reason, category = 'filtered') {
  try {
    require('./ops-monitor').logEvent({
      subsystem: 'autoposter:beat-writer',
      status: 'skipped',
      message: `beat post skipped: ${reason}`,
      details: {
        reason,
        category,
        handle: post?.handle || post?.writerId || null,
        writer: post?.writerName || post?.outlet || null,
        postId: post?.id || null,
        url: post?.url || null,
        textPreview: String(post?.text || '').replace(/\s+/g, ' ').slice(0, 220),
        publishedAt: post?.publishedAt || null
      }
    });
  } catch {
    /* ops optional */
  }
}

function isRecruitingIntelPost(text, post = null) {
  const t = String(text || '');
  if (!t.trim()) return false;
  const prefilter = require('./beat-intel-prefilter');
  if (prefilter.isTeamEventIntel(t, post)) return true;
  if (cancelParser.isVisitCancelPost(t)) return false;
  if (isVisitSchedulePost(t)) return true;
  if (beatFilters.hasPlayerSpecificBeatIntel(t)) return true;
  if (RECRUITING_INTEL_SIGNAL_RES.some((re) => re.test(t))) return true;
  if (prefilter.hasStrongRecruitingSignals(t, post)) return true;
  return false;
}

function resolveRecruitingEventType(text) {
  const t = String(text || '');
  // "Texas Tech commit … official visit to Florida" is a visit, not a UF commit.
  if (
    /\b(?:taking|take|takes|set for|scheduled for)\s+(?:an?\s+)?official visit\b/i.test(t) &&
    /\b(?:florida|gators|\buf\b|gainesville)\b/i.test(t)
  ) {
    return isOfficialVisitText(t) ? 'official_visit' : 'unofficial_visit';
  }
  if (/\b(?:committed|commits?)\s+to\s+(?:florida|the gators|\buf\b)/i.test(t)) return 'commit';
  if (/\bflip(?:ped)?\s+to\s+(?:florida|the gators|\buf\b)/i.test(t)) return 'commit';
  if (/\bdecommit/i.test(t)) return 'decommit';
  if (/\bportal\b/i.test(t) && /\b(florida|gators|\buf\b)/i.test(t)) return 'portal_in';
  if (/\boffer(?:ed|s)?\b/i.test(t)) return 'offer';
  if (/\b(prediction machine|futurecast|expert pick|rpm)\b/i.test(t)) return 'prediction';
  if (isOfficialVisitText(t)) return 'official_visit';
  if (UNOFFICIAL_VISIT_RE.test(t)) return 'unofficial_visit';
  if (isVisitSchedulePost(t)) return resolveEventType(t);
  return 'target_update';
}

function buildRecruitingStatus(eventType, text) {
  if (eventType === 'official_visit') return 'Official Visit · Florida';
  if (eventType === 'unofficial_visit') return 'Visit · Gainesville';
  if (eventType === 'commit') return 'Committed · Florida';
  if (eventType === 'decommit') return 'Decommitted';
  if (eventType === 'offer') return 'Offer · Florida';
  if (eventType === 'portal_in') return 'Portal · UF target';
  if (eventType === 'prediction') return 'Prediction · Florida';
  return 'Recruiting intel';
}

function isVisitSchedulePost(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (cancelParser.isVisitCancelPost(t)) return false;
  return VISIT_SIGNAL_RES.some((re) => re.test(t));
}

function parseVisitDate(text) {
  const t = String(text || '');
  for (const item of VISIT_DATE_RES) {
    const m = t.match(item.re);
    if (!m) continue;
    if (item.label) return item.label;
    return m[1] || m[0];
  }
  return null;
}

function parseSchool(text) {
  const m = String(text || '').match(SCHOOL_RE);
  return m ? m[1].trim() : null;
}

function parseClassYear(text) {
  const m = String(text || '').match(/\b(202[6-9]|2030)\b/);
  return m ? parseInt(m[1], 10) : null;
}

function parsePosition(text) {
  const m = String(text || '').match(/\b(202[6-9]|2030)\s+(?:\d+-Star\s+)?([A-Z]{1,4})\s+[A-Z]/);
  if (m) return m[2];
  const m2 = String(text || '').match(/\b(QB|RB|WR|TE|OL|OT|OG|C|DL|DT|DE|EDGE|LB|CB|S|ATH|K|P)\b/);
  return m2 ? m2[1] : null;
}

function parseStars(text) {
  const m = String(text || '').match(/\b([1-5])-Star\b/i);
  return m ? parseInt(m[1], 10) : null;
}

function isOfficialVisitText(text) {
  const t = String(text || '');
  if (/unofficial\s+visit|\buv\b/i.test(t)) return false;
  return /official\s+visit|\bov\b/i.test(t);
}

function resolveEventType(text) {
  if (isOfficialVisitText(text)) return 'official_visit';
  if (UNOFFICIAL_VISIT_RE.test(text)) return 'unofficial_visit';
  return 'official_visit';
}

const POS_PREFIX_RE =
  /^(?:QB|RB|WR|TE|OL|OT|OG|C|DL|DT|DE|EDGE|LB|CB|S|ATH|K|P)\s+(.+)$/i;

function isUsableExtractedName(name) {
  const { isValidPlayerName } = require('./x-autoposter-player-context');
  const n = String(name || '').trim();
  if (!isValidPlayerName(n)) return false;
  if (/\b(?:five|four|three|two|one|[1-5])[-\s]?star\b/i.test(n)) return false;
  return true;
}

function extractVisitPlayerName(text) {
  const t = String(text || '');
  const prefilter = require('./beat-intel-prefilter');

  const posNameRe = new RegExp(
    `\\b20\\d{2}\\s+(?:\\d+-[Ss]tar\\s+)?(?:QB|RB|WR|TE|OL|OT|OG|C|DL|DT|DE|EDGE|LB|CB|S|ATH|K|P)\\s+([A-Z][a-z'.-]+(?:\\s+[A-Z][a-z'.-]+){0,2})\\b`
  );
  const m = t.match(posNameRe);
  if (m?.[1] && isUsableExtractedName(m[1].trim())) return m[1].trim();

  const fromBeat = beatFilters.extractPlayerFromText(t);
  if (fromBeat) {
    const stripped = fromBeat.match(POS_PREFIX_RE);
    const candidate = (stripped ? stripped[1] : fromBeat).trim();
    if (isUsableExtractedName(candidate)) return candidate;
  }

  return prefilter.extractCleanFullName(t);
}

function parseBeatPostForVisitIntel(post, { logSkips = true } = {}) {
  const prefilter = require('./beat-intel-prefilter');
  const text = String(post.text || '').trim();
  const trusted = isVisitIngestWriter(post);

  if (!text) {
    if (logSkips) logBeatPostSkip(post, 'empty_text', 'non_player_intel');
    return null;
  }
  if (!isRecruitingIntelPost(text, post)) {
    if (logSkips) logBeatPostSkip(post, 'no_recruiting_signal', 'filtered');
    return null;
  }
  if (!trusted) {
    if (logSkips) logBeatPostSkip(post, 'untrusted_writer', 'filtered');
    return null;
  }
  if (!beatFilters.shouldIncludeBeatPost(post)) {
    if (logSkips) logBeatPostSkip(post, 'beat_filter_blocked', 'filtered');
    return null;
  }
  if (!beatFilters.isFloridaRelevantPost(post)) {
    if (logSkips) logBeatPostSkip(post, 'non_florida', 'filtered');
    return null;
  }
  if (prefilter.isGenericNonPlayerIntel(text) && !prefilter.hasStrongRecruitingSignals(text, post)) {
    if (logSkips) logBeatPostSkip(post, 'generic_phrase', 'non_player_intel');
    prefilter.logNonPlayerIntel({ text, reason: 'generic_phrase', source: post.handle || post.writerName });
    return null;
  }

  const teamGate = prefilter.evaluateTeamEventEligibility(text, { post });
  if (teamGate.eligible) {
    const timestamp = post.publishedAt || new Date().toISOString();
    const handle = String(post.handle || '').toLowerCase() || 'beat';
    const day = timestamp.slice(0, 10);
    const postKey = String(post.id || post.url || day).replace(/[^a-z0-9_-]/gi, '').slice(0, 32);
    const analystName = post.writerName || post.outlet || post.handle || 'Beat writer';
    return {
      triggerType: 'team_event',
      teamEventType: teamGate.teamEventType,
      playerName: null,
      playerSlug: null,
      on3Id: null,
      eventType: 'team_event',
      status: 'Team update',
      detail: text.replace(/\s+/g, ' ').slice(0, 280),
      timestamp,
      articleUrl: post.url || null,
      source: analystName,
      sourceHandle: post.handle || null,
      sourceType: 'beat',
      fingerprint: `team_event_${teamGate.teamEventType}_${day}_${handle}_${postKey}`
    };
  }

  let playerName = extractVisitPlayerName(text);
  if (!playerName || !isUsableExtractedName(playerName)) {
    const copy = require('./x-autoposter-copy');
    const fallback = copy.extractPlayerFromText(text);
    if (fallback && isUsableExtractedName(fallback)) playerName = fallback;
  }
  if ((!playerName || !isUsableExtractedName(playerName)) && !prefilter.hasStrongRecruitingSignals(text, post)) {
    if (logSkips) logBeatPostSkip(post, 'no_identifiable_player', 'non_player_intel');
    prefilter.logNonPlayerIntel({ text, reason: 'no_identifiable_player', source: post.handle || post.writerName });
    return null;
  }
  if (!playerName || !isUsableExtractedName(playerName)) {
    playerName = prefilter.extractCleanFullName(text) || null;
  }

  const resolver = require('./contextual-identity-resolver');
  const vagueClues = resolver.parseVagueClues(text, {
    playerName: playerName || '',
    stars: parseStars(text),
    pos: parsePosition(text),
    classYear: parseClassYear(text),
    school: parseSchool(text) || parseCollegeSchool(text)
  });

  const timestamp = post.publishedAt || new Date().toISOString();
  const handle = String(post.handle || '').toLowerCase() || 'beat';
  const day = timestamp.slice(0, 10);
  const postKey = String(post.id || post.url || day).replace(/[^a-z0-9_-]/gi, '').slice(0, 32);
  const resolvedName =
    playerName && isUsableExtractedName(playerName) ? playerName : playerName || 'Unknown prospect';
  const slugBase =
    playerName && isUsableExtractedName(playerName)
      ? slugify(resolvedName)
      : `beat-pending-${handle}-${postKey}`;
  const analystName = post.writerName || post.outlet || post.handle || 'Beat writer';
  const classYear = parseClassYear(text) || vagueClues?.classYear || 2027;
  const pos = parsePosition(text) || vagueClues?.pos || '';
  const school = parseSchool(text) || parseCollegeSchool(text) || vagueClues?.school || '';
  const visitDate = parseVisitDate(text);
  const eventType = resolveRecruitingEventType(text);

  return {
    playerName: resolvedName,
    playerSlug: slugBase,
    on3Id: null,
    classYear,
    pos,
    school,
    highSchool: school,
    stars: parseStars(text) || vagueClues?.stars || null,
    eventType,
    status: buildRecruitingStatus(eventType, text),
    visitStart: visitDate,
    visitEnd: null,
    detail: text.replace(/\s+/g, ' ').slice(0, 280),
    timestamp,
    articleUrl: post.url || null,
    source: analystName,
    sourceHandle: post.handle || null,
    sourceType: 'beat',
    fingerprint: `beat_${eventType}_${slugBase}_${day}_${handle}`
  };
}

async function buildAutoposterPayload(row, intelItem) {
  const copy = require('./x-autoposter-copy');
  if (row.triggerType === 'team_event' || row.eventType === 'team_event') {
    const built = await copy.buildTeamEventCopyAsync(
      {
        text: row.detail,
        writerName: row.source,
        handle: row.sourceHandle,
        url: row.articleUrl
      },
      { teamEventType: row.teamEventType }
    );
    if (!built?.text) {
      return { ok: false, reason: built?.skipReason || 'invalid_copy' };
    }
    return { ok: true, ...built, text: copy.appendSite(built.text) };
  }
  const built = await copy.buildIntelCopyAsync({
    id: intelItem?.id,
    eventType: row.eventType,
    playerName: row.playerName,
    playerSlug: row.playerSlug,
    playerId: row.on3Id,
    classYear: row.classYear,
    pos: row.pos,
    school: row.school,
    highSchool: row.highSchool,
    hometownState: row.hometownState,
    stars: row.stars,
    natlRank: row.natlRank,
    visitStart: row.visitStart,
    visitEnd: row.visitEnd,
    source: row.source,
    analystName: row.source,
    sourceHandle: row.sourceHandle,
    detail: row.detail,
    articleUrl: row.articleUrl
  });
  if (!built?.text) {
    if (built?.skipReason === 'non_player_intel' || built?._nonPlayerSkip) {
      return { ok: false, reason: 'non_player_intel' };
    }
    if (built?.skipReason === 'needs_resolution' || built?._needsResolution) {
      return { ok: false, reason: 'needs_resolution' };
    }
    return { ok: false, reason: built?.skipReason || 'invalid_copy' };
  }
  return { ok: true, ...built, text: copy.appendSite(built.text) };
}

async function queueAutoposter(row, intelItem, built) {
  try {
    const xStore = require('./x-autoposter-store');
    const policy = require('./x-autoposter-policy');
    const copy = require('./x-autoposter-copy');
    const fp = row.fingerprint;
    const isTeamEvent = row.triggerType === 'team_event' || row.eventType === 'team_event';
    if (
      !built?.text ||
      copy.isBrokenCopy(built.text, built) ||
      (!isTeamEvent && !copy.isValidPlayerName(row.playerName))
    ) {
      return { queued: false, reason: 'invalid_copy' };
    }
    const doc = xStore.loadQueue();
    const dup = doc.items.some(
      (i) => i.intelFingerprint === fp && (i.status === 'pending' || i.status === 'sent')
    );
    if (dup) return { queued: false, reason: 'duplicate' };

    const payload = {
      text: built.text,
      category: 'news',
      topic: isTeamEvent ? 'team' : 'recruiting',
      triggerType: isTeamEvent ? 'team_event' : null,
      teamEventType: row.teamEventType || null,
      sources: [{ label: row.source, url: row.articleUrl || SITE_URL }],
      source: isTeamEvent ? 'auto:team-event' : 'auto:beat-writer',
      intelFingerprint: fp,
      intelType: row.eventType,
      playerName: row.playerName || null,
      identityConfirmed: isTeamEvent ? true : undefined,
      sourceIntelId: intelItem?.id,
      scheduledAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      status: 'pending',
      templateBlocks: built.templateBlocks,
      validationMeta: built.validationMeta,
      playerContext: built.context || built.playerContext
    };
    const check = policy.validatePostContent(payload);
    if (!check.valid) return { queued: false, reason: 'policy', errors: check.errors };
    const out = xStore.enqueuePost(payload);
    return { queued: true, item: out.item };
  } catch (e) {
    return { queued: false, reason: e.message };
  }
}

/** Autoposter must not go silent on trusted beat-writer recruiting intel. */
const BEAT_SILENCE_ALLOWED = new Set([
  'duplicate',
  'intel_duplicate',
  'intel_exists',
  'non_player_intel',
  'snapshot',
  'stale',
  'false_commit_intel',
  'false_commit_queue'
]);

function hasRecruitingIntelSignal(text) {
  return RECRUITING_INTEL_SIGNAL_RES.some((re) => re.test(String(text || '')));
}

function inferBeatEventLabel(row) {
  const d = String(row.detail || row.status || row.eventType || '').toLowerCase();
  if (/official visit|\bov\b/.test(d)) return 'take an official visit to Gainesville';
  if (/unofficial|\buv\b/.test(d)) return 'visit campus';
  if (/commit|pledge/.test(d)) return 'commit to Florida';
  if (/decommit|flip/.test(d)) return 're-open his recruitment';
  if (/offer|verb/.test(d)) return 'receive an offer';
  if (/portal/.test(d)) return 'enter the transfer portal';
  if (/visit/.test(d)) return 'schedule a visit';
  return 'make a move in his recruitment';
}

async function queueBeatMonitoringFallback(row, skipReason) {
  if (!row?.fingerprint || BEAT_SILENCE_ALLOWED.has(skipReason)) {
    return { queued: false, reason: 'silence_allowed' };
  }
  const player = row.playerName || 'a Florida target';
  const event = inferBeatEventLabel(row);
  const text = `Per multiple reports, ${player} is expected to ${event}. Monitoring.`;
  try {
    const xStore = require('./x-autoposter-store');
    const policy = require('./x-autoposter-policy');
    const copy = require('./x-autoposter-copy');
    const fp = `monitor_${row.fingerprint}`;
    const doc = xStore.loadQueue();
    const dup = doc.items.some(
      (i) => i.intelFingerprint === fp && (i.status === 'pending' || i.status === 'sent')
    );
    if (dup) return { queued: false, reason: 'duplicate' };
    const payload = {
      text: copy.appendSite ? copy.appendSite(text) : `${text} ${SITE_URL}`,
      category: 'news',
      topic: 'recruiting',
      triggerType: 'beat_monitoring',
      sources: [{ label: row.source || row.sourceHandle || 'Beat writer', url: row.articleUrl || SITE_URL }],
      source: 'auto:beat-writer',
      intelFingerprint: fp,
      intelType: row.eventType || 'monitoring',
      playerName: row.playerName || null,
      identityConfirmed: false,
      monitoringFallback: true,
      skipReason,
      scheduledAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
      status: 'pending'
    };
    const check = policy.validatePostContent(payload);
    if (!check.valid) {
      payload.text = copy.appendSite ? copy.appendSite(text) : text;
    }
    const out = xStore.enqueuePost(payload);
    try {
      require('./ops-monitor').logEvent({
        subsystem: 'autoposter:beat-writer',
        status: 'monitoring_fallback',
        message: `Queued monitoring post (${skipReason})`,
        details: { playerName: row.playerName, fingerprint: row.fingerprint }
      });
    } catch {
      /* optional */
    }
    return { queued: true, item: out.item };
  } catch (e) {
    return { queued: false, reason: e.message };
  }
}

async function maybeQueueBeatMonitoring(row, skipReason, { trustedWriter = false } = {}) {
  if (!trustedWriter || !hasRecruitingIntelSignal(row.detail)) return null;
  return queueBeatMonitoringFallback(row, skipReason);
}

function parseCollegeSchool(text) {
  const resolver = require('./contextual-identity-resolver');
  return resolver.parseVagueClues(text).school;
}

async function processBeatVisitIntelRow(row, snapshot) {
  if (!row?.fingerprint) return { skipped: true, reason: 'invalid' };

  if (row.triggerType === 'team_event' || row.eventType === 'team_event') {
    if (snapshot.fingerprints[row.fingerprint]) {
      return { skipped: true, reason: 'duplicate', fingerprint: row.fingerprint };
    }
    const built = await buildAutoposterPayload(row, null);
    const autopost = built.ok
      ? await queueAutoposter(row, null, built)
      : { queued: false, reason: built.reason || 'copy_failed' };
    snapshot.fingerprints[row.fingerprint] = row.timestamp;
    return {
      processed: autopost.queued,
      skipped: !autopost.queued,
      teamEvent: true,
      teamEventType: row.teamEventType,
      autopost,
      fingerprint: row.fingerprint,
      reason: autopost.queued ? null : autopost.reason
    };
  }

  const prefilter = require('./beat-intel-prefilter');
  const trustedWriter = row.sourceHandle ? isVisitIngestWriter({ handle: row.sourceHandle }) : false;
  const skip = await prefilter.bypassRecruitingPipeline(row.detail, {
    playerName: row.playerName,
    playerSlug: row.playerSlug,
    source: row.sourceHandle || row.source,
    subsystem: 'autoposter:beat-writer',
    trustedWriter,
    post: { handle: row.sourceHandle, text: row.detail, url: row.articleUrl }
  });
  if (skip) {
    snapshot.fingerprints[row.fingerprint] = row.timestamp;
    logBeatPostSkip(
      { handle: row.sourceHandle, text: row.detail, url: row.articleUrl, publishedAt: row.timestamp },
      skip.nonPlayerIntel?.reason || 'non_player_intel',
      'non_player_intel'
    );
    return {
      skipped: true,
      reason: skip.nonPlayerIntel?.reason || 'non_player_intel',
      category: 'non_player_intel'
    };
  }

  const gate = await prefilter.evaluateBeatIntelEligibility(row.detail, {
    playerName: row.playerName,
    playerSlug: row.playerSlug,
    trustedWriter,
    post: { handle: row.sourceHandle, text: row.detail, url: row.articleUrl }
  });
  if (!gate.eligible) {
    snapshot.fingerprints[row.fingerprint] = row.timestamp;
    prefilter.logNonPlayerIntel({
      text: row.detail,
      reason: gate.reason,
      source: row.sourceHandle || row.source
    });
    logBeatPostSkip(
      { handle: row.sourceHandle, text: row.detail, url: row.articleUrl, publishedAt: row.timestamp },
      gate.reason,
      gate.category || 'non_player_intel'
    );
    const monitoringAutopost = await maybeQueueBeatMonitoring(row, gate.reason, { trustedWriter });
    return { skipped: true, reason: gate.reason, category: 'non_player_intel', monitoringAutopost };
  }
  row.playerName = gate.playerName;
  row.playerSlug = gate.playerSlug || row.playerSlug;

  if (!row.playerName) return { skipped: true, reason: 'invalid' };
  if (snapshot.fingerprints[row.fingerprint]) {
    return { skipped: true, reason: 'duplicate', fingerprint: row.fingerprint };
  }
  if (intelStore.hasIntelFingerprint(row.fingerprint)) {
    snapshot.fingerprints[row.fingerprint] = row.timestamp;
    return { skipped: true, reason: 'intel_duplicate' };
  }

  const existing = await store.getPlayerBySlug(row.playerSlug);

  const identityLookup = require('./player-identity-lookup');
  const enrichment = await identityLookup.enrichAndConfirmIntelIdentity({
    fields: {
      playerName: row.playerName,
      pos: row.pos || existing?.pos,
      classYear: row.classYear || existing?.classYear,
      highSchool: row.highSchool,
      hometownState: row.hometownState,
      school: row.school,
      stars: row.stars || existing?.stars,
      natlRank: row.natlRank || existing?.natlRank
    },
    playerName: row.playerName,
    playerSlug: row.playerSlug,
    row,
    intel: null,
    player: existing,
    intelId: null,
    classYear: row.classYear || existing?.classYear,
    beatText: row.detail,
    sourceHandle: row.sourceHandle,
    allowContextual: true
  });

  if (!enrichment.confirmed) {
    snapshot.fingerprints[row.fingerprint] = row.timestamp;
    if (enrichment.needs_resolution) {
      const snap = enrichment.mergedSnapshot || {};
      await intelStore.saveNeedsResolution({
        playerId: String(snap.on3Id || row.on3Id || row.playerSlug || 'pending'),
        playerSlug: snap.playerSlug || row.playerSlug,
        playerName: snap.playerName || row.playerName,
        classYear: snap.classYear || row.classYear,
        pos: snap.pos || row.pos,
        stars: snap.stars || row.stars,
        school: snap.school || row.school,
        highSchool: snap.highSchool || row.highSchool,
        hometownState: snap.hometownState || row.hometownState,
        eventType: enrichment.eventType || row.eventType,
        status: row.status,
        visitStart: row.visitStart,
        visitEnd: row.visitEnd,
        timestamp: row.timestamp,
        source: row.source,
        sourceHandle: row.sourceHandle,
        detail: enrichment.context || row.detail,
        fingerprint: row.fingerprint,
        articleUrl: row.articleUrl,
        missingFields: enrichment.missingFields || enrichment.missingAfter || [],
        resolutionAttemptedAt: new Date().toISOString()
      });
    }
    try {
      require('./ops-monitor').logEvent({
        subsystem: 'autoposter:beat-writer',
        status: enrichment.needs_resolution ? 'needs_resolution' : 'skipped',
        message: enrichment.reason || 'identity_not_confirmed',
        details: {
          playerName: row.playerName,
          eventType: row.eventType,
          stars: row.stars || existing?.stars,
          source: row.source,
          missingFields: enrichment.missingFields || enrichment.missingAfter || null,
          contextual: enrichment.contextual || null
        }
      });
    } catch {
      /* ops optional */
    }
    const monitoringAutopost = await maybeQueueBeatMonitoring(
      row,
      enrichment.reason || 'identity_not_confirmed',
      { trustedWriter }
    );
    return {
      skipped: true,
      needs_resolution: !!enrichment.needs_resolution,
      reason: enrichment.reason || 'identity_not_confirmed',
      player: row.playerSlug,
      source: row.source,
      confirmation: enrichment.confirmation || null,
      missingFields: enrichment.missingFields || enrichment.missingAfter || null,
      fingerprint: row.fingerprint,
      monitoringAutopost
    };
  }

  Object.assign(row, enrichment.identityPatch || {}, enrichment.intelPatch || {});
  if (enrichment.eventType) row.eventType = enrichment.eventType;
  if (enrichment.context) row.detail = enrichment.context;
  const confirmedName = enrichment.mergedSnapshot?.playerName || row.playerName;
  const confirmedSlug = enrichment.mergedSnapshot?.playerSlug || row.playerSlug;

  const recheck = await prefilter.evaluateBeatIntelEligibility(row.detail, {
    playerName: confirmedName,
    playerSlug: confirmedSlug,
    trustedWriter,
    post: { handle: row.sourceHandle, text: row.detail, url: row.articleUrl }
  });
  if (!recheck.eligible) {
    snapshot.fingerprints[row.fingerprint] = row.timestamp;
    prefilter.logNonPlayerIntel({
      text: row.detail,
      reason: recheck.reason,
      source: row.sourceHandle || row.source
    });
    logBeatPostSkip(
      { handle: row.sourceHandle, text: row.detail, url: row.articleUrl, publishedAt: row.timestamp },
      recheck.reason,
      recheck.category || 'non_player_intel'
    );
    const monitoringAutopost = await maybeQueueBeatMonitoring(row, recheck.reason, { trustedWriter });
    return { skipped: true, reason: recheck.reason, category: 'non_player_intel', monitoringAutopost };
  }
  row.playerName = recheck.playerName || confirmedName;
  row.playerSlug = recheck.playerSlug || confirmedSlug;

  const mergedPlayer = {
    ...(existing || {}),
    slug: row.playerSlug,
    name: row.playerName,
    pos: row.pos || existing?.pos,
    classYear: row.classYear || existing?.classYear,
    school: row.school || existing?.school,
    stars: row.stars || existing?.stars,
    natlRank: row.natlRank || existing?.natlRank,
    committedTo: existing?.committedTo || null
  };
  const copy = require('./recruiting-alert-templates').buildRecruitingCopy({
    player: mergedPlayer,
    existing,
    eventType: row.eventType,
    row
  });
  const identityValidator = require('./identity-record-validator');
  const safeSchool =
    identityValidator.sanitizeSchoolField(row.school) ||
    identityValidator.sanitizeSchoolField(existing?.school) ||
    null;
  const playerPatch = {
    slug: row.playerSlug,
    name: row.playerName,
    pos: row.pos || existing?.pos,
    classYear: row.classYear || existing?.classYear,
    school: safeSchool,
    fromSchool:
      identityValidator.sanitizeSchoolField(row.highSchool, { allowCollege: true }) ||
      identityValidator.sanitizeSchoolField(existing?.fromSchool, { allowCollege: true }) ||
      null,
    on3Id: row.on3Id || existing?.on3Id,
    on3ProfileUrl: existing?.on3ProfileUrl || buildOn3ProfileUrl(existing || row),
    stars: row.stars || existing?.stars,
    category: 'target',
    status: existing?.status || 'uncommitted',
    ufOvStatus: row.eventType === 'official_visit' ? 'scheduled' : existing?.ufOvStatus || 'visit',
    visitStart: row.visitStart || existing?.visitStart,
    visitEnd: row.visitEnd || existing?.visitEnd,
    skinny: copy.skinny,
    profileNote: copy.profileNote
  };
  const player = await store.upsertPlayer(playerPatch);

  const intelResult = await intelStore.addIntel({
    playerId: String(row.on3Id || player.on3Id || player.slug),
    playerSlug: player.slug,
    playerName: player.name,
    classYear: player.classYear,
    pos: player.pos,
    stars: row.stars || player.stars,
    school: row.school || player.school,
    highSchool: row.highSchool,
    eventType: row.eventType,
    status: row.status,
    visitStart: row.visitStart,
    visitEnd: row.visitEnd,
    timestamp: row.timestamp,
    source: row.source,
    sourceHandle: row.sourceHandle,
    detail: row.detail,
    fingerprint: row.fingerprint,
    articleUrl: row.articleUrl,
    identityConfirmed: true,
    identityConfirmationMode: enrichment.confirmation?.mode || enrichment.identityPatch?.identityResolutionMode
  });

  if (!intelResult.created && intelResult.duplicate) {
    snapshot.fingerprints[row.fingerprint] = row.timestamp;
    return { skipped: true, reason: 'intel_exists' };
  }

  if (intelResult.item?.id && enrichment.mergedSnapshot) {
    await identityLookup.persistIdentityToIntel(
      intelResult.item.id,
      enrichment.mergedSnapshot,
      enrichment.confirmation
    );
  }

  await store.createEvent({
    playerId: player.id,
    playerSlug: player.slug,
    eventType: row.eventType,
    title: `${player.name} — ${row.status || row.eventType}`,
    detail: copy.profileNote,
    skinny: copy.skinny,
    classYear: player.classYear,
    payload: { player, beatVisit: row },
    source: 'beat_writer_ingest'
  });

  liveStore.upsertFeedItem({
    id: `beat_intel_${row.fingerprint}`,
    dedupeKey: row.fingerprint,
    type: row.eventType?.includes('visit') ? 'visit' : 'beat',
    title: `${player.name} — ${row.status || row.eventType}`,
    summary: row.detail,
    source_url: row.articleUrl || `/player/${player.slug}`,
    source: row.source,
    author: row.source,
    createdAt: row.timestamp,
    meta: {
      eventType: row.eventType,
      playerSlug: player.slug,
      visitStart: row.visitStart,
      identityConfirmed: true
    }
  });

  const built = await buildAutoposterPayload(row, intelResult.item);
  const autopost = built.ok
    ? await queueAutoposter(row, intelResult.item, built)
    : { queued: false, reason: built.reason || 'copy_failed' };

  snapshot.fingerprints[row.fingerprint] = row.timestamp;

  try {
    require('./ops-monitor').logEvent({
      subsystem: 'autoposter:beat-writer',
      status: autopost.queued ? 'success' : 'skipped',
      message: autopost.queued ? `Queued OV/visit post: ${player.name}` : autopost.reason || 'not_queued',
      details: {
        playerName: player.name,
        eventType: row.eventType,
        stars: row.stars || player.stars,
        autopost,
        identityConfirmed: true
      }
    });
  } catch {
    /* ops optional */
  }

  return {
    processed: true,
    player: player.slug,
    source: row.source,
    autopost,
    identityConfirmed: true,
    fingerprint: row.fingerprint
  };
}

async function collectBeatVisitIntelRows({ posts = null, logSkips = false } = {}) {
  const beat = posts ? { posts } : getBeatPosts(80);
  const cutoff = Date.now() - 7 * 86400000;
  const rows = [];
  for (const post of beat.posts || []) {
    if (new Date(post.publishedAt).getTime() < cutoff) continue;
    const parsed = parseBeatPostForVisitIntel(post, { logSkips });
    if (parsed) rows.push(parsed);
  }
  return rows;
}

/** Re-scan last 20 posts per beat writer and ingest anything missed. */
async function runBeatLateIngestSweep() {
  const { fetchAllWriterPostsFresh } = require('./live-beat');
  const fresh = await fetchAllWriterPostsFresh({ maxPostsPerWriter: 20 });
  const cutoff = Date.now() - 48 * 3600000;
  const recentPosts = (fresh.posts || []).filter((p) => new Date(p.publishedAt).getTime() >= cutoff);

  const result = await runBeatWriterIngest({
    force: true,
    manualRows: [],
    posts: recentPosts,
    logSkips: true
  });

  return {
    ok: true,
    sweep: true,
    writersPolled: fresh.writerCount,
    postsFetched: fresh.posts?.length || 0,
    recentPosts: recentPosts.length,
    fetchErrors: fresh.fetchErrors,
    tokenStatus: fresh.tokenStatus,
    ...result
  };
}

async function runBeatWriterIngest({ force = false, manualRows = [], posts = null, logSkips = false } = {}) {
  const snapshot = loadSnapshot();
  const results = { processed: [], skipped: [], errors: [] };

  try {
    const purge = await intelStore.purgeIneligibleIntel();
    if (purge.removed) {
      const liveAgg = require('./live-aggregator');
      await liveAgg.purgeNonPlayerIntelFromLiveFeed();
    }
  } catch {
    /* optional */
  }

  let beatRows = [];
  try {
    beatRows = await collectBeatVisitIntelRows({ posts, logSkips });
  } catch (e) {
    results.errors.push({ stage: 'beat', error: e.message });
  }

  const byFp = new Map();
  [...manualRows, ...beatRows].forEach((row) => {
    if (row?.fingerprint) byFp.set(row.fingerprint, row);
  });

  const candidates = [...byFp.values()].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  for (const row of candidates) {
    try {
      const isNew = !snapshot.fingerprints[row.fingerprint];
      if (!force && !isNew) {
        results.skipped.push({ fingerprint: row.fingerprint, reason: 'snapshot' });
        continue;
      }
      const ageMs = Date.now() - new Date(row.timestamp).getTime();
      if (!force && ageMs > 14 * 86400000) {
        results.skipped.push({ fingerprint: row.fingerprint, reason: 'stale' });
        continue;
      }
      const out = await processBeatVisitIntelRow(row, snapshot);
      if (out.processed) results.processed.push(out);
      else {
        results.skipped.push(out);
        if (out.reason && out.reason !== 'duplicate' && out.reason !== 'snapshot') {
          logBeatPostSkip(
            { handle: row.sourceHandle, text: row.detail, url: row.articleUrl, publishedAt: row.timestamp },
            out.reason,
            out.category || 'ingest'
          );
        }
      }
    } catch (e) {
      results.errors.push({ player: row.playerName, error: e.message });
    }
  }

  saveSnapshot(snapshot);
  if (results.processed.length) clearHeatCheckCache();

  return {
    ok: true,
    ...results,
    processedCount: results.processed.length,
    lastRun: snapshot.lastRun
  };
}

async function ingestManualBeatVisitIntel(row) {
  const snapshot = loadSnapshot();
  const out = await processBeatVisitIntelRow(row, snapshot);
  saveSnapshot(snapshot);
  if (out.processed) clearHeatCheckCache();
  return out;
}

module.exports = {
  runBeatWriterIngest,
  runBeatLateIngestSweep,
  ingestManualBeatVisitIntel,
  processBeatVisitIntelRow,
  parseBeatPostForVisitIntel,
  resolveRecruitingEventType,
  isVisitIngestWriter,
  isVisitSchedulePost,
  isRecruitingIntelPost,
  logBeatPostSkip,
  VISIT_INGEST_HANDLES,
  SNAPSHOT_PATH
};
