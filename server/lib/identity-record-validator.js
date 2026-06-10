/**
 * Strict identity record validation — recruiting players, intel rows, and article triggers.
 * Rejects corrupted school fields, duplicate fingerprints, stale visit chains, and thin context.
 */
const { isValidPlayerName } = require('./x-autoposter-player-context');

const CORRUPTED_SCHOOL_RES = [
  /florida twice/i,
  /this offseason/i,
  /on campus/i,
  /campus at florida/i,
  /visit to florida/i,
  /official visit/i,
  /\bgators?\b/i,
  /^florida$/i,
  /gainesville/i,
  /story:/i,
  /https?:\/\//i,
  /committed\s*[·•\-–—]/i,
  /recruiting intel/i,
  /serious push/i,
  /overall prospect\b/i,
  /twice this/i,
  /will take an/i,
  /taking an/i,
  /set for his/i,
  /set for her/i
];

const TRUNCATED_TEXT_RES = [
  /\bfor No\.\s*$/i,
  /\bpush for No\.\s*$/i,
  /\bSERIOUS push for No\./i,
  /\bmake a SERIOUS push for No\./i
];

const COLLEGE_ONLY_RES =
  /^(?:Texas Tech|Florida|Georgia|Alabama|LSU|Ohio State|Miami|Clemson|Tennessee|Auburn|Oregon|USC|Notre Dame)\b/i;

const VERIFIED_INTEL_SOURCES = new Set(['on3', 'manual', 'rivals_pm']);

/** Errors that should never quarantine on write — sanitize + auto-repair instead. */
const REPAIRABLE_IDENTITY_ERRORS = new Set([
  'invalid_school',
  'invalid_from_school',
  'truncated_skinny',
  'truncated_profileNote',
  'invalid_pos',
  'invalid_class_year'
]);

const HARD_IDENTITY_ERRORS = new Set(['missing_slug', 'invalid_name']);

function classifyIdentityErrors(errors = []) {
  const hard = errors.filter((e) => HARD_IDENTITY_ERRORS.has(e));
  const repairable = errors.filter((e) => REPAIRABLE_IDENTITY_ERRORS.has(e));
  return {
    hard,
    repairable,
    canWrite: hard.length === 0,
    needsRepair: hard.length === 0 && errors.length > 0
  };
}

/** Canonical rebuild data when live profile fetch is unavailable. */
const CANONICAL_PLAYER_FIXUPS = {
  'jalen-brewster': {
    name: 'Jalen Brewster',
    pos: 'DL',
    classYear: 2027,
    stars: 5,
    school: 'Lake Dallas HS, TX',
    fromSchool: 'Texas Tech',
    category: 'target',
    status: 'uncommitted',
    committedTo: null,
    ufOvStatus: 'scheduled'
  }
};

function normalizeSchool(school) {
  return String(school || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidSchoolField(school, { allowCollege = false } = {}) {
  const s = normalizeSchool(school);
  if (s.length < 3) return false;
  if (s.length > 72) return false;
  if (CORRUPTED_SCHOOL_RES.some((re) => re.test(s))) return false;
  const words = s.split(/\s+/);
  if (words.length > 8 && !/\b(?:High School|HS|Academy|Prep|Christian|School)\b/i.test(s)) return false;
  if (!allowCollege && COLLEGE_ONLY_RES.test(s) && !/\b(?:HS|High|Academy|Prep|School)\b/i.test(s)) {
    return false;
  }
  return true;
}

function sanitizeSchoolField(school, { allowCollege = false } = {}) {
  const s = normalizeSchool(school);
  return isValidSchoolField(s, { allowCollege }) ? s : null;
}

function isValidIdentityPlayerName(name) {
  const trimmed = String(name || '').trim();
  if (trimmed.length < 3 || trimmed.length > 48) return false;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  const suffixes = new Set(['jr', 'sr', 'ii', 'iii', 'iv']);
  const core = parts.filter((p) => !suffixes.has(p.toLowerCase().replace(/\./g, '')));
  if (core.length < 2) return false;
  if (core.some((p) => /https?|www|\.com/i.test(p))) return false;
  return core.every((p) => {
    const bare = p.replace(/\./g, '');
    return bare.length >= 2 && /^[A-Za-z'-]+$/.test(bare);
  });
}

function validatePlayerIdentityRecord(player) {
  const errors = [];
  if (!player?.slug) errors.push('missing_slug');
  const name = String(player?.name || '').trim();
  if (!name || !isValidIdentityPlayerName(name)) errors.push('invalid_name');
  const pos = String(player?.pos || '').trim();
  if (!pos || pos.length > 6) errors.push('invalid_pos');
  const isPortal = String(player?.category || '').toLowerCase() === 'portal';
  const classYear = parseInt(player?.classYear, 10);
  const minClassYear = isPortal ? 2020 : 2026;
  if (!Number.isFinite(classYear) || classYear < minClassYear || classYear > 2032) {
    errors.push('invalid_class_year');
  }
  const schoolValid = isPortal
    ? isValidSchoolField(player?.school, { allowCollege: true }) ||
      isValidSchoolField(player?.fromSchool, { allowCollege: true }) ||
      isValidSchoolField(player?.school)
    : isValidSchoolField(player?.school);
  if (!schoolValid) errors.push('invalid_school');
  if (
    player?.fromSchool &&
    !isValidSchoolField(player.fromSchool, { allowCollege: true })
  ) {
    errors.push('invalid_from_school');
  }
  for (const field of ['skinny', 'profileNote']) {
    const text = String(player?.[field] || '');
    if (text && TRUNCATED_TEXT_RES.some((re) => re.test(text))) errors.push(`truncated_${field}`);
  }
  return { valid: errors.length === 0, errors, slug: player?.slug, name: player?.name };
}

function validateIntelForArticle(intel, { seenFingerprints = null } = {}) {
  const errors = [];
  if (!intel?.playerSlug && !intel?.playerName) errors.push('missing_player');
  if (intel?.resolutionStatus === 'needs_resolution') errors.push('needs_resolution');
  if (!intel?.fingerprint) errors.push('missing_fingerprint');
  else if (seenFingerprints?.has(intel.fingerprint)) errors.push('duplicate_fingerprint');
  if (intel?.school && !isValidSchoolField(intel.school, { allowCollege: true })) {
    errors.push('invalid_intel_school');
  }
  const detail = String(intel?.detail || '').trim();
  if (detail.length < 28) errors.push('thin_detail');
  const et = String(intel?.eventType || '').toLowerCase();
  const src = String(intel?.source || '').toLowerCase();
  if (/visit|ov/.test(et)) {
    if (!VERIFIED_INTEL_SOURCES.has(src) && !intel?.identityConfirmed) {
      errors.push('unverified_visit_intel');
    }
  }
  return { valid: errors.length === 0, errors, fingerprint: intel?.fingerprint, slug: intel?.playerSlug };
}

function isVerifiedNewVisitIntel(intel, sinceTs = 0) {
  if (!intel) return false;
  const ts = new Date(intel.reportedAt || intel.createdAt || intel.timestamp || 0).getTime();
  if (!Number.isFinite(ts) || ts <= sinceTs) return false;
  const et = String(intel.eventType || '').toLowerCase();
  if (!/official_visit|unofficial_visit/.test(et)) return false;
  if (/cancel|post_visit_reaction/.test(et)) return false;
  const src = String(intel.source || '').toLowerCase();
  if (VERIFIED_INTEL_SOURCES.has(src)) return true;
  if (/beat/.test(src) && intel.identityConfirmed) return true;
  return false;
}

function dedupeIntelByFingerprint(intelList) {
  const seen = new Set();
  return (intelList || []).filter((i) => {
    if (!i?.fingerprint) return true;
    if (seen.has(i.fingerprint)) return false;
    seen.add(i.fingerprint);
    return true;
  });
}

function filterStaleVisitIntelChain(intelList, playerSlug) {
  const list = intelList || [];
  if (!list.length) return list;

  if (playerSlug) {
    return filterStaleVisitIntelChainForPlayer(list, playerSlug);
  }

  const slugs = [...new Set(list.map((i) => i.playerSlug).filter(Boolean))];
  let out = list.filter((i) => !i.playerSlug || !/visit/.test(String(i.eventType || '')));
  for (const slug of slugs) {
    out = out.concat(filterStaleVisitIntelChainForPlayer(list, slug));
  }
  const seen = new Set();
  return out.filter((i) => {
    const key = i.fingerprint || i.id;
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function filterStaleVisitIntelChainForPlayer(intelList, playerSlug) {
  const slug = String(playerSlug || '').trim();
  const playerVisits = (intelList || []).filter(
    (i) => i.playerSlug === slug && /official_visit|unofficial_visit/.test(String(i.eventType || ''))
  );
  const nonPlayer = (intelList || []).filter((i) => i.playerSlug !== slug);
  if (playerVisits.length <= 1) return [...nonPlayer, ...playerVisits];

  const keep = new Map();
  for (const intel of playerVisits.sort(
    (a, b) => new Date(b.reportedAt || b.createdAt) - new Date(a.reportedAt || a.createdAt)
  )) {
    const day = String(intel.visitStart || intel.timestamp || intel.reportedAt || '').slice(0, 10);
    const key = `${intel.eventType}|${day}`;
    if (!keep.has(key)) keep.set(key, intel);
  }
  return [...nonPlayer, ...keep.values()];
}

function sanitizePlayerFieldsForStore(player) {
  const out = { ...(player || {}) };
  const school = sanitizeSchoolField(out.school) || sanitizeSchoolField(out.highSchool);
  if (school) out.school = school;
  else if (out.school && !isValidSchoolField(out.school)) delete out.school;

  if (out.fromSchool) {
    const from = sanitizeSchoolField(out.fromSchool, { allowCollege: true });
    if (from) out.fromSchool = from;
    else delete out.fromSchool;
  }

  for (const field of ['skinny', 'profileNote']) {
    if (out[field] && TRUNCATED_TEXT_RES.some((re) => re.test(String(out[field])))) {
      delete out[field];
    }
  }

  const pos = String(out.pos || '').trim();
  if (pos.length > 6) delete out.pos;

  return out;
}

/**
 * Merge incoming with existing, strip corruption, preserve valid identity fields.
 */
function healPlayerRecord(incoming, existing = null) {
  const merged = existing ? { ...existing, ...incoming } : { ...(incoming || {}) };
  let out = sanitizePlayerFieldsForStore(merged);

  if (existing) {
    if (!isValidSchoolField(out.school) && isValidSchoolField(existing.school)) {
      out.school = existing.school;
    }
    const pos = String(out.pos || '').trim();
    if (!pos || pos.length > 6) out.pos = existing.pos || out.pos;
    const classYear = parseInt(out.classYear, 10);
    if (!Number.isFinite(classYear) || classYear < 2026 || classYear > 2032) {
      out.classYear = existing.classYear || out.classYear;
    }
    if (out.fromSchool && !isValidSchoolField(out.fromSchool, { allowCollege: true })) {
      out.fromSchool = isValidSchoolField(existing.fromSchool, { allowCollege: true })
        ? existing.fromSchool
        : null;
    }
  }

  const posFinal = String(out.pos || '').trim();
  if (!posFinal || posFinal.length > 6) out.pos = 'ATH';

  const cy = parseInt(out.classYear, 10);
  if ((!Number.isFinite(cy) || cy < 2026) && out.committedTo && String(out.category || '').toLowerCase() !== 'portal') {
    out.classYear = 2026;
  }

  if (String(out.category || '').toLowerCase() === 'portal') {
    if (out.school && !isValidSchoolField(out.school) && isValidSchoolField(out.school, { allowCollege: true })) {
      if (!out.fromSchool) out.fromSchool = out.school;
    }
  }

  return sanitizePlayerFieldsForStore(out);
}

async function rebuildPlayerIdentityFromOn3(slug, options = {}) {
  const store = require('./recruiting-store');
  const intelStore = require('./recruiting-intel-store');
  const patternStore = require('./identity-patterns-store');
  const identityLookup = require('./player-identity-lookup');
  const on3Recruit = require('./on3-recruit-client');

  const targetSlug = String(slug || '').trim();
  if (!targetSlug) return { ok: false, error: 'missing_slug' };

  const existing = await store.getPlayerBySlug(targetSlug);
  const classYear = existing?.classYear || options.classYear || 2027;
  const canonical = CANONICAL_PLAYER_FIXUPS[targetSlug] || null;
  const on3Source = await identityLookup.sourceFromOn3Profile(targetSlug, classYear);
  const snap = on3Source?.snapshot;

  let commitSchool = null;
  if (on3Source?.url) {
    try {
      const pp = await on3Recruit.fetchNextPageProps(on3Source.url, classYear);
      const topTeams = pp?.topTeams?.list || pp?.topTeams || [];
      const commit = on3Recruit.getCollegeCommit(topTeams, classYear);
      if (commit?.school && !/^florida$/i.test(String(commit.school).trim())) {
        commitSchool = String(commit.school).trim();
      }
    } catch {
      /* optional */
    }
  }

  const school =
    sanitizeSchoolField(snap?.highSchool) ||
    sanitizeSchoolField(snap?.hometownState) ||
    sanitizeSchoolField(canonical?.school) ||
    sanitizeSchoolField(existing?.school);

  const cleanPlayer = sanitizePlayerFieldsForStore({
    slug: targetSlug,
    name: snap?.playerName || canonical?.name || existing?.name,
    pos: snap?.pos || canonical?.pos || existing?.pos || 'DL',
    classYear: snap?.classYear || canonical?.classYear || classYear,
    school: school || canonical?.school || null,
    fromSchool:
      commitSchool ||
      sanitizeSchoolField(canonical?.fromSchool, { allowCollege: true }) ||
      sanitizeSchoolField(existing?.fromSchool, { allowCollege: true }),
    stars: snap?.stars || canonical?.stars || existing?.stars || null,
    natlRank: snap?.natlRank ?? canonical?.natlRank ?? existing?.natlRank ?? null,
    category: canonical?.category || (existing?.category === 'commit' ? existing.category : 'target'),
    status: canonical?.status || (existing?.status === 'committed' ? existing.status : 'uncommitted'),
    committedTo: canonical?.committedTo ?? existing?.committedTo ?? null,
    skinny: null,
    profileNote: null,
    ufOvStatus: canonical?.ufOvStatus || existing?.ufOvStatus || 'visit',
    visitStart: existing?.visitStart || null,
    visitEnd: existing?.visitEnd || null,
    on3Id: snap?.on3Id || existing?.on3Id || targetSlug,
    on3ProfileUrl: on3Source?.url || existing?.on3ProfileUrl || null,
    updatedAt: new Date().toISOString()
  });

  const validation = validatePlayerIdentityRecord(cleanPlayer);
  if (!validation.valid) {
    return { ok: false, error: 'identity_still_invalid', validation, slug: targetSlug };
  }

  const saved = await store.upsertPlayer(cleanPlayer, { repairMode: true, subsystem: 'identity-rebuild' });

  const intelRemoved = intelStore.removeIntelMatching((i) => {
    if (i.playerSlug !== targetSlug) return false;
    return !validateIntelForArticle(i).valid;
  });

  await patternStore.syncPatternsForPlayer(saved);

  return {
    ok: true,
    slug: targetSlug,
    player: saved,
    validation: validatePlayerIdentityRecord(saved),
    on3Source: on3Source?.provider || null,
    intelRemoved,
    patternsRebuilt: true
  };
}

module.exports = {
  CORRUPTED_SCHOOL_RES,
  REPAIRABLE_IDENTITY_ERRORS,
  HARD_IDENTITY_ERRORS,
  classifyIdentityErrors,
  isValidSchoolField,
  isValidIdentityPlayerName,
  sanitizeSchoolField,
  validatePlayerIdentityRecord,
  validateIntelForArticle,
  isVerifiedNewVisitIntel,
  dedupeIntelByFingerprint,
  filterStaleVisitIntelChain,
  sanitizePlayerFieldsForStore,
  healPlayerRecord,
  rebuildPlayerIdentityFromOn3
};
