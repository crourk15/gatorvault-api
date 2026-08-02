/**
 * Beat Writer Ingest — visit intel from trusted UF beat writers → intel store → autoposter.
 * Runs Player Identity Lookup + Confirmation before posting. Skips if unconfirmed.
 */
const fs = require('fs');
const path = require('path');
const { getBeatPosts } = require('./live-beat');
const beatFilters = require('./beat-writer-filters');
const ingestGate = require('./beat-recruiting-ingest-gate');
const cancelParser = require('./beat-visit-intel-parser');
const store = require('./recruiting-store');
const intelStore = require('./recruiting-intel-store');
const liveStore = require('./live-store');
const { invalidateRecruitingIntelCaches } = require('./recruiting-intel-cache');
const { buildOn3ProfileUrl } = require('./on3-urls');
const { slugify } = require('./slug');
const { enrichIntelCompetitors } = require('./recruiting-competitor-extract');
const { recordBeatDigDeeper } = require('./recruiting-dig-deeper-ingest');
const {
  enterPlayerIntel,
  upsertEarlyWatchEntry,
  isOnEarlyWatchlist,
} = require('./player-intel-entry');

/** Skips that should retry on a later ingest pass — do not burn snapshot fingerprint. */
const RETRYABLE_BEAT_SKIP_REASONS = new Set([
  'identity_not_confirmed',
  'generic_phrase',
  'no_identifiable_player',
  'single_name_only',
  'empty_text',
  'corrupted_headline',
  'beat_structure_copy',
]);

function shouldSnapshotBeatSkip(reason) {
  if (!reason) return true;
  if (RETRYABLE_BEAT_SKIP_REASONS.has(String(reason))) return false;
  if (String(reason).startsWith('identity')) return false;
  return true;
}

function markBeatSnapshot(snapshot, row, reason) {
  if (!shouldSnapshotBeatSkip(reason)) return;
  if (snapshot?.fingerprints && row?.fingerprint) {
    snapshot.fingerprints[row.fingerprint] = row.timestamp;
  }
}

const { resolveRecruitingDataDir, migrateRecruitingBundleIfNeeded } = require('./recruiting-data-dir');
const DATA_DIR = resolveRecruitingDataDir();
migrateRecruitingBundleIfNeeded(DATA_DIR);
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
  /\b(?:official visit|\bov\b|\buv\b|unofficial visit|on campus|in gainesville)\b/i,
  /\b(?:prediction machine|futurecast|expert pick|crystal ball|rpm|rivals)\b/i,
  /\b(?:recruiting battle|flip race|pulling ahead|leaning|momentum|heating up|staff loves)\b/i,
  /\b20\d{2}\s+(?:\d+-[Ss]tar\s+)?(?:QB|RB|WR|TE|OL|OT|OG|C|DL|DT|DE|EDGE|LB|CB|S|ATH)\s+[A-Z]/,
  /\b(?:Class of 20\d{2})\b/i
];

const HOME_VISIT_RE =
  /\b(?:home visit|in[- ]home(?:\s+visit)?|visited (?:him|her|them|the family) at home|coaches? (?:were |was )?in (?:the |his |her |their )?home|in the home with)\b/i;

const VISIT_SIGNAL_RES = [
  /(?:official\s+visit|\bov\b).*?(?:florida|gators|gainesville|\buf\b|the\s+swamp)/i,
  /(?:florida|gators|gainesville|\buf\b|the\s+swamp).*?(?:official\s+visit|\bov\b)/i,
  /(?:on\s+campus|in\s+gainesville|at\s+the\s+swamp|the\s+swamp).*?(?:today|tonight|this\s+weekend|friday|saturday|sunday|monday|tomorrow)/i,
  /(?:returning\s+to\s+gainesville|back\s+in\s+gainesville|arrived\s+in\s+gainesville)/i,
  /set\s+to\s+(?:officially\s+)?visit.*?(?:florida|gators|gainesville|\buf\b|the\s+swamp)/i,
  /(?:will|is\s+set\s+to|plans\s+to|scheduled\s+to)\s+(?:officially\s+)?visit.*?(?:florida|gators|gainesville|\buf\b)/i,
  /(?:taking|took|heads?\s+to|heading\s+to)\s+(?:an?\s+)?(?:official\s+)?visit.*?(?:florida|gators|gainesville|\buf\b)/i,
  // Coach in-home / living-room visits (scarce NCAA off-campus contacts).
  /(?:florida|gators|\buf\b).{0,60}(?:home visit|in[- ]home|in the home)/i,
  /(?:home visit|in[- ]home|in the home).{0,60}(?:florida|gators|\buf\b)/i,
];

// Do not treat historical "the swamp" highlight clips as unofficial visits.
const UNOFFICIAL_VISIT_RE = /unofficial\s+visit|\buv\b|on\s+campus|in\s+gainesville/i;

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
  return ingestGate.isAllowedIngestAccount(post);
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

const DETECTIVES_NO_HANDOFF = new Set([
  'missing_uf_context',
  'no_player_name',
  'other_program_without_uf',
  'disallowed_account',
  'no_football_signal',
  'duplicate',
  'intel_duplicate',
  'snapshot',
  'stale',
  'stale_intel'
]);

async function maybeHandoffBeatSkipToDetectives(post, reason, skipStage = 'beat_ingest') {
  const handoffReason = require('./autoposter/detectives-handoff').normalizeDetectivesHandoffReason(reason);
  if (!handoffReason || DETECTIVES_NO_HANDOFF.has(String(handoffReason))) return null;
  try {
    const det = require('./autoposter/detectives');
    const hints = {
      handle: post?.handle,
      writerName: post?.writerName || post?.outlet,
      url: post?.url,
      playerName: post?.playerName || null,
      playerSlug: post?.playerSlug || null,
      eventType: post?.eventType || null,
      beatFingerprint: post?.fingerprint || null
    };
    if (!det.detectivesEnabled() || !det.shouldHandoff(handoffReason, {
      beatPost: post,
      skipReason: handoffReason,
      skipStage,
      hints
    })) return null;
    return await det.handoffToDetectives({
      beatPost: post,
      skipReason: handoffReason,
      skipStage,
      hints
    });
  } catch {
    return null;
  }
}

function beatPostFromRow(row) {
  return {
    handle: row?.sourceHandle,
    writerName: row?.source,
    text: row?.detail || row?.text,
    url: row?.articleUrl,
    publishedAt: row?.timestamp,
    playerName: row?.playerName || null,
    playerSlug: row?.playerSlug || null,
    eventType: row?.eventType || null,
    fingerprint: row?.fingerprint || null
  };
}

function isRecruitingIntelPost(text, post = null) {
  const t = String(text || '');
  if (!t.trim()) return false;
  const prefilter = require('./beat-intel-prefilter');
  if (prefilter.isProgramNewsIntel(t, post)) return true;
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
  try {
    const commitDetect = require('./beat-writer-filters');
    if (commitDetect.isFloridaDecommitBeat(t)) return 'decommit';
    const commitType = commitDetect.resolveCommitEventType(t);
    if (commitType) return commitType;
  } catch {
    if (/\b(?:committed|commits?)\s+to\s+(?:florida|the gators|\buf\b)/i.test(t)) return 'commit';
    if (/\bflip(?:ped)?\s+to\s+(?:florida|the gators|\buf\b)/i.test(t)) return 'commit';
    if (/\bdecommit/i.test(t)) return 'decommit';
  }
  if (/\bportal\b/i.test(t) && /\b(florida|gators|\buf\b)/i.test(t)) return 'portal_in';
  try {
    const { isRetrospectiveOfferBeat, isFreshOfferBeat } = require('./autoposter/recruiting-offer-disambiguation');
    const { isRecruitingNarrativeBeat } = require('./autoposter/recruiting-narrative/narrative-gates');
    if (/\boffer(?:ed|s)?\b/i.test(t)) {
      if (isFreshOfferBeat(t)) return 'offer';
      if (isRetrospectiveOfferBeat(t) || isRecruitingNarrativeBeat(t)) return 'recruiting_narrative';
      return 'offer';
    }
    if (isRecruitingNarrativeBeat(t)) return 'recruiting_narrative';
  } catch {
    if (/\boffer(?:ed|s)?\b/i.test(t)) return 'offer';
  }
  if (/\b(prediction machine|futurecast|expert pick|rpm)\b/i.test(t)) return 'prediction';
  if (isHomeVisitText(t)) return 'home_visit';
  if (isOfficialVisitText(t)) return 'official_visit';
  if (UNOFFICIAL_VISIT_RE.test(t)) return 'unofficial_visit';
  if (isVisitSchedulePost(t)) return resolveEventType(t);
  return 'target_update';
}

function buildRecruitingStatus(eventType, text) {
  if (eventType === 'home_visit') return 'Home visit · Florida staff';
  if (eventType === 'official_visit') return 'Official Visit · Florida';
  if (eventType === 'unofficial_visit') return 'Visit · Gainesville';
  if (eventType === 'commit') return 'Committed · Florida';
  if (eventType === 'decommit') return 'Decommitted';
  if (eventType === 'offer') return 'Offer · Florida';
  if (eventType === 'recruiting_narrative') return 'Recruiting narrative · Florida';
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

const MONTH_MAP = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Parse visit windows like "June 11–13" or "from June 11-13". */
function parseVisitWindow(text) {
  const t = String(text || '');
  const classYear = parseClassYear(t);
  const year = classYear && classYear >= 2026 ? classYear - 1 : new Date().getFullYear();

  const range = t.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})\s*[–—-]\s*(\d{1,2})\b/i
  );
  if (range) {
    const month = MONTH_MAP[range[1].toLowerCase().replace(/\./g, '')];
    const visitStart = `${year}-${pad2(month)}-${pad2(range[2])}`;
    const visitEnd = `${year}-${pad2(month)}-${pad2(range[3])}`;
    return { visitStart, visitEnd, visitDates: `${visitStart} to ${visitEnd}` };
  }

  const fromRange = t.match(
    /from\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})\s*[–—-]\s*(\d{1,2})/i
  );
  if (fromRange) {
    const month = MONTH_MAP[fromRange[1].toLowerCase().replace(/\./g, '')];
    const visitStart = `${year}-${pad2(month)}-${pad2(fromRange[2])}`;
    const visitEnd = `${year}-${pad2(month)}-${pad2(fromRange[3])}`;
    return { visitStart, visitEnd, visitDates: `${visitStart} to ${visitEnd}` };
  }

  const single = parseVisitDate(t);
  if (single) {
    return { visitStart: single, visitEnd: null, visitDates: single };
  }
  return { visitStart: null, visitEnd: null, visitDates: null };
}

function parseSchool(text) {
  const t = String(text || '');
  const ofHs = t.match(
    /\b(?:of|from)\s+([A-Z][A-Za-z0-9'.&\-]+(?:\s+[A-Z][A-Za-z0-9'.&\-]+){0,5}\s+(?:Academy|High School|HS|Prep|Christian|Catholic))\b/
  );
  if (ofHs?.[1]) return ofHs[1].trim();
  const img = t.match(/\b(IMG Academy)\b/i);
  if (img) return 'IMG Academy';
  const m = t.match(SCHOOL_RE);
  return m ? m[1].trim() : null;
}

function parseClassYear(text) {
  const m = String(text || '').match(/\b(202[6-9]|203[0-5])\b/);
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

function isHomeVisitText(text) {
  const t = String(text || '');
  if (!HOME_VISIT_RE.test(t)) return false;
  // Prefer explicit Florida staff context; alone "home visit" without school is weak.
  return /\b(?:florida|gators|\buf\b)\b/i.test(t) || /\b(?:coach|staff|gators?)\b/i.test(t);
}

function isOfficialVisitText(text) {
  const t = String(text || '');
  if (isHomeVisitText(t)) return false;
  if (/unofficial\s+visit|\buv\b/i.test(t)) return false;
  return /official\s+visit|\bov\b/i.test(t);
}

function resolveEventType(text) {
  if (isHomeVisitText(text)) return 'home_visit';
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

function resolvePostTimestamp(post) {
  const candidates = [
    post?.publishedAt,
    post?.created_at,
    post?.createdAt,
    post?.timestamp,
    post?.date,
    post?.fetchedAt,
    post?.reportedAt
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const ms = new Date(raw).getTime();
    if (!Number.isNaN(ms)) return new Date(ms).toISOString();
  }
  return new Date().toISOString();
}

function parseBeatPostForVisitIntel(post, { logSkips = true } = {}) {
  const prefilter = require('./beat-intel-prefilter');
  const { parseOn3BeatUrlIdentity } = require('./on3-recruit-discovery');
  const text = String(post.text || '').trim();
  let urlIdentity = null;
  try {
    const teaserResolve = require('./beat-teaser-resolve');
    urlIdentity = teaserResolve.parseSyncOn3Identity(post);
  } catch {
    urlIdentity = null;
  }
  if (!urlIdentity) urlIdentity = parseOn3BeatUrlIdentity(text, post.url);

  if (!text) {
    if (logSkips) logBeatPostSkip(post, 'empty_text', 'non_player_intel');
    return null;
  }

  if (prefilter.isSubscribePromoIntel?.(text)) {
    if (logSkips) logBeatPostSkip(post, 'subscribe_promo', 'non_player_intel');
    return null;
  }

  if (prefilter.isProgramNewsIntel(text, post)) {
    const gate = prefilter.evaluateProgramNewsEligibility(text, { post });
    if (!gate.eligible) {
      if (logSkips) logBeatPostSkip(post, gate.reason || 'not_program_news', 'non_player_intel');
      return null;
    }
    const timestamp = resolvePostTimestamp(post);
    const handle = String(post.handle || '').toLowerCase() || 'beat';
    const day = timestamp.slice(0, 10);
    const postKey = String(post.id || post.url || day)
      .replace(/[^a-z0-9_-]/gi, '')
      .slice(0, 32);
    const analystName = post.writerName || post.outlet || post.handle || 'Beat writer';
    const detail = text.replace(/\s+/g, ' ').slice(0, 280);
    return {
      playerName: null,
      playerSlug: null,
      eventType: 'program_news',
      triggerType: 'program_news',
      programNewsType: gate.programNewsType || 'general',
      status: prefilter.classifyProgramNewsType(text) || gate.programNewsType || 'general',
      detail,
      text: detail,
      timestamp,
      articleUrl: post.url || null,
      source: analystName,
      sourceHandle: post.handle || null,
      sourceType: 'beat',
      fingerprint: `program_news_${gate.programNewsType || 'general'}_${postKey}_${day}_${handle}`
    };
  }

  if (prefilter.isTeamEventIntel(text, post)) {
    // Player-specific recruiting intel (named prospect + visit/offer/target) must not be
    // swallowed as a bare team_event just because it mentions Friday Night Lights / camp.
    const namedProspect = extractVisitPlayerName(text);
    const playerRecruitSignal =
      namedProspect &&
      isUsableExtractedName(namedProspect) &&
      /\b(offer|offers|visit|visits|ov|official visit|unofficial|commit|commitment|target|targets|recruit|recruiting|in the mix|near the top)\b/i.test(
        text
      );
    if (!playerRecruitSignal) {
      const gate = prefilter.evaluateTeamEventEligibility(text, { post });
      if (!gate.eligible) {
        if (logSkips) logBeatPostSkip(post, gate.reason || 'not_team_event', 'non_player_intel');
        return null;
      }
      const timestamp = resolvePostTimestamp(post);
      const handle = String(post.handle || '').toLowerCase() || 'beat';
      const day = timestamp.slice(0, 10);
      const postKey = String(post.id || post.url || day)
        .replace(/[^a-z0-9_-]+/gi, '')
        .slice(0, 32);
      const analystName = post.writerName || post.outlet || post.handle || 'Beat writer';
      const detail = text.replace(/\s+/g, ' ').slice(0, 280);
      return {
        playerName: null,
        playerSlug: null,
        eventType: 'team_event',
        triggerType: 'team_event',
        teamEventType: gate.teamEventType || 'general',
        status: prefilter.classifyTeamEventType(text) || gate.teamEventType || 'general',
        detail,
        text: detail,
        timestamp,
        articleUrl: post.url || null,
        source: analystName,
        sourceHandle: post.handle || null,
        sourceType: 'beat',
        fingerprint: `team_event_${gate.teamEventType || 'general'}_${postKey}_${day}_${handle}`
      };
    }
  }

  // Fresh offer announcements must NOT take the thin narrative path
  // (coach "relationship with" language used to mis-route Blake Alderman offers).
  let freshOfferAnnounce = false;
  try {
    const { isFreshOfferBeat } = require('./autoposter/recruiting-offer-disambiguation');
    freshOfferAnnounce = isFreshOfferBeat(text);
  } catch {
    freshOfferAnnounce = /\b(?:has|have)\s+offered\b/i.test(text);
  }

  if (!freshOfferAnnounce && prefilter.isRecruitingNarrativeEliteIntel(text, post)) {
    const gate = prefilter.evaluateRecruitingNarrativeEliteEligibility(text, { post });
    if (!gate.eligible) {
      if (logSkips) logBeatPostSkip(post, gate.reason || 'not_recruiting_narrative', 'filtered');
      return null;
    }
    const timestamp = resolvePostTimestamp(post);
    const handle = String(post.handle || '').toLowerCase() || 'beat';
    const day = timestamp.slice(0, 10);
    const postKey = String(post.id || post.url || day)
      .replace(/[^a-z0-9_-]/gi, '')
      .slice(0, 32);
    const analystName = post.writerName || post.outlet || post.handle || 'Beat writer';
    const detail = text.replace(/\s+/g, ' ').slice(0, 280);
    const playerName = gate.playerName || extractVisitPlayerName(text);
    const slugBase = playerName
      ? playerName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      : null;
    return {
      playerName,
      playerSlug: slugBase,
      eventType: 'recruiting_narrative',
      triggerType: 'recruiting_narrative_elite',
      status: buildRecruitingStatus('recruiting_narrative', text),
      detail,
      text: detail,
      timestamp,
      articleUrl: (require('./beat-teaser-resolve').pickOn3ArticleUrl(post) || post.url || null),
      source: analystName,
      sourceHandle: post.handle || null,
      sourceType: 'beat',
      fingerprint: `recruiting_narrative_${postKey}_${day}_${handle}`
    };
  }

  if (prefilter.isPortalEliteIntel(text, post)) {
    const gate = prefilter.evaluatePortalEliteEligibility(text, { post });
    if (!gate.eligible) {
      if (logSkips) logBeatPostSkip(post, gate.reason || 'not_portal_elite', 'filtered');
      return null;
    }
    const timestamp = resolvePostTimestamp(post);
    const handle = String(post.handle || '').toLowerCase() || 'beat';
    const day = timestamp.slice(0, 10);
    const postKey = String(post.id || post.url || day)
      .replace(/[^a-z0-9_-]/gi, '')
      .slice(0, 32);
    const analystName = post.writerName || post.outlet || post.handle || 'Beat writer';
    const detail = text.replace(/\s+/g, ' ').slice(0, 280);
    const playerName = gate.playerName || extractVisitPlayerName(text);
    const slugBase = playerName
      ? playerName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      : null;
    return {
      playerName,
      playerSlug: slugBase,
      eventType: gate.portalEventType || 'portal_in',
      triggerType: 'portal_elite',
      portalEventType: gate.portalEventType || 'portal_in',
      status: buildRecruitingStatus(gate.portalEventType || 'portal_in', text),
      detail,
      text: detail,
      timestamp,
      articleUrl: post.url || null,
      source: analystName,
      sourceHandle: post.handle || null,
      sourceType: 'beat',
      fingerprint: `portal_elite_${gate.portalEventType || 'portal_in'}_${postKey}_${day}_${handle}`
    };
  }

  const strict = ingestGate.evaluateStrictRecruitingIngestGate(post, text);
  if (!strict.pass) {
    if (logSkips) logBeatPostSkip(post, strict.reason, 'filtered');
    try {
      const { safeEnqueueUnresolvedPrediction } = require('./unresolved-predictions-detect');
      const teaserResolve = require('./beat-teaser-resolve');
      const articleUrl = teaserResolve.pickOn3ArticleUrl(post) || post.url || null;
      safeEnqueueUnresolvedPrediction({
        reason: strict.reason || 'strict_gate_fail',
        source: 'beat-writer-ingest',
        title: String(text || '').replace(/\s+/g, ' ').slice(0, 160) || 'Beat prediction (gate fail)',
        textPreview: text,
        url: articleUrl,
        handle: post.handle || null,
        writerName: post.writerName || null,
        eventType: 'prediction',
        fingerprint: `beat_gate_${String(post.id || post.url || text).slice(0, 80)}`,
      });
    } catch {
      /* never block ingest */
    }
    return null;
  }

  let playerName = null;
  // Prefer beat-text casing over On3 slug Title Case ("Foster Ii").
  const textName = extractVisitPlayerName(text);
  if (textName && isUsableExtractedName(textName)) playerName = textName;
  if (!playerName && post._teaserResolved?.playerName && isUsableExtractedName(post._teaserResolved.playerName)) {
    playerName = post._teaserResolved.playerName;
  }
  if (!playerName && urlIdentity?.playerName && isUsableExtractedName(urlIdentity.playerName)) {
    playerName = urlIdentity.playerName;
  }
  if (!playerName) {
    try {
      const teaserResolve = require('./beat-teaser-resolve');
      const cleanedHit = teaserResolve.resolvePlayerFromBeatPostSync(post);
      if (cleanedHit?.playerName && isUsableExtractedName(cleanedHit.playerName)) {
        playerName = cleanedHit.playerName;
      }
    } catch {
      /* optional */
    }
  }
  // Never keep a cousin/relative name as the prospect.
  try {
    const teaserResolve = require('./beat-teaser-resolve');
    if (playerName && teaserResolve.isRelationalMention(text, playerName)) {
      playerName = post._teaserResolved?.playerName || urlIdentity?.playerName || null;
      if (playerName && teaserResolve.isRelationalMention(text, playerName)) playerName = null;
    }
  } catch {
    /* optional */
  }
  if (!playerName || !isUsableExtractedName(playerName)) {
    const copy = require('./x-autoposter-copy');
    const fallback = copy.extractPlayerFromText(text);
    if (fallback && isUsableExtractedName(fallback)) playerName = fallback;
  }
  if (!playerName || !isUsableExtractedName(playerName)) {
    const syncHit = ingestGate.resolvePlayerFromTextSync(text);
    if (syncHit?.playerName && isUsableExtractedName(syncHit.playerName)) {
      playerName = syncHit.playerName;
    }
  }
  if (
    (!playerName || !isUsableExtractedName(playerName)) &&
    !urlIdentity?.playerSlug &&
    !prefilter.hasStrongRecruitingSignals(text, post)
  ) {
    if (logSkips) logBeatPostSkip(post, 'no_identifiable_player', 'non_player_intel');
    prefilter.logNonPlayerIntel({ text, reason: 'no_identifiable_player', source: post.handle || post.writerName });
    try {
      const { safeEnqueueUnresolvedPrediction } = require('./unresolved-predictions-detect');
      safeEnqueueUnresolvedPrediction({
        reason: 'no_identifiable_player',
        source: 'beat-writer-ingest',
        title: String(text || '').replace(/\s+/g, ' ').slice(0, 160) || 'Beat prediction (no player)',
        textPreview: text,
        url: post.url || null,
        handle: post.handle || null,
        writerName: post.writerName || null,
        eventType: 'prediction',
        fingerprint: `beat_noid_${String(post.id || post.url || text).slice(0, 80)}`,
      });
    } catch {
      /* never block ingest */
    }
    return null;
  }
  if (!playerName || !isUsableExtractedName(playerName)) {
    playerName = urlIdentity?.playerName || prefilter.extractCleanFullName(text) || null;
  }

  const resolver = require('./contextual-identity-resolver');
  const vagueClues = resolver.parseVagueClues(text, {
    playerName: playerName || '',
    stars: urlIdentity?.stars || parseStars(text),
    pos: urlIdentity?.pos || parsePosition(text),
    classYear: urlIdentity?.classYear || parseClassYear(text),
    school: parseSchool(text) || parseCollegeSchool(text)
  });

  const timestamp = resolvePostTimestamp(post);
  const handle = String(post.handle || '').toLowerCase() || 'beat';
  const day = timestamp.slice(0, 10);
  const postKey = String(post.id || post.url || day).replace(/[^a-z0-9_-]/gi, '').slice(0, 32);
  const syncRoster = ingestGate.resolvePlayerFromTextSync(text);
  const resolvedName =
    playerName && isUsableExtractedName(playerName)
      ? playerName
      : syncRoster?.playerName && isUsableExtractedName(syncRoster.playerName)
        ? syncRoster.playerName
        : urlIdentity?.playerName || playerName || 'Unknown prospect';
  const slugBase = urlIdentity?.playerSlug
    ? urlIdentity.playerSlug
    : playerName && isUsableExtractedName(playerName)
      ? slugify(resolvedName)
      : syncRoster?.playerSlug || `beat-pending-${handle}-${postKey}`;
  const analystName = post.writerName || post.outlet || post.handle || 'Beat writer';
  const classYear =
    urlIdentity?.classYear ||
    parseClassYear(text) ||
    syncRoster?.classYear ||
    ingestGate.matchRosterByName(resolvedName)?.classYear ||
    vagueClues?.classYear ||
    2028;
  const pos = urlIdentity?.pos || parsePosition(text) || vagueClues?.pos || '';
  const school = parseSchool(text) || parseCollegeSchool(text) || vagueClues?.school || '';
  const visitDate = parseVisitDate(text);
  const visitWindow = parseVisitWindow(text);
  const eventType = resolveRecruitingEventType(text);
  const on3ArticleUrl = urlIdentity?.on3ArticleUrl || null;

  return {
    playerName: resolvedName,
    playerSlug: slugBase,
    on3Id: null,
    on3RecruitSlug: urlIdentity?.on3RecruitSlug || null,
    classYear,
    pos,
    school,
    highSchool: school,
    stars: urlIdentity?.stars || parseStars(text) || vagueClues?.stars || null,
    eventType,
    status: buildRecruitingStatus(eventType, text),
    visitStart: visitWindow.visitStart || visitDate,
    visitEnd: visitWindow.visitEnd,
    visitDates: visitWindow.visitDates,
    ufRelevant: true,
    text: text.replace(/\s+/g, ' ').slice(0, 280),
    detail: text.replace(/\s+/g, ' ').slice(0, 280),
    timestamp,
    articleUrl: on3ArticleUrl || post.url || null,
    source: analystName,
    sourceHandle: post.handle || null,
    sourceType: 'beat',
    on3UrlIdentity: urlIdentity?.source || null,
    fingerprint: `beat_${eventType}_${slugBase}_${day}_${handle}`
  };
}

async function buildAutoposterPayload(row, intelItem) {
  const copy = require('./x-autoposter-copy');
  if (row.triggerType === 'program_news' || row.eventType === 'program_news') {
    const built = await copy.buildProgramNewsCopyAsync(
      {
        text: row.detail,
        writerName: row.source,
        handle: row.sourceHandle,
        url: row.articleUrl
      },
      { programNewsType: row.programNewsType }
    );
    if (!built?.text) {
      return { ok: false, reason: built?.skipReason || 'invalid_copy' };
    }
    return { ok: true, ...built };
  }
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
    return { ok: true, ...built };
  }
  if (row.triggerType === 'portal_elite' || row.portalEventType) {
    const built = await copy.buildPortalCopyAsync(
      {
        text: row.detail,
        writerName: row.source,
        handle: row.sourceHandle,
        url: row.articleUrl
      },
      {
        portalEventType: row.portalEventType || row.eventType,
        playerName: row.playerName,
        playerSlug: row.playerSlug
      }
    );
    if (!built?.text) {
      return { ok: false, reason: built?.skipReason || 'invalid_copy' };
    }
    return { ok: true, ...built };
  }
  if (row.triggerType === 'recruiting_narrative_elite' || row.eventType === 'recruiting_narrative') {
    const built = await copy.buildRecruitingNarrativeCopyAsync(
      {
        text: row.detail,
        writerName: row.source,
        handle: row.sourceHandle,
        url: row.articleUrl
      },
      {
        playerName: row.playerName,
        playerSlug: row.playerSlug
      }
    );
    if (!built?.text) {
      return { ok: false, reason: built?.skipReason || 'invalid_copy' };
    }
    return { ok: true, ...built };
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
    articleUrl: row.articleUrl,
    timestamp: row.timestamp || intelItem?.timestamp || intelItem?.createdAt || null,
    sourcePublishedAt: row.timestamp || intelItem?.timestamp || null,
    publishedAt: row.timestamp || intelItem?.timestamp || null
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
  return { ok: true, ...built };
}

function isNonPlayerBeatRow(row) {
  return (
    row?.triggerType === 'team_event' ||
    row?.eventType === 'team_event' ||
    row?.triggerType === 'program_news' ||
    row?.eventType === 'program_news'
  );
}

async function queueAutoposter(row, intelItem, built) {
  try {
    const xStore = require('./x-autoposter-store');
    const policy = require('./x-autoposter-policy');
    const copy = require('./x-autoposter-copy');
    const postSpec = require('./x-autoposter-post-spec');
    const dataLayer = require('./x-autoposter-data-layer');
    const sentLedger = require('./x-autoposter-sent-ledger');
    const { commitFingerprint } = require('./commit-fingerprint');
    const fp = row.fingerprint;
    const isProgramNews = row.triggerType === 'program_news' || row.eventType === 'program_news';
    const isTeamEvent = row.triggerType === 'team_event' || row.eventType === 'team_event';
    const isPortalElite = row.triggerType === 'portal_elite' || row.portalEventType;
    const isNonPlayerBeat = isProgramNews || isTeamEvent;
    if (
      !built?.text ||
      copy.isBrokenCopy(built.text, built) ||
      (!isNonPlayerBeat && !copy.isValidPlayerName(row.playerName))
    ) {
      return { queued: false, reason: 'invalid_copy' };
    }
    if (!isNonPlayerBeat) {
      try {
        const qa = require('./autoposter/recruiting-post-qa');
        const qaCandidate = {
          ...built,
          topic: 'recruiting',
          playerName: row.playerName,
          playerSlug: row.playerSlug,
          source: 'auto:beat-writer'
        };
        if (qa.isRecruitingPlayerCandidate(qaCandidate) && !qa.passesPublishGate(qaCandidate)) {
          return { queued: false, reason: 'recruiting_qa', detail: qa.rejectReason(qaCandidate) };
        }
      } catch {
        /* optional */
      }
    }
    if (
      !isNonPlayerBeat &&
      (row.playerSlug || row.playerName) &&
      (sentLedger.isCommitAnnouncementText(built.text) ||
        /commit|pledge|shutting it down/i.test(String(row.eventType || row.detail || '')))
    ) {
      const slug = String(row.playerSlug || '').toLowerCase();
      const cfp = commitFingerprint({
        slug,
        committedTo: 'Florida',
        commitDate: row.timestamp ? String(row.timestamp).slice(0, 10) : null,
      });
      if (
        sentLedger.hasRecentSentCommit({
          slug,
          commitFingerprint: cfp,
          text: built.text,
          eventType: 'commit',
        })
      ) {
        return { queued: false, reason: 'commit_already_posted' };
      }
    }
    const doc = xStore.loadQueue();
    const dup = doc.items.some(
      (i) => i.intelFingerprint === fp && (i.status === 'pending' || i.status === 'sent')
    );
    if (dup) return { queued: false, reason: 'duplicate' };

    const eventMs = row.timestamp ? new Date(row.timestamp).getTime() : null;
    const fresh = dataLayer.assertIntelFresh({
      timestamp: row.timestamp,
      sourceEventCreatedAt: row.timestamp,
      sourceType: row.sourceType || 'beat',
      sourceHandle: row.sourceHandle,
      source: row.source,
      detail: row.detail || row.text,
      beatText: row.text || row.detail,
      playerName: row.playerName,
      playerSlug: row.playerSlug,
      identityConfirmed: row.identityConfirmed
    });
    if (!fresh.ok) {
      let allowComposedBeat = false;
      if (!isNonPlayerBeat && built?.text) {
        try {
          const qa = require('./autoposter/recruiting-post-qa');
          const qaCandidate = {
            ...built,
            topic: 'recruiting',
            playerName: row.playerName,
            playerSlug: row.playerSlug,
            source: 'auto:beat-writer'
          };
          allowComposedBeat =
            !qa.isRecruitingPlayerCandidate(qaCandidate) ||
            (qa.passesPublishGate(qaCandidate) &&
              (!row.text ||
                !built.validationMeta?.beatText ||
                built.validationMeta?.eliteBeatIntel ||
                built.validationMeta?.beatIntelAngle));
        } catch {
          allowComposedBeat = !!(built.validationMeta?.eliteCompose || built.validationMeta?.eliteMode);
        }
      }
      if (!allowComposedBeat) {
        console.log(`[beat-writer-ingest] skip autoposter: ${fresh.logTag || fresh.skipReason} — ${fresh.reason}`);
        return { queued: false, reason: fresh.skipReason || 'stale_intel' };
      }
    }

    const similar = postSpec.findSimilarInQueue(built.text, doc.items);
    if (similar.hit) {
      return { queued: false, reason: 'similar_post', similarity: similar.similarity };
    }

    const payload = {
      text: built.text,
      category: 'news',
      topic: isProgramNews ? 'program' : isTeamEvent ? 'team' : isPortalElite ? 'portal' : 'recruiting',
      triggerType: isProgramNews
        ? 'program_news'
        : isTeamEvent
          ? 'team_event'
          : isPortalElite
            ? 'portal_elite'
            : null,
      teamEventType: row.teamEventType || null,
      programNewsType: row.programNewsType || null,
      portalEventType: row.portalEventType || null,
      sources: [{ label: row.source, url: row.articleUrl || SITE_URL }],
      source: isProgramNews
        ? 'auto:program-news'
        : isTeamEvent
          ? 'auto:team-event'
          : isPortalElite
            ? 'auto:portal-elite'
            : 'auto:beat-writer',
      intelFingerprint: fp,
      intelType: row.eventType,
      playerName: row.playerName || null,
      playerSlug: row.playerSlug || null,
      classYear: row.classYear || null,
      identityConfirmed: isNonPlayerBeat ? true : row.identityConfirmed !== false,
      postUrgency: isProgramNews ? 'breaking' : null,
      urgencyLabel: isProgramNews ? 'breaking' : isTeamEvent ? 'major_beat' : isPortalElite ? 'portal' : null,
      sourceEventType: isProgramNews
        ? 'program_news'
        : isTeamEvent
          ? 'team_event'
          : isPortalElite
            ? row.portalEventType || 'portal_in'
            : row.eventType,
      sourceIntelId: intelItem?.id,
      sourceEventCreatedAt: row.timestamp || intelItem?.timestamp || null,
      sourcePublishedAt: row.timestamp || null,
      publishedAt: row.timestamp || null,
      timestamp: row.timestamp || null,
      situation: built.validationMeta?.situation || postSpec.detectSituation(built.text, row.eventType),
      scheduledAt: new Date(Date.now() + (isProgramNews ? 60 : 2) * 60 * 1000).toISOString(),
      status: 'pending',
      templateBlocks: built.templateBlocks,
      validationMeta: { ...(built.validationMeta || {}), beatText: row.text || row.detail || null },
      playerContext: built.context || built.playerContext,
      qualityScore: built.qualityScore ?? null,
      qualityBreakdown: built.qualityBreakdown ?? null,
      sourceConfidence: built.sourceConfidence ?? null
    };

    const validation = require('./x-autoposter-validation');
    const qualityGate = validation.passesNewsQualityGate(payload);
    if (!qualityGate.pass) {
      console.warn('[beat-writer-ingest] autoposter quality gate failed', {
        player: row.playerName,
        fingerprint: fp,
        skips: qualityGate.skips?.map((s) => s.type)
      });
      return { queued: false, reason: 'quality_gate', skips: qualityGate.skips };
    }

    const gm2 = require('./gm2');
    if (!gm2.filterAutoposterCandidate(payload)) {
      return { queued: false, reason: 'gm2_rejected' };
    }

    const check = policy.validatePostContent(payload);
    if (!check.valid) return { queued: false, reason: 'policy', errors: check.errors };
    const out = xStore.enqueuePost(payload);
    if (intelItem?.id) {
      const intelStore = require('./recruiting-intel-store');
      intelStore.markIntelXPostQueued(intelItem.id, { queueItemId: out.item.id });
    }
    return { queued: true, item: out.item };
  } catch (e) {
    return { queued: false, reason: e.message };
  }
}

/** Existing intel with no durable queue row should retry autopost + Detectives. */
function intelAutopostPending(intelItem) {
  if (!intelItem) return true;
  if (intelItem.xPosted) return false;
  if (!intelItem.xPostQueued) return true;
  try {
    const xStore = require('./x-autoposter-store');
    const queueDoc = xStore.loadQueue();
    const hasMatch = queueDoc.items.some(
      (q) =>
        (q.sourceIntelId === intelItem.id || q.intelFingerprint === intelItem.fingerprint) &&
        ['pending', 'sent', 'failed', 'skipped_duplicate'].includes(q.status)
    );
    return !hasMatch;
  } catch {
    return true;
  }
}

async function attemptBeatAutoposterAndHandoff(row, intelItem, player) {
  const built = await buildAutoposterPayload(row, intelItem);
  const autopost = built.ok
    ? await queueAutoposter(row, intelItem, built)
    : { queued: false, reason: built.reason || 'copy_failed' };

  let detectivesHandoff = null;
  const skipReason = built?.reason || autopost?.reason || null;
  if (!autopost.queued && skipReason && !BEAT_SILENCE_ALLOWED.has(skipReason)) {
    const beatPost = beatPostFromRow(row);
    logBeatPostSkip(beatPost, skipReason, 'autopost');
    detectivesHandoff = await maybeHandoffBeatSkipToDetectives(beatPost, skipReason, 'autopost');
  }

  try {
    require('./ops-monitor').logEvent({
      subsystem: 'autoposter:beat-writer',
      status: autopost.queued ? 'success' : 'skipped',
      message: autopost.queued
        ? `Queued OV/visit post: ${player.name}`
        : autopost.reason || 'not_queued',
      details: {
        playerName: player.name,
        eventType: row.eventType,
        stars: row.stars || player.stars,
        autopost,
        detectivesHandoff: detectivesHandoff
          ? { ok: detectivesHandoff.ok, caseId: detectivesHandoff.case?.id, created: detectivesHandoff.created }
          : null,
        identityConfirmed: true,
        intelRetry: !!intelItem && !intelItem.created
      }
    });
  } catch {
    /* ops optional */
  }

  return { built, autopost, detectivesHandoff };
}

/** Autoposter must not go silent on trusted beat-writer recruiting intel. */
const BEAT_SILENCE_ALLOWED = new Set([
  'duplicate',
  'intel_duplicate',
  'intel_exists',
  'non_player_intel',
  'snapshot',
  'stale',
  'stale_intel',
  'non_uf_intel',
  'similar_post',
  'commit_already_posted',
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

async function queueProgramNewsMonitoringFallback(row) {
  const brand = require('./x-autoposter-brand');
  if (!brand.monitoringFallbackAllowed()) return { queued: false, reason: 'monitoring_disabled' };
  if (!row?.fingerprint) return { queued: false, reason: 'invalid' };
  const template = require('./x-autoposter-template');
  const eventSummary = template.inferProgramNewsEvent(row.detail, row.programNewsType);
  const text = `Per multiple reports, Florida has announced ${eventSummary}. Monitoring.`;
  try {
    const xStore = require('./x-autoposter-store');
    const policy = require('./x-autoposter-policy');
    const copy = require('./x-autoposter-copy');
    const fp = `program_monitor_${row.fingerprint}`;
    const doc = xStore.loadQueue();
    const dup = doc.items.some(
      (i) => i.intelFingerprint === fp && (i.status === 'pending' || i.status === 'sent')
    );
    if (dup) return { queued: false, reason: 'duplicate' };
    const payload = {
      text: copy.appendSite ? copy.appendSite(text) : `${text} ${SITE_URL}`,
      category: 'news',
      topic: 'program',
      triggerType: 'program_news',
      programNewsType: row.programNewsType || 'general',
      sources: [{ label: row.source || row.sourceHandle || 'Beat writer', url: row.articleUrl || SITE_URL }],
      source: 'auto:program-news',
      intelFingerprint: fp,
      intelType: 'program_news',
      sourceEventType: 'program_news',
      playerName: null,
      identityConfirmed: true,
      monitoringFallback: true,
      postUrgency: 'breaking',
      urgencyLabel: 'breaking',
      scheduledAt: new Date(Date.now() + 60 * 1000).toISOString(),
      status: 'pending'
    };
    const check = policy.validatePostContent(payload);
    if (!check.valid) {
      payload.text = copy.appendSite ? copy.appendSite(text) : text;
    }
    const out = xStore.enqueuePost(payload);
    try {
      require('./ops-monitor').logEvent({
        subsystem: 'autoposter:program-news',
        status: 'monitoring_fallback',
        message: 'Queued program news monitoring post',
        details: {
          programNewsType: row.programNewsType,
          fingerprint: row.fingerprint,
          sourceHandle: row.sourceHandle
        }
      });
    } catch {
      /* optional */
    }
    return { queued: true, item: out.item };
  } catch (e) {
    return { queued: false, reason: e.message };
  }
}

async function queueBeatMonitoringFallback(row, skipReason) {
  const brand = require('./x-autoposter-brand');
  if (!brand.monitoringFallbackAllowed()) return { queued: false, reason: 'monitoring_disabled' };
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
  const brand = require('./x-autoposter-brand');
  if (!brand.monitoringFallbackAllowed()) return { queued: false, reason: 'monitoring_disabled' };
  if (!trustedWriter || !hasRecruitingIntelSignal(row.detail)) return null;
  return queueBeatMonitoringFallback(row, skipReason);
}

function parseCollegeSchool(text) {
  const resolver = require('./contextual-identity-resolver');
  return resolver.parseVagueClues(text).school;
}

/**
 * Visit-related OV status only. Bare beat mentions must never invent ufOvStatus='visit'
 * (that fake heat soft-promotes via lab-intel floridaVisitOnPlayer).
 */
function resolveBeatUfOvPatch(eventType, existingStatus) {
  const et = String(eventType || '').toLowerCase();
  const prev = existingStatus != null ? String(existingStatus).trim() : '';
  if (et === 'visit_cancelled') return { ufOvStatus: 'canceled' };
  if (et === 'official_visit' || et === 'ov_change') return { ufOvStatus: 'scheduled' };
  if (et === 'unofficial_visit' || et === 'visit') {
    return { ufOvStatus: prev && !/^visit$/i.test(prev) ? prev : 'unofficial' };
  }
  // Non-visit intel: clear synthetic placeholders; keep real OV states.
  if (!prev || /^visit$/i.test(prev)) return { ufOvStatus: null };
  return {};
}

function needsBeatProspectProvision(existing, classYear) {
  const year = parseInt(classYear, 10);
  if (!Number.isFinite(year) || year < 2027 || year > 2030) return false;
  if (!existing) return true;
  const slug = String(existing.slug || '').toLowerCase();
  if (!existing.on3Id && !existing.on3Slug) return true;
  if (!existing.stars && !existing.natlRank) return true;
  // Hear→watch: register early watchlist without soft-adding hunt allowlist.
  if (slug && !isOnEarlyWatchlist(slug, year)) return true;
  return false;
}

async function provisionBeatProspect({ playerName, classYear, trustedWriter = false, existing = null }) {
  if (!trustedWriter) return { skipped: true, reason: 'untrusted_writer' };
  const year = parseInt(classYear, 10);
  if (!Number.isFinite(year) || year < 2027 || year > 2030) {
    return { skipped: true, reason: 'class_year_out_of_scope' };
  }
  const trimmed = String(playerName || '').trim();
  if (!trimmed) return { skipped: true, reason: 'missing_name' };

  // Known identity: monitor-only early-watch seed (no allowlist / board / FC soft-add).
  if (
    existing?.slug &&
    (existing.on3Id || existing.on3Slug) &&
    (existing.stars || existing.natlRank)
  ) {
    const watch = upsertEarlyWatchEntry({
      slug: existing.slug,
      name: existing.name || trimmed,
      classYear: year,
      pos: existing.pos,
      school: existing.school,
      stars: existing.stars,
      rating: existing.rating,
      tier: 'monitor',
    });
    return {
      skipped: false,
      ok: true,
      slug: existing.slug,
      monitorOnly: true,
      steps: [{ step: 'early_watchlist', slug: watch.slug, monitorOnly: true }],
    };
  }

  try {
    const result = await enterPlayerIntel({
      name: trimmed,
      classYear: year,
      offer: false,
      rebuildSnapshots: false,
      monitorOnly: true,
    });
    return {
      skipped: false,
      ok: true,
      slug: result.slug,
      monitorOnly: true,
      steps: result.steps,
    };
  } catch (err) {
    return { skipped: false, ok: false, error: err.message };
  }
}

async function processBeatVisitIntelRow(row, snapshot) {
  if (!row?.fingerprint) return { skipped: true, reason: 'invalid' };

  if (row.triggerType === 'program_news' || row.eventType === 'program_news') {
    if (snapshot.fingerprints[row.fingerprint]) {
      return { skipped: true, reason: 'duplicate', fingerprint: row.fingerprint };
    }
    const built = await buildAutoposterPayload(row, null);
    let autopost = built.ok
      ? await queueAutoposter(row, null, built)
      : { queued: false, reason: built.reason || 'copy_failed' };
    if (!autopost.queued) {
      const fallback = await queueProgramNewsMonitoringFallback(row);
      if (fallback.queued) autopost = fallback;
    }
    snapshot.fingerprints[row.fingerprint] = row.timestamp;
    return {
      processed: autopost.queued,
      skipped: !autopost.queued,
      programNews: true,
      programNewsType: row.programNewsType,
      autopost,
      fingerprint: row.fingerprint,
      reason: autopost.queued ? null : autopost.reason
    };
  }

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
    markBeatSnapshot(snapshot, row, skip.nonPlayerIntel?.reason || 'non_player_intel');
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
    markBeatSnapshot(snapshot, row, gate.reason);
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
    const existing = intelStore.getIntelByFingerprint(row.fingerprint);
    if (existing?.resolutionStatus === 'needs_resolution' && !existing.xPostQueued) {
      /* allow re-processing to upgrade needs_resolution intel */
    } else if (
      existing &&
      !existing.xPostQueued &&
      existing.identityConfirmed !== false &&
      existing.resolutionStatus !== 'needs_resolution'
    ) {
      const built = await buildAutoposterPayload(
        {
          ...row,
          playerName: row.playerName || existing.playerName,
          playerSlug: row.playerSlug || existing.playerSlug,
          eventType: row.eventType || existing.eventType,
          detail: row.detail || existing.detail
        },
        existing
      );
      const autopost = built.ok
        ? await queueAutoposter(row, existing, built)
        : { queued: false, reason: built.reason || 'copy_failed' };
      snapshot.fingerprints[row.fingerprint] = row.timestamp;
      return {
        processed: autopost.queued,
        skipped: !autopost.queued,
        intelDuplicateRetry: true,
        autopost,
        fingerprint: row.fingerprint,
        reason: autopost.queued ? null : built.reason || 'intel_duplicate'
      };
    } else {
      snapshot.fingerprints[row.fingerprint] = row.timestamp;
      return { skipped: true, reason: 'intel_duplicate' };
    }
  }

  let existing = row.playerSlug ? await store.getPlayerBySlug(row.playerSlug) : null;

  // Trusted beat offers/visits for unknown prospects: provision monitor entry first
  // so identity confirm + desk intel can land the same day.
  if (needsBeatProspectProvision(existing, row.classYear) && trustedWriter) {
    try {
      const provision = await provisionBeatProspect({
        playerName: row.playerName,
        classYear: row.classYear,
        trustedWriter,
        existing
      });
      if (provision?.ok && provision.slug) {
        row.playerSlug = provision.slug || row.playerSlug;
        existing = (await store.getPlayerBySlug(row.playerSlug)) || existing;
      }
    } catch {
      /* provision optional — continue to identity path */
    }
  }

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
    markBeatSnapshot(snapshot, row, enrichment.reason || 'identity_not_confirmed');
    try {
      const { safeEnqueueUnresolvedPrediction } = require('./unresolved-predictions-detect');
      const pendingSlug = String(row.playerSlug || '').startsWith('beat-pending-');
      const unknownName = /^unknown prospect$/i.test(String(row.playerName || ''));
      if (
        row.eventType === 'prediction' ||
        pendingSlug ||
        unknownName
      ) {
        safeEnqueueUnresolvedPrediction({
          reason: enrichment.reason || 'identity_not_confirmed',
          source: 'beat-writer-ingest',
          title: String(row.detail || row.playerName || 'Prediction identity fail').slice(0, 160),
          textPreview: row.detail || row.text,
          url: row.articleUrl || null,
          handle: row.sourceHandle || null,
          writerName: row.source || null,
          eventType: row.eventType || 'prediction',
          playerNameHint: unknownName ? null : row.playerName,
          playerSlugHint: pendingSlug ? null : row.playerSlug,
          classYearHint: row.classYear,
          posHint: row.pos,
          fingerprint: row.fingerprint || null,
          requireMissingIdentity: true,
        });
      }
    } catch {
      /* never block ingest */
    }
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
    markBeatSnapshot(snapshot, row, recheck.reason);
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

  let playerBase = existing;
  if (needsBeatProspectProvision(existing, row.classYear) && trustedWriter) {
    const provision = await provisionBeatProspect({
      playerName: row.playerName,
      classYear: row.classYear,
      trustedWriter,
      existing,
    });
    if (provision.ok) {
      const provisioned = await store.getPlayerBySlug(provision.slug || row.playerSlug);
      if (provisioned) {
        playerBase = provisioned;
        row.playerSlug = provisioned.slug;
        row.playerName = provisioned.name;
        row.on3Id = provisioned.on3Id || row.on3Id;
        row.pos = row.pos || provisioned.pos;
        row.stars = row.stars || provisioned.stars;
        row.natlRank = row.natlRank || provisioned.natlRank;
        row.school = row.school || provisioned.school;
        row.classYear = row.classYear || provisioned.classYear;
      }
    }
  }

  const mergedPlayer = {
    ...(playerBase || {}),
    slug: row.playerSlug,
    name: row.playerName,
    pos: row.pos || playerBase?.pos,
    classYear: row.classYear || playerBase?.classYear,
    school: row.school || playerBase?.school,
    stars: row.stars || playerBase?.stars,
    natlRank: row.natlRank || playerBase?.natlRank,
    committedTo: playerBase?.committedTo || null
  };
  const copy = require('./recruiting-alert-templates').buildRecruitingCopy({
    player: mergedPlayer,
    existing: playerBase,
    eventType: row.eventType,
    row
  });
  const identityValidator = require('./identity-record-validator');
  const safeSchool =
    identityValidator.sanitizeSchoolField(row.school) ||
    identityValidator.sanitizeSchoolField(playerBase?.school) ||
    null;
  const playerPatch = {
    slug: row.playerSlug,
    name: row.playerName,
    pos: row.pos || playerBase?.pos,
    classYear: row.classYear || playerBase?.classYear,
    school: safeSchool,
    fromSchool:
      identityValidator.sanitizeSchoolField(row.highSchool, { allowCollege: true }) ||
      identityValidator.sanitizeSchoolField(playerBase?.fromSchool, { allowCollege: true }) ||
      null,
    on3Id: row.on3Id || playerBase?.on3Id,
    on3ProfileUrl: playerBase?.on3ProfileUrl || buildOn3ProfileUrl(playerBase || row),
    stars: row.stars || playerBase?.stars,
    category: 'target',
    status: playerBase?.status || 'uncommitted',
    ...resolveBeatUfOvPatch(row.eventType, playerBase?.ufOvStatus),
    visitStart: row.visitStart || playerBase?.visitStart,
    visitEnd: row.visitEnd || playerBase?.visitEnd,
    skinny: copy.skinny,
    profileNote: copy.profileNote
  };
  const player = await store.upsertPlayer(playerPatch);

  const enrichedIntel = enrichIntelCompetitors({
    playerId: String(row.on3Id || player.on3Id || player.slug),
    playerSlug: player.slug,
    playerName: player.name,
    classYear: player.classYear,
    pos: row.pos || player.pos,
    stars: row.stars || player.stars,
    school: row.school || player.school,
    highSchool: row.highSchool,
    eventType: row.eventType,
    status: row.status,
    visitStart: row.visitStart,
    visitEnd: row.visitEnd,
    visitDates: row.visitDates || null,
    timestamp: row.timestamp,
    source: 'auto:beat-writer',
    analystName: row.source,
    sourceHandle: row.sourceHandle,
    sourceType: row.sourceType || 'beat',
    detail: row.detail,
    text: row.text || row.detail,
    ufRelevant: row.ufRelevant !== false,
    fingerprint: row.fingerprint,
    articleUrl: row.articleUrl,
    identityConfirmed: true,
    identityConfirmationMode: enrichment.confirmation?.mode || enrichment.identityPatch?.identityResolutionMode
  });

  const intelResult = await intelStore.addIntel(enrichedIntel);

  if (!intelResult.created && intelResult.duplicate) {
    snapshot.fingerprints[row.fingerprint] = row.timestamp;
    if (!intelAutopostPending(intelResult.item)) {
      return { skipped: true, reason: 'intel_exists' };
    }
    const { autopost, detectivesHandoff } = await attemptBeatAutoposterAndHandoff(
      row,
      intelResult.item,
      player
    );
    return {
      processed: true,
      retried: true,
      reason: 'intel_exists_autopost_retry',
      player: player.slug,
      source: row.source,
      autopost,
      detectivesHandoff,
      identityConfirmed: true,
      fingerprint: row.fingerprint
    };
  }

  await recordBeatDigDeeper(row, player, enrichedIntel, 'auto:beat-writer');

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

  snapshot.fingerprints[row.fingerprint] = row.timestamp;

  const { autopost, detectivesHandoff } = await attemptBeatAutoposterAndHandoff(
    row,
    intelResult.item,
    player
  );

  // Feed full On3 board intel into FutureCast (seed new / nudge existing %).
  let futurecastFeed = null;
  try {
    const { feedDeskIntelToFutureCast } = require('./desk-intel-futurecast-feed');
    futurecastFeed = await feedDeskIntelToFutureCast({
      slug: player.slug,
      player,
      signalType: row.eventType || row.status || null,
      forceHydrate: true
    });
  } catch (err) {
    futurecastFeed = {
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    };
  }

  return {
    processed: true,
    player: player.slug,
    source: row.source,
    autopost,
    detectivesHandoff,
    futurecastFeed,
    identityConfirmed: true,
    fingerprint: row.fingerprint
  };
}

async function collectBeatVisitIntelRows({ posts = null, logSkips = false } = {}) {
  const beat = posts ? { posts } : getBeatPosts(80);
  const cutoff = Date.now() - 7 * 86400000;
  const rows = [];
  let teaser = null;
  try {
    teaser = require('./beat-teaser-resolve');
  } catch {
    teaser = null;
  }
  for (const post of beat.posts || []) {
    if (new Date(post.publishedAt).getTime() < cutoff) continue;
    let working = post;
    if (teaser?.enrichBeatPostIdentity) {
      try {
        const enriched = await teaser.enrichBeatPostIdentity(post);
        if (enriched?.enriched && enriched.post) working = enriched.post;
      } catch {
        working = post;
      }
    }
    const parsed = parseBeatPostForVisitIntel(working, { logSkips });
    if (parsed) {
      if (working._teaserResolved?.playerName && !parsed.playerName) {
        parsed.playerName = working._teaserResolved.playerName;
        parsed.playerSlug = working._teaserResolved.playerSlug || parsed.playerSlug;
      }
      if (working._teaserResolved?.on3ArticleUrl) {
        parsed.articleUrl = parsed.articleUrl || working._teaserResolved.on3ArticleUrl;
      }
      rows.push(parsed);
    }
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

  let newsDiscovery = null;
  try {
    const { runUfOn3NewsDiscovery } = require('./uf-on3-news-discovery');
    newsDiscovery = await runUfOn3NewsDiscovery({ classYear: 2028, maxArticles: 25 });
  } catch (err) {
    newsDiscovery = { ok: false, error: err.message };
  }

  let futurecastProvision = null;
  try {
    const { runAllowlistFuturecastProvision } = require('./allowlist-futurecast-provision');
    futurecastProvision = await runAllowlistFuturecastProvision({ classYear: 2028 });
  } catch (err) {
    futurecastProvision = { ok: false, error: err.message };
  }

  return {
    ok: true,
    sweep: true,
    writersPolled: fresh.writerCount,
    postsFetched: fresh.posts?.length || 0,
    recentPosts: recentPosts.length,
    fetchErrors: fresh.fetchErrors,
    tokenStatus: fresh.tokenStatus,
    newsDiscovery,
    futurecastProvision,
    ...result
  };
}

async function runBeatWriterIngest({ force = false, manualRows = [], posts = null, logSkips = false } = {}) {
  const snapshot = loadSnapshot();
  const results = { processed: [], skipped: [], errors: [] };

  try {
    if (process.env.BEAT_INGEST_PURGE_INELIGIBLE !== 'false') {
      const purge = await intelStore.purgeIneligibleIntel();
      if (purge.removed) {
        const liveAgg = require('./live-aggregator');
        await liveAgg.purgeNonPlayerIntelFromLiveFeed();
      }
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
          logBeatPostSkip(beatPostFromRow(row), out.needs_resolution ? 'needs_resolution' : out.reason, out.category || 'ingest');
        }
      }
    } catch (e) {
      results.errors.push({ player: row.playerName, error: e.message });
    }
  }

  saveSnapshot(snapshot);
  if (results.processed.length) invalidateRecruitingIntelCaches();

  let on3News = null;
  try {
    const { runUfOn3NewsDiscovery } = require('./uf-on3-news-discovery');
    on3News = await runUfOn3NewsDiscovery({
      classYear: 2028,
      maxArticles: 20,
      queueAutoposter: process.env.X_AUTOPOST_ENABLED === 'true'
    });
  } catch (err) {
    on3News = { ok: false, error: err.message };
  }

  try {
    const { scanBeatCommitQueue } = require('./allowlist-target-sync');
    results.commitIngest = await scanBeatCommitQueue({ posts: posts || undefined, force });
  } catch (e) {
    results.errors.push({ stage: 'beat_commit', error: e.message });
  }

  try {
    const { queuePlayerScoutingRefresh } = require('./scouting-update-engine');
    const slugs = new Set(
      results.processed.map((p) => p.playerSlug || p.player || p.slug).filter(Boolean)
    );
    slugs.forEach((slug) => {
      queuePlayerScoutingRefresh(slug, { reason: 'article_ingestion', delayMs: 12000 });
    });
  } catch {
    /* optional */
  }

  return {
    ok: true,
    ...results,
    on3News,
    processedCount: results.processed.length,
    lastRun: snapshot.lastRun
  };
}

async function ingestManualBeatVisitIntel(row) {
  const snapshot = loadSnapshot();
  const out = await processBeatVisitIntelRow(row, snapshot);
  saveSnapshot(snapshot);
  if (out.processed) invalidateRecruitingIntelCaches();
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
  needsBeatProspectProvision,
  provisionBeatProspect,
  resolveBeatUfOvPatch,
  VISIT_INGEST_HANDLES,
  SNAPSHOT_PATH,
  shouldSnapshotBeatSkip,
  markBeatSnapshot,
  RETRYABLE_BEAT_SKIP_REASONS,
  intelAutopostPending,
  attemptBeatAutoposterAndHandoff
};
