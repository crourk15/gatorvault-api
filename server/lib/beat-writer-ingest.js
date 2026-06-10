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

/** Trusted handles for visit ingest — Harden/Swamp247, Bender, GatorsOnline, Gainesville beat. */
const VISIT_INGEST_HANDLES = new Set([
  'ttjharden8',
  'corey_bender',
  'gatorsonline',
  'grahamhall_',
  'nickdelatorregc',
  'thomasgoldkamp',
  'blake_alderman',
  'keithniebuhr'
]);

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
  const writer = String(post.writerName || post.outlet || '').toLowerCase();
  return (
    /harden|bender|gatorsonline|gators online|swamp247|graham hall|de la torre|goldkamp|goodall/i.test(writer) ||
    /harden|bender|gatorsonline|swamp247|grahamhall|nickdelatorre|thomasgoldkamp/i.test(handle)
  );
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
  const resolver = require('./contextual-identity-resolver');

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

  const clues = resolver.parseVagueClues(t);
  return clues.firstName || clues.displayName || null;
}

function parseCollegeSchool(text) {
  const resolver = require('./contextual-identity-resolver');
  return resolver.parseVagueClues(text).school;
}

function parseBeatPostForVisitIntel(post) {
  const resolver = require('./contextual-identity-resolver');
  const text = String(post.text || '').trim();
  if (!text || !isVisitSchedulePost(text)) return null;
  if (!isVisitIngestWriter(post)) return null;
  if (!beatFilters.shouldIncludeBeatPost(post)) return null;
  if (!beatFilters.isFloridaRelevantPost(post)) return null;

  const playerName = extractVisitPlayerName(text);
  const vagueClues = resolver.parseVagueClues(text, {
    stars: parseStars(text),
    pos: parsePosition(text),
    classYear: parseClassYear(text),
    school: parseSchool(text) || parseCollegeSchool(text)
  });
  if (!playerName && !vagueClues.hasSignal) return null;

  const resolvedName = playerName || vagueClues.firstName || vagueClues.displayName || 'Unknown';
  const isVagueName = !isUsableExtractedName(resolvedName);

  const analystName = post.writerName || post.outlet || post.handle || 'Beat writer';
  const classYear = parseClassYear(text) || vagueClues?.classYear || 2027;
  const pos = parsePosition(text) || vagueClues?.pos || '';
  const school = parseSchool(text) || parseCollegeSchool(text) || vagueClues?.school || '';
  const visitDate = parseVisitDate(text);
  const eventType = resolveEventType(text);
  const timestamp = post.publishedAt || new Date().toISOString();
  const slugBase = slugify(resolvedName);
  const handle = String(post.handle || '').toLowerCase() || 'beat';
  const day = timestamp.slice(0, 10);

  return {
    playerName: resolvedName,
    playerSlug: slugBase,
    on3Id: null,
    classYear,
    pos,
    school,
    highSchool: school,
    stars: parseStars(text) || vagueClues?.stars || null,
    vaguePhrase: isVagueName ? vagueClues.rawPhrase : null,
    vagueClues,
    eventType,
    status: eventType === 'official_visit' ? 'Official Visit · Florida' : 'Visit · Gainesville',
    visitStart: visitDate,
    visitEnd: null,
    detail: text.replace(/\s+/g, ' ').slice(0, 280),
    timestamp,
    articleUrl: post.url || null,
    source: analystName,
    sourceHandle: post.handle || null,
    sourceType: 'beat',
    fingerprint: `beat_visit_${slugBase}_${day}_${handle}_${eventType}`
  };
}

async function buildAutoposterPayload(row, intelItem) {
  const copy = require('./x-autoposter-copy');
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
  if (!built?.text) return { ok: false, reason: built?.skipReason || 'invalid_copy' };
  return { ok: true, ...built, text: copy.appendSite(built.text) };
}

async function queueAutoposter(row, intelItem, built) {
  try {
    const xStore = require('./x-autoposter-store');
    const policy = require('./x-autoposter-policy');
    const copy = require('./x-autoposter-copy');
    const fp = row.fingerprint;
    if (!built?.text || copy.isBrokenCopy(built.text, built) || !copy.isValidPlayerName(row.playerName)) {
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
      topic: 'recruiting',
      sources: [{ label: row.source, url: row.articleUrl || SITE_URL }],
      source: 'auto:beat-writer',
      intelFingerprint: fp,
      intelType: row.eventType,
      playerName: row.playerName,
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

async function processBeatVisitIntelRow(row, snapshot) {
  if (!row?.fingerprint || !row.playerName) return { skipped: true, reason: 'invalid' };
  if (snapshot.fingerprints[row.fingerprint]) {
    return { skipped: true, reason: 'duplicate', fingerprint: row.fingerprint };
  }
  if (intelStore.hasIntelFingerprint(row.fingerprint)) {
    snapshot.fingerprints[row.fingerprint] = row.timestamp;
    return { skipped: true, reason: 'intel_duplicate' };
  }

  const existing = await store.getPlayerBySlug(row.playerSlug);
  const playerPatch = {
    slug: row.playerSlug,
    name: row.playerName,
    pos: row.pos || existing?.pos,
    classYear: row.classYear || existing?.classYear,
    school: row.school || existing?.school,
    fromSchool: row.highSchool || row.school || existing?.fromSchool,
    on3Id: row.on3Id || existing?.on3Id,
    on3ProfileUrl: existing?.on3ProfileUrl || buildOn3ProfileUrl(existing || row),
    stars: row.stars || existing?.stars,
    category: 'target',
    status: existing?.status || 'uncommitted',
    ufOvStatus: row.eventType === 'official_visit' ? 'scheduled' : existing?.ufOvStatus || 'visit',
    visitStart: row.visitStart || existing?.visitStart,
    visitEnd: row.visitEnd || existing?.visitEnd,
    skinny: row.detail,
    profileNote: `${row.eventType === 'official_visit' ? 'OV' : 'Visit'} to Florida · via ${row.source}`
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
    articleUrl: row.articleUrl
  });

  if (!intelResult.created && intelResult.duplicate) {
    snapshot.fingerprints[row.fingerprint] = row.timestamp;
    return { skipped: true, reason: 'intel_exists' };
  }

  const identityLookup = require('./player-identity-lookup');
  const enrichment = await identityLookup.enrichAndConfirmIntelIdentity({
    fields: {
      playerName: player.name,
      pos: player.pos,
      classYear: player.classYear,
      highSchool: row.highSchool,
      hometownState: row.hometownState,
      school: row.school,
      stars: row.stars || player.stars,
      natlRank: row.natlRank || player.natlRank
    },
    playerName: player.name,
    playerSlug: player.slug,
    row,
    intel: intelResult.item,
    player,
    intelId: intelResult.item?.id,
    classYear: player.classYear,
    beatText: row.detail,
    sourceHandle: row.sourceHandle,
    allowContextual: true
  });

  if (!enrichment.confirmed) {
    snapshot.fingerprints[row.fingerprint] = row.timestamp;
    try {
      require('./ops-monitor').logEvent({
        subsystem: 'autoposter:beat-writer',
        status: 'skipped',
        message: enrichment.reason || 'identity_not_confirmed',
        details: {
          playerName: player.name,
          eventType: row.eventType,
          stars: row.stars || player.stars,
          source: row.source,
          vaguePhrase: row.vaguePhrase,
          contextual: enrichment.contextual || null
        }
      });
    } catch {
      /* ops optional */
    }
    return {
      skipped: true,
      reason: enrichment.reason || 'identity_not_confirmed',
      player: player.slug,
      source: row.source,
      confirmation: enrichment.confirmation || null,
      missingAfter: enrichment.missingAfter || enrichment.missingBefore || null,
      intelCreated: true,
      fingerprint: row.fingerprint
    };
  }

  Object.assign(row, enrichment.identityPatch || {}, enrichment.intelPatch || {});
  if (enrichment.identityPatch?.playerName) {
    player.name = enrichment.identityPatch.playerName;
    player.slug = enrichment.identityPatch.playerSlug || player.slug;
  }

  await store.createEvent({
    playerId: player.id,
    playerSlug: player.slug,
    eventType: row.eventType,
    title: `${player.name} — ${row.eventType === 'official_visit' ? 'OV' : 'Visit'} to Florida`,
    detail: row.detail,
    skinny: `${player.pos || 'Recruit'} · ${player.classYear || ''} · via ${row.source}`,
    classYear: player.classYear,
    payload: { player, beatVisit: row },
    source: 'beat_writer_ingest'
  });

  liveStore.upsertFeedItem({
    id: `beat_visit_${row.fingerprint}`,
    dedupeKey: row.fingerprint,
    type: 'visit',
    title: `${player.name} — ${row.eventType === 'official_visit' ? 'Official visit' : 'Visit'} to Florida`,
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

async function collectBeatVisitIntelRows() {
  const beat = getBeatPosts(80);
  const cutoff = Date.now() - 7 * 86400000;
  const rows = [];
  for (const post of beat.posts || []) {
    if (new Date(post.publishedAt).getTime() < cutoff) continue;
    const parsed = parseBeatPostForVisitIntel(post);
    if (parsed) rows.push(parsed);
  }
  return rows;
}

async function runBeatWriterIngest({ force = false, manualRows = [] } = {}) {
  const snapshot = loadSnapshot();
  const results = { processed: [], skipped: [], errors: [] };

  let beatRows = [];
  try {
    beatRows = await collectBeatVisitIntelRows();
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
      else results.skipped.push(out);
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
  ingestManualBeatVisitIntel,
  processBeatVisitIntelRow,
  parseBeatPostForVisitIntel,
  isVisitIngestWriter,
  isVisitSchedulePost,
  VISIT_INGEST_HANDLES,
  SNAPSHOT_PATH
};
