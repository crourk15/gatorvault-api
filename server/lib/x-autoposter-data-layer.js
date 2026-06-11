/**
 * X AutoPoster — identity & intel data layer.
 * Source priority: GatorVault DB → On3 → 247 → Rivals.
 * Beat/reporter text: situation, timestamp, event type ONLY — never identity.
 */
const fs = require('fs');
const path = require('path');
const template = require('./x-autoposter-template');
const postSpec = require('./x-autoposter-post-spec');
const { isValidPlayerName } = require('./x-autoposter-player-context');
const {
  normalizeNameKey,
  sourceFromOn3Profile,
  sourceFrom247Profile,
  sourceFromGatorVault,
  resolveRecruitSlug
} = require('./player-identity-lookup');
const { slugify } = require('./slug');

const STAFF_PATH = path.join(__dirname, '..', 'data', 'coaching-staff.json');
const FUZZY_NAME_THRESHOLD = 0.85;

const UF_INTEL_RES =
  /\b(?:florida|gators|\buf\b|gainesville|the swamp|uf's|gator nation)\b/i;

function resolveIntelTimestamp(intel = {}) {
  const raw =
    intel.timestamp ||
    intel.sourceEventCreatedAt ||
    intel.eventTimestamp ||
    intel.publishedAt ||
    intel.createdAt ||
    null;
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Rule 2 — reject before ANY fetch */
function assertIntelFresh(intel = {}) {
  if (process.env.X_AUTOPOST_BYPASS_FRESHNESS === 'true') {
    const ts = resolveIntelTimestamp(intel);
    if (!ts) {
      return { ok: false, skipReason: 'missing_timestamp', reason: 'Intel timestamp required.' };
    }
    return { ok: true, ageSec: 0, logTag: null, bypass: true };
  }
  const ts = resolveIntelTimestamp(intel);
  return postSpec.validateIntelFreshness(ts);
}

function gvRecordToIdentity(player) {
  if (!player?.name) return null;
  const stars = parseInt(player.stars, 10);
  return {
    name: String(player.name).trim(),
    playerSlug: player.slug || null,
    on3Id: player.on3Id || null,
    on3Slug: player.on3Slug || null,
    recruit247Id: player.recruit247Id || null,
    position: String(player.pos || player.position || '')
      .trim()
      .toUpperCase() || null,
    class: player.classYear != null ? Number(player.classYear) : null,
    classYear: player.classYear != null ? Number(player.classYear) : null,
    rating: stars >= 1 && stars <= 5 ? stars : null,
    starsLabel: template.formatStarsLabel(stars),
    natlRank: player.natlRank != null ? Number(player.natlRank) : null,
    height: player.height || null,
    weight: player.weight || null,
    htWt: player.htWt || null,
    hometown: player.school || player.hometown || null,
    school: player.school || null,
    category: player.category || null,
    status: player.status || null,
    committedTo: player.committedTo || null,
    isUFtarget: player.category === 'target' || !!player.headliner,
    ufStatus: resolveUfStatus(player),
    ufRpmPct: player.ufRpmPct != null ? Number(player.ufRpmPct) : null,
    visitHistory: {
      ufOvStatus: player.ufOvStatus || null,
      visitStart: player.visitStart || null,
      visitEnd: player.visitEnd || null,
      nextVisitSchool: player.nextVisitSchool || null
    },
    offerHistory: player.offerHistory || null,
    identitySource: 'gatorvault_db'
  };
}

function snapshotToIdentity(snapshot, sourceTag) {
  if (!snapshot?.playerName) return null;
  const stars = parseInt(snapshot.stars, 10);
  return {
    name: snapshot.playerName,
    playerSlug: snapshot.playerSlug || null,
    on3Id: snapshot.on3Id || null,
    position: snapshot.pos ? String(snapshot.pos).trim().toUpperCase() : null,
    class: snapshot.classYear != null ? Number(snapshot.classYear) : null,
    classYear: snapshot.classYear != null ? Number(snapshot.classYear) : null,
    rating: stars >= 1 && stars <= 5 ? stars : null,
    starsLabel: template.formatStarsLabel(stars),
    natlRank: snapshot.natlRank != null ? Number(snapshot.natlRank) : null,
    hometown: snapshot.hometownState || snapshot.highSchool || snapshot.school || null,
    school: snapshot.highSchool || snapshot.school || snapshot.hometownState || null,
    ufRpmPct: snapshot.ufRpmPct != null ? Number(snapshot.ufRpmPct) : null,
    identitySource: sourceTag
  };
}

function mergeIdentity(base, patch) {
  if (!patch) return base || {};
  const out = { ...(base || {}) };
  const fields = [
    'name',
    'playerSlug',
    'on3Id',
    'on3Slug',
    'recruit247Id',
    'position',
    'class',
    'classYear',
    'rating',
    'starsLabel',
    'natlRank',
    'hometown',
    'school',
    'htWt',
    'ufRpmPct'
  ];
  for (const key of fields) {
    if (out[key] == null || out[key] === '' || out[key] === 0) {
      if (patch[key] != null && patch[key] !== '') out[key] = patch[key];
    }
  }
  if (!out.starsLabel && out.rating) out.starsLabel = template.formatStarsLabel(out.rating);
  if (!out.classYear && out.class) out.classYear = out.class;
  return out;
}

function listMissingCoreIdentity(identity) {
  const missing = [];
  if (!identity?.name || !isValidPlayerName(identity.name)) missing.push('name');
  if (!identity?.position) missing.push('position');
  if (!identity?.class && !identity?.classYear) missing.push('class');
  return missing;
}

function resolveUfStatus(player) {
  if (!player) return null;
  if (/^florida$/i.test(String(player.committedTo || ''))) return 'committed';
  if (player.category === 'target' || player.headliner) return 'priority target';
  if (player.ufRpmPct > 0) return 'RPM interest';
  if (player.category === 'recruit') return 'UF recruit';
  return player.category || null;
}

function nameSimilarity(a, b) {
  return Math.max(postSpec.textSimilarity(a, b), postSpec.jaccardSimilarity(a, b));
}

function extractCapitalizedNameCandidates(text) {
  const t = String(text || '');
  const hits = [];
  const re = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+)+)\b/g;
  let m;
  while ((m = re.exec(t))) {
    const name = m[1].trim();
    if (isValidPlayerName(name)) hits.push(name);
  }
  return hits;
}

/** Step 1 — normalize player name (DB + fuzzy; beat text only as name pointer) */
async function normalizePlayerName(intel = {}) {
  const store = require('./recruiting-store');

  if (intel.playerName && isValidPlayerName(intel.playerName)) {
    return { name: intel.playerName.trim(), playerSlug: intel.playerSlug || null, method: 'intel_metadata' };
  }

  if (intel.playerSlug) {
    const bySlug = await store.getPlayerBySlug(intel.playerSlug);
    if (bySlug?.name) {
      return { name: bySlug.name, playerSlug: bySlug.slug, method: 'slug_lookup' };
    }
  }

  const beatPointer = intel.beatText ? require('./x-autoposter-copy').extractPlayerFromText(intel.beatText) : null;
  const candidates = [];
  if (beatPointer) candidates.push(beatPointer);
  if (intel.beatText) candidates.push(...extractCapitalizedNameCandidates(intel.beatText));

  const all = await store.getAllPlayers();
  for (const candidate of candidates) {
    const exact = all.find((p) => String(p.name || '').toLowerCase() === candidate.toLowerCase());
    if (exact) {
      return { name: exact.name, playerSlug: exact.slug, method: 'exact_db_match' };
    }
    let best = null;
    let bestScore = 0;
    for (const p of all) {
      const score = nameSimilarity(candidate, p.name);
      if (score >= FUZZY_NAME_THRESHOLD && score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) {
      return { name: best.name, playerSlug: best.slug, method: 'fuzzy_db_match', similarity: bestScore };
    }
    if (isValidPlayerName(candidate)) {
      return { name: candidate, playerSlug: intel.playerSlug || slugify(candidate), method: 'beat_name_pointer' };
    }
  }

  return { name: null, playerSlug: null, method: null };
}

/** Step 2 — GatorVault Master Player DB */
async function fetchFromGatorVaultDB(nameHints = {}) {
  const store = require('./recruiting-store');
  let player = null;
  if (nameHints.playerSlug) {
    player = await store.getPlayerBySlug(nameHints.playerSlug);
  }
  if (!player && nameHints.name) {
    const all = await store.getAllPlayers();
    const key = String(nameHints.name).toLowerCase();
    player = all.find((p) => String(p.name || '').toLowerCase() === key) || null;
    if (!player) {
      let best = null;
      let bestScore = 0;
      for (const p of all) {
        const score = nameSimilarity(nameHints.name, p.name);
        if (score >= FUZZY_NAME_THRESHOLD && score > bestScore) {
          bestScore = score;
          best = p;
        }
      }
      player = best;
    }
  }
  return player ? gvRecordToIdentity(player) : null;
}

async function fetchFromOn3(identity, nameHints = {}) {
  const slug =
    resolveRecruitSlug({
      playerSlug: identity?.playerSlug || nameHints.playerSlug,
      on3Id: identity?.on3Id,
      playerName: identity?.name || nameHints.name
    }) || identity?.on3Slug;
  if (!slug) return null;
  const src = await sourceFromOn3Profile(slug, identity?.classYear || identity?.class);
  if (!src?.snapshot) return null;
  return snapshotToIdentity(src.snapshot, 'on3');
}

async function fetchFrom247(identity, nameHints = {}) {
  const src = await sourceFrom247Profile({
    recruit247Id: identity?.recruit247Id,
    playerSlug: identity?.playerSlug || nameHints.playerSlug,
    playerName: identity?.name || nameHints.name,
    classYearHint: identity?.classYear || identity?.class
  });
  if (!src?.snapshot) return null;
  return snapshotToIdentity(src.snapshot, '247');
}

async function fetchFromRivals(identity, nameHints = {}) {
  const store = require('./recruiting-store');
  const player = identity?.playerSlug
    ? await store.getPlayerBySlug(identity.playerSlug)
    : nameHints.playerSlug
      ? await store.getPlayerBySlug(nameHints.playerSlug)
      : null;
  if (player?.rivalsAnalyst || player?.rivalsLastPrediction) {
    const src = sourceFromGatorVault(player, { confidence: 85 });
    if (src?.snapshot) return snapshotToIdentity(src.snapshot, 'rivals_store');
  }
  if (player?.on3Slug || identity?.on3Slug) {
    const slug = player?.on3Slug || identity.on3Slug;
    const src = await sourceFromOn3Profile(slug, identity?.classYear || player?.classYear);
    if (src?.snapshot) return snapshotToIdentity(src.snapshot, 'rivals_on3');
  }
  return null;
}

/** Steps 2–5 — identity enrichment chain */
async function enrichPlayerIdentity(nameHints = {}) {
  let identity = await fetchFromGatorVaultDB(nameHints);
  const providers = [fetchFromOn3, fetchFrom247, fetchFromRivals];

  for (const fetcher of providers) {
    const missing = listMissingCoreIdentity(identity);
    if (!missing.length) break;
    const patch = await fetcher(identity || {}, nameHints);
    identity = mergeIdentity(identity, patch);
  }

  if (identity && !identity.starsLabel && identity.rating) {
    identity.starsLabel = template.formatStarsLabel(identity.rating);
  }

  return identity;
}

function intelDirectlyInvolvesUF(intel = {}, beatText = '') {
  if (intel.directlyInvolvesUF === true) return true;
  const hay = `${intel.detail || ''} ${beatText || ''} ${intel.eventType || ''}`;
  return UF_INTEL_RES.test(hay);
}

/** Rule 6 — UF-only filter (spec: Florida school OR UF target OR beat directly involves UF) */
function passesUfFilter(identity, intel = {}) {
  const beatText = intel.beatText || intel.detail || '';
  if (intelDirectlyInvolvesUF(intel, beatText)) return true;
  if (identity?.isUFtarget) return true;
  if (/^florida$/i.test(String(identity?.school || ''))) return true;
  if (/^florida$/i.test(String(identity?.committedTo || ''))) return true;
  return false;
}

function listMissingPostFields(identity, intel, situation, timestamp) {
  const missing = listMissingCoreIdentity(identity);
  if (!timestamp) missing.push('timestamp');
  if (!situation || situation === 'general') missing.push('situation');
  if (!passesUfFilter(identity, intel)) missing.push('uf_relevance');
  return missing;
}

function extractContextHint(beatText, situation) {
  const t = String(beatText || '').toLowerCase();
  if (!t.trim()) return null;
  switch (situation) {
    case 'visit':
      if (/\btoday\b/.test(t)) return 'on campus today';
      if (/\btomorrow\b/.test(t)) return 'visit scheduled for tomorrow';
      if (/this weekend/.test(t)) return 'on campus this weekend';
      if (/official/.test(t) || /\bov\b/.test(t)) return 'official visit';
      if (/unofficial|\buv\b/.test(t)) return 'unofficial visit';
      if (/in gainesville|the swamp|on campus/.test(t)) return 'on campus';
      return 'visit';
    case 'offer':
      if (/verb/.test(t)) return 'picked up a verbal offer';
      return 'offer extended';
    case 'portal':
      if (/portal visit/.test(t)) return 'portal visit';
      return 'transfer portal';
    case 'trending':
      if (/\brpm\b/.test(t)) return 'RPM momentum';
      if (/prediction|forecast/.test(t)) return 'prediction logged';
      return 'recruiting momentum';
    case 'commitment':
      if (/flip/.test(t)) return 'flipped to Florida';
      return 'committed';
    case 'decommitment':
      return 'decommitted';
    case 'staff':
      if (/promoted/.test(t)) return 'staff promotion';
      if (/hired/.test(t)) return 'staff hire';
      return 'staff update';
    case 'injury':
      if (/day-to-day/.test(t)) return 'day-to-day';
      if (/ruled out/.test(t)) return 'ruled out';
      return 'injury update';
    case 'ranking':
      if (/moved up/.test(t)) return 'moved up in rankings';
      if (/moved down/.test(t)) return 'moved down in rankings';
      return 'ranking update';
    default:
      return null;
  }
}

function detectSituationFromBeat(intel = {}) {
  const beatText = intel.beatText || intel.detail || '';
  return postSpec.detectSituation(beatText, intel.eventType || intel.sourceEventType);
}

function identityToPlayerContext(identity) {
  if (!identity) return null;
  return {
    name: identity.name,
    pos: identity.position,
    classYear: identity.classYear || identity.class,
    starsLabel: identity.starsLabel || template.formatStarsLabel(identity.rating),
    school: identity.school || identity.hometown,
    formerSchool: identity.school || identity.hometown,
    htWt: identity.htWt,
    natlRank: identity.natlRank,
    category: identity.category,
    isPortal: identity.category === 'portal',
    hasMinimumContext: !!(identity.name && (identity.position || identity.classYear || identity.starsLabel)),
    hasFullIdentity: !!(
      identity.name &&
      identity.position &&
      (identity.school || identity.hometown) &&
      (identity.classYear || identity.class) &&
      (identity.natlRank > 0 || identity.starsLabel)
    ),
    ufStatus: identity.ufStatus,
    isUFtarget: identity.isUFtarget
  };
}

/**
 * Full player intel pipeline — freshness → name → identity chain → situation → UF filter → validate.
 * Beat text never supplies identity fields.
 */
async function fetchAutoposterPlayerData(intel = {}) {
  const fresh = assertIntelFresh(intel);
  if (!fresh.ok) {
    console.log(`[x-autoposter] stale intel — ${fresh.reason}`);
    return { ok: false, skipReason: fresh.skipReason || 'stale_intel', reason: fresh.reason, logTag: 'stale intel' };
  }

  const timestamp = resolveIntelTimestamp(intel);
  if (!timestamp) {
    return {
      ok: false,
      skipReason: 'missing_timestamp',
      reason: 'Intel timestamp required — reject before fetch.'
    };
  }

  const nameHints = await normalizePlayerName(intel);
  if (!nameHints.name) {
    return { ok: false, skipReason: 'missing_name', reason: 'Could not normalize player name from intel.' };
  }

  const identity = await enrichPlayerIdentity(nameHints);
  const missing = listMissingCoreIdentity(identity);
  if (missing.length) {
    return {
      ok: false,
      skipReason: 'missing_identity_fields',
      reason: `Missing identity fields: ${missing.join(', ')}`,
      missingFields: missing,
      playerName: nameHints.name
    };
  }

  const situation = detectSituationFromBeat(intel);
  const contextHint = extractContextHint(intel.beatText || intel.detail, situation);

  const postMissing = listMissingPostFields(identity, intel, situation, timestamp);
  if (postMissing.includes('situation')) {
    return {
      ok: false,
      skipReason: 'missing_situation',
      reason: 'Missing situation context — post must explain what is happening (visit, offer, portal, etc.).'
    };
  }
  if (postMissing.includes('uf_relevance')) {
    return { ok: false, skipReason: 'non_uf_intel', reason: 'Non-UF intel — player not tied to Florida.' };
  }
  if (postMissing.length) {
    return {
      ok: false,
      skipReason: 'missing_post_fields',
      reason: `Missing required fields: ${postMissing.join(', ')}`,
      missingFields: postMissing,
      playerName: nameHints.name
    };
  }

  const data = {
    name: identity.name,
    position: identity.position,
    class: String(identity.classYear || identity.class),
    rating: identity.starsLabel || template.formatStarsLabel(identity.rating),
    situation,
    timestamp: timestamp ? new Date(timestamp).toISOString() : null,
    context: contextHint,
    source: intel.sourceHandle || intel.source || 'beat writer',
    ufStatus: identity.ufStatus || (identity.isUFtarget ? 'priority target' : null),
    playerSlug: identity.playerSlug,
    natlRank: identity.natlRank,
    hometown: identity.hometown,
    htWt: identity.htWt,
    identitySource: identity.identitySource || 'gatorvault_db'
  };

  return {
    ok: true,
    data,
    identity,
    ctx: identityToPlayerContext(identity),
    situation: data.situation,
    nameHints
  };
}

function readStaffDb() {
  try {
    return JSON.parse(fs.readFileSync(STAFF_PATH, 'utf8'));
  } catch {
    return { coaches: [], analysts: [], supportStaff: [] };
  }
}

function staffEntryToCoach(entry, roleType = 'on-field') {
  if (!entry?.name) return null;
  const title = String(entry.title || entry.role || '').trim();
  const unit = String(entry.unit || '').trim().toUpperCase();
  const posGroupMap = {
    wr: 'WR',
    rb: 'RB',
    qb: 'QB',
    te: 'TE',
    ol: 'OL',
    dl: 'DL',
    lb: 'LB',
    db: 'DB',
    st: 'ST',
    hc: 'HC',
    oc: 'OC',
    dc: 'DC'
  };
  return {
    name: entry.name.trim(),
    title,
    coachRole: title,
    pos: title,
    positionGroup: posGroupMap[unit.toLowerCase()] || unit || null,
    roleType: roleType === 'analyst' ? 'analyst' : roleType === 'ga' ? 'ga' : 'on-field',
    isCoach: true,
    unit
  };
}

function findCoachInStaffDb(name) {
  if (!name) return null;
  const doc = readStaffDb();
  const key = String(name).toLowerCase();
  const all = [
    ...(doc.coaches || []).map((c) => staffEntryToCoach(c, 'on-field')),
    ...(doc.analysts || []).map((c) => staffEntryToCoach(c, 'analyst')),
    ...(doc.supportStaff || []).map((c) =>
      staffEntryToCoach({ name: c.name, title: c.role, unit: 'support' }, 'support')
    )
  ].filter(Boolean);

  const exact = all.find((c) => c.name.toLowerCase() === key);
  if (exact) return exact;

  let best = null;
  let bestScore = 0;
  for (const c of all) {
    const score = nameSimilarity(name, c.name);
    if (score >= FUZZY_NAME_THRESHOLD && score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

function normalizeCoachName(intel = {}) {
  if (intel.coachName && isValidPlayerName(intel.coachName)) {
    return { name: intel.coachName.trim(), method: 'intel_metadata' };
  }
  const beat = intel.beatText || intel.detail || '';
  const m =
    beat.match(/\bcoach\s+([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+)+)/) ||
    beat.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z'-]+)+)\s+(?:continues|remains|leads|expected)/);
  if (m && isValidPlayerName(m[1].trim())) {
    return { name: m[1].trim(), method: 'beat_name_pointer' };
  }
  return { name: null, method: null };
}

async function fetchAutoposterCoachData(intel = {}) {
  const fresh = assertIntelFresh(intel);
  if (!fresh.ok) {
    return { ok: false, skipReason: fresh.skipReason || 'stale_intel', reason: fresh.reason };
  }

  const timestamp = resolveIntelTimestamp(intel);
  if (!timestamp) {
    return { ok: false, skipReason: 'missing_timestamp', reason: 'Intel timestamp required.' };
  }

  const nameHints = normalizeCoachName(intel);
  if (!nameHints.name) {
    return { ok: false, skipReason: 'missing_coach_name', reason: 'Could not extract coach name.' };
  }

  const coach = findCoachInStaffDb(nameHints.name);
  if (!coach?.name || !coach.title) {
    return {
      ok: false,
      skipReason: 'missing_coach_identity',
      reason: 'Coach not found in Staff DB or missing role.',
      playerName: nameHints.name
    };
  }

  const situation = detectSituationFromBeat(intel);
  const resolvedSituation = situation === 'general' ? 'staff' : situation;
  if (!resolvedSituation || resolvedSituation === 'general') {
    return {
      ok: false,
      skipReason: 'missing_situation',
      reason: 'Missing staff situation context.'
    };
  }

  const contextHint = extractContextHint(intel.beatText || intel.detail, resolvedSituation);

  const data = {
    name: coach.name,
    title: coach.title,
    role: coach.coachRole,
    positionGroup: coach.positionGroup,
    roleType: coach.roleType,
    situation: resolvedSituation,
    timestamp: timestamp ? new Date(timestamp).toISOString() : null,
    context: contextHint,
    source: intel.sourceHandle || intel.source || 'beat writer',
    isCoach: true
  };

  return { ok: true, data, coach, situation: resolvedSituation, ctx: coach };
}

module.exports = {
  FUZZY_NAME_THRESHOLD,
  assertIntelFresh,
  resolveIntelTimestamp,
  normalizePlayerName,
  normalizeCoachName,
  fetchFromGatorVaultDB,
  enrichPlayerIdentity,
  fetchAutoposterPlayerData,
  fetchAutoposterCoachData,
  findCoachInStaffDb,
  passesUfFilter,
  detectSituationFromBeat,
  extractContextHint,
  identityToPlayerContext,
  intelDirectlyInvolvesUF,
  listMissingCoreIdentity,
  listMissingPostFields
};
