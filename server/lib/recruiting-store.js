const fs = require('fs');
const path = require('path');
const { slugify } = require('./slug');
const { buildOn3ProfileUrl } = require('./on3-urls');
const { commitFingerprint, intelFingerprint } = require('./commit-fingerprint');
const { isVisitEventType } = require('./gv-classification');
const { normalizePlayerGeo } = require('./recruiting-geo-normalize');

const DATA_DIR = path.join(__dirname, '..', 'data', 'recruiting');
const PLAYERS_PATH = path.join(DATA_DIR, 'players.json');
const EVENTS_PATH = path.join(DATA_DIR, 'events.json');
const RANKINGS_PATH = path.join(DATA_DIR, 'rankings.json');

let supabase = null;
let supabaseFallbackReason = null;

function isSupabaseUnavailableError(error) {
  if (!error) return false;
  const msg = String(error.message || error.details || error.hint || error).toLowerCase();
  const code = String(error.code || '');
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table') ||
    (msg.includes('relation') && msg.includes('does not exist'))
  );
}

function disableSupabase(reason) {
  if (supabase === false) return;
  supabaseFallbackReason = reason || 'unavailable';
  supabase = false;
  console.warn('[recruiting] Supabase unavailable — using local JSON store:', supabaseFallbackReason);
}

function initSupabase() {
  if (supabase !== null) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    supabase = false;
    return false;
  }
  try {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(url, key);
    return supabase;
  } catch (e) {
    console.warn('[recruiting] Supabase client unavailable, using local JSON store');
    supabase = false;
    return false;
  }
}

function getStoreInfo() {
  const sb = initSupabase();
  const hasDb = !!(process.env.DATABASE_URL && String(process.env.DATABASE_URL).trim());
  return {
    mode: sb ? 'supabase' : 'json',
    supabaseFallbackReason,
    /** Recruiting players/events — Supabase `players` table or local JSON. */
    supabaseConfigured: !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY)),
    /** FutureCast predictions/movement — Postgres via DATABASE_URL (separate from recruiting store). */
    futurecastDbConfigured: hasDb,
    paths: sb
      ? null
      : {
          players: PLAYERS_PATH,
          events: EVENTS_PATH,
          rankings: RANKINGS_PATH
        }
  };
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function writeJson(filePath, data) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function nowIso() {
  return new Date().toISOString();
}

function isTestPlayer(p) {
  const slug = String(p.slug || '').toLowerCase();
  const name = String(p.name || '').toLowerCase();
  return slug === 'test-recruit' || name === 'test recruit';
}

const { isBlockedRecruit: isBlockedPlayer } = require('./recruiting-blocked-players');

function isHubCommittedStatus(p) {
  if (!p) return false;
  return String(p.status || '').toLowerCase() === 'committed';
}

function isHubFloridaCommitStatus(p) {
  if (!p) return false;
  const status = String(p.status || '').toLowerCase();
  const committedTo = String(p.committedTo || p.committed_to || '').trim();
  return (
    ['committed', 'commit', 'signed', 'enrolled'].includes(status) &&
    /^florida$/i.test(committedTo)
  );
}

function isFloridaCommit(p) {
  if (!p) return false;
  if (p.protected === true) return isHubFloridaCommitStatus(p);
  return isHubCommittedStatus(p);
}

function sortHubCommits(players) {
  return players.slice().sort((a, b) => {
    const ra = a.natlRank ?? a.natl ?? 9999;
    const rb = b.natlRank ?? b.natl ?? 9999;
    return ra - rb;
  });
}

function isHubUfCommitPlayer(p) {
  if (!isHubFloridaCommitStatus(p)) return false;
  const { isVerifiedHubCommit, isHubClassYear } = require('./recruiting-verified-commits');
  const year = Number(p.classYear);
  if (isHubClassYear(year)) return isVerifiedHubCommit(p);
  return true;
}

function filterHubCommitPlayers(players, classYear) {
  const year = parseInt(classYear, 10);
  return sortHubCommits(
    (players || []).filter(
      (p) =>
        !isTestPlayer(p) &&
        !isBlockedPlayer(p) &&
        Number(p.classYear) === year &&
        isHubUfCommitPlayer(p)
    )
  );
}

async function queryHubCommitsFromSupabase(classYear) {
  const year = parseInt(classYear, 10);
  const sb = initSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from('players')
    .select('*')
    .eq('class_year', year)
    .eq('status', 'committed')
    .order('natl_rank', { ascending: true, nullsFirst: false });

  if (error) {
    if (isSupabaseUnavailableError(error)) {
      disableSupabase(error.message);
      return null;
    }
    throw error;
  }

  return filterHubCommitPlayers((data || []).map(rowToPlayer), year);
}

async function queryHubCommitsFromDatabase(classYear) {
  const url = process.env.DATABASE_URL && String(process.env.DATABASE_URL).trim();
  if (!url || initSupabase()) return null;

  const year = parseInt(classYear, 10);
  const { Client } = require('pg');
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const { rows } = await client.query(
      `SELECT *
       FROM players
       WHERE class_year = $1
         AND lower(status) = 'committed'
       ORDER BY natl_rank NULLS LAST`,
      [year]
    );
    return filterHubCommitPlayers(rows.map(rowToPlayer), year);
  } finally {
    await client.end().catch(() => {});
  }
}

/** Hub commit list — UF commits for a class year (Supabase/Postgres query, JSON fallback). */
async function getHubCommits(classYear) {
  const year = parseInt(classYear, 10);
  if (!Number.isFinite(year)) return [];

  const fromSupabase = await queryHubCommitsFromSupabase(year);
  if (fromSupabase) return fromSupabase;

  const fromDatabase = await queryHubCommitsFromDatabase(year);
  if (fromDatabase) return fromDatabase;

  const players = await getAllPlayers();
  return filterHubCommitPlayers(players, year);
}

function isCommittedAnywhere(p) {
  if (!p) return false;
  const status = String(p.status || '').toLowerCase();
  if (['committed', 'enrolled', 'signed'].includes(status)) return true;
  const committedTo = String(p.committedTo || p.committed_to || '').trim();
  return !!committedTo;
}

function normalizeClassYear(raw) {
  const y = raw?.classYear ?? raw?.class_year;
  if (y == null || y === '') return null;
  const n = parseInt(String(y), 10);
  return Number.isFinite(n) ? n : null;
}

function normalizePlayer(raw) {
  const slug = raw.slug || slugify(raw.name);
  const committedTo = raw.committedTo ?? raw.committed_to ?? null;
  const statusRaw = raw.status ?? (isFloridaCommit({ status: 'committed', committedTo }) ? 'committed' : null);
  let status = statusRaw;
  if (String(status || '').toLowerCase() === 'commit') status = 'committed';
  let category = raw.category ?? null;
  if (!category) {
    category = isFloridaCommit({ status: status || 'committed', committedTo: committedTo || 'Florida' })
      ? 'recruit'
      : 'target';
  }
  const player = {
    id: raw.id || slug,
    slug,
    name: raw.name,
    pos: raw.pos,
    classYear: normalizeClassYear(raw),
    school: raw.school || '',
    htWt: raw.htWt || raw.ht_wt || '',
    stars: raw.stars || 0,
    rating: raw.rating != null ? Number(raw.rating) : null,
    ratingOverride: raw.ratingOverride != null ? Number(raw.ratingOverride) : null,
    vaultGrade: raw.vaultGrade != null ? Number(raw.vaultGrade) : raw.ratingOverride != null ? Number(raw.ratingOverride) : null,
    vaultGradeUpdatedAt: raw.vaultGradeUpdatedAt || raw.vault_grade_updated_at || null,
    natlRank: raw.natlRank || raw.natl_rank || raw.natl || null,
    posRank: raw.posRank || raw.pos_rank || null,
    stateRank: raw.stateRank || raw.state_rank || raw.stRk || null,
    inState: !!(raw.inState ?? raw.in_state),
    category,
    status: status || (isFloridaCommit({ status: 'committed', committedTo }) ? 'committed' : 'uncommitted'),
    committedTo: isFloridaCommit({ status: status || 'uncommitted', committedTo })
      ? committedTo || 'Florida'
      : committedTo,
    fromSchool: raw.fromSchool || raw.from_school || null,
    commitDate: raw.commitDate || raw.commit_date || raw.date || null,
    skinny: raw.skinny || raw.note || '',
    profileNote: raw.profileNote || raw.profile_note || '',
    on3Id: raw.on3Id || raw.on3_id || null,
    on3Slug: raw.on3Slug || raw.on3_slug || null,
    on3ProfileUrl: raw.on3ProfileUrl || raw.on3_profile_url || null,
    on3Source: raw.on3Source || raw.on3_source || null,
    rivalsLastPrediction: raw.rivalsLastPrediction || raw.rivals_last_prediction || null,
    rivalsAnalyst: raw.rivalsAnalyst || raw.rivals_analyst || null,
    rivalsConfidence: raw.rivalsConfidence != null ? Number(raw.rivalsConfidence) : raw.rivals_confidence != null ? Number(raw.rivals_confidence) : null,
    rivalsArticleUrl: raw.rivalsArticleUrl || raw.rivals_article_url || null,
    ufOvStatus: raw.ufOvStatus || raw.uf_ov_status || null,
    ufOvCancelledAt: raw.ufOvCancelledAt || raw.uf_ov_cancelled_at || null,
    nextVisitSchool: raw.nextVisitSchool || raw.next_visit_school || null,
    visitStart: raw.visitStart || raw.visit_start || null,
    visitEnd: raw.visitEnd || raw.visit_end || null,
    starsDisplay: raw.starsDisplay || raw.stars_display || null,
    headliner: !!(raw.headliner ?? raw.is_headliner ?? raw.isUFtarget),
    ufProbability: raw.ufProbability != null ? Number(raw.ufProbability) : raw.uf_probability != null ? Number(raw.uf_probability) : null,
    fitScore: raw.fitScore != null ? Number(raw.fitScore) : raw.fit_score != null ? Number(raw.fit_score) : null,
    staff_lead_id: raw.staff_lead_id || raw.staffLeadId || null,
    secondary_recruiter_id: raw.secondary_recruiter_id || raw.secondaryRecruiterId || null,
    hometownCity: raw.hometownCity || raw.hometown_city || null,
    hometownState: raw.hometownState || raw.hometown_state || raw.state || null,
    stateFips: raw.stateFips || raw.state_fips || null,
    pinLat: raw.pinLat != null ? Number(raw.pinLat) : raw.lat != null ? Number(raw.lat) : null,
    pinLng: raw.pinLng != null ? Number(raw.pinLng) : raw.lng != null ? Number(raw.lng) : null,
    updatedAt: raw.updatedAt || raw.updated_at || nowIso()
  };
  const geoPatch = normalizePlayerGeo({ ...raw, ...player });
  Object.assign(player, geoPatch);
  if (player.ratingOverride != null && player.ratingOverride !== '') {
    player.displayRating = Number(player.ratingOverride);
    player.ratingIsOverride = true;
  } else if (player.vaultGrade != null && player.vaultGrade !== '') {
    player.displayRating = Number(player.vaultGrade);
    player.ratingIsOverride = true;
  } else {
    player.displayRating = player.rating != null ? Number(player.rating) : null;
    player.ratingIsOverride = false;
  }
  return player;
}

function playerToRow(p) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    pos: p.pos,
    class_year: p.classYear,
    school: p.school,
    ht_wt: p.htWt,
    stars: p.stars,
    rating: p.rating,
    natl_rank: p.natlRank,
    pos_rank: p.posRank,
    state_rank: p.stateRank,
    in_state: p.inState,
    category: p.category,
    status: p.status,
    committed_to: p.committedTo,
    from_school: p.fromSchool,
    commit_date: p.commitDate,
    skinny: p.skinny,
    profile_note: p.profileNote,
    on3_id: p.on3Id,
    stars_display: p.starsDisplay,
    updated_at: p.updatedAt
  };
}

function rowToPlayer(row) {
  if (!row) return null;
  return normalizePlayer({
    id: row.id,
    slug: row.slug,
    name: row.name,
    pos: row.pos,
    class_year: row.class_year,
    school: row.school,
    ht_wt: row.ht_wt,
    stars: row.stars,
    rating: row.rating,
    natl_rank: row.natl_rank,
    pos_rank: row.pos_rank,
    state_rank: row.state_rank,
    in_state: row.in_state,
    category: row.category,
    status: row.status,
    committed_to: row.committed_to,
    from_school: row.from_school,
    commit_date: row.commit_date,
    skinny: row.skinny,
    profile_note: row.profile_note,
    on3_id: row.on3_id,
    stars_display: row.stars_display,
    updated_at: row.updated_at
  });
}

async function loadPlayersLocal() {
  return readJson(PLAYERS_PATH, []);
}

/** Sync lookup for autoposter identity-matcher (local JSON fallback). */
function findBySlug(slug) {
  if (!slug) return null;
  const players = readJson(PLAYERS_PATH, []).map(normalizePlayer);
  return players.find((p) => p.slug === slug) || null;
}

function findByNameAndClass(name, classYear) {
  if (!name) return null;
  const key = String(name).trim().toLowerCase();
  const players = readJson(PLAYERS_PATH, []).map(normalizePlayer);
  return (
    players.find(
      (p) =>
        String(p.name || '')
          .trim()
          .toLowerCase() === key && String(p.classYear) === String(classYear)
    ) || null
  );
}

async function savePlayersLocal(players) {
  writeJson(PLAYERS_PATH, players);
}

async function loadEventsLocal() {
  return readJson(EVENTS_PATH, []);
}

async function saveEventsLocal(events) {
  writeJson(EVENTS_PATH, events.slice(0, 500));
}

async function loadRankingsLocal() {
  return readJson(RANKINGS_PATH, []);
}

async function saveRankingsLocal(rankings) {
  writeJson(RANKINGS_PATH, rankings);
}

async function getAllPlayers() {
  const sb = initSupabase();
  let players;
  if (sb) {
    const { data, error } = await sb.from('players').select('*').order('updated_at', { ascending: false });
    if (error) {
      if (isSupabaseUnavailableError(error)) {
        disableSupabase(error.message);
        players = (await loadPlayersLocal()).map(normalizePlayer);
      } else {
        throw error;
      }
    } else {
      players = (data || []).map(rowToPlayer);
    }
  } else {
    players = (await loadPlayersLocal()).map(normalizePlayer);
  }
  return players.filter((p) => !isTestPlayer(p) && !isBlockedPlayer(p));
}

async function getPlayerBySlug(slug) {
  const sb = initSupabase();
  if (sb) {
    const { data, error } = await sb.from('players').select('*').eq('slug', slug).maybeSingle();
    if (error) {
      if (isSupabaseUnavailableError(error)) {
        disableSupabase(error.message);
      } else {
        throw error;
      }
    } else {
      return rowToPlayer(data);
    }
  }
  const players = await loadPlayersLocal();
  const p = players.find((x) => x.slug === slug);
  return p ? normalizePlayer(p) : null;
}

/** Resolve recruiting player by slug or On3 id (hub links sometimes pass numeric ids). */
async function resolvePlayerKey(key) {
  const raw = String(key || '').trim();
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  const bySlug = await getPlayerBySlug(normalized);
  if (bySlug) return bySlug;
  if (!/^\d+$/.test(raw)) return null;
  const sb = initSupabase();
  if (sb) {
    const { data, error } = await sb.from('players').select('*').eq('on3_id', raw).maybeSingle();
    if (error) {
      if (isSupabaseUnavailableError(error)) {
        disableSupabase(error.message);
      } else {
        throw error;
      }
    } else {
      return rowToPlayer(data);
    }
  }
  const players = await loadPlayersLocal();
  const p = players.find((x) => String(x.on3Id || '') === raw);
  return p ? normalizePlayer(p) : null;
}

function mergeVisitOfferArrays(existingArr, incomingArr, keyFn) {
  const existing = Array.isArray(existingArr) ? existingArr : [];
  const incoming = Array.isArray(incomingArr) ? incomingArr : [];
  if (!incoming.length) return existing.length ? existing : undefined;
  const map = new Map();
  for (const item of existing) {
    const key = keyFn(item);
    if (key) map.set(key, item);
  }
  for (const item of incoming) {
    const key = keyFn(item);
    if (key) map.set(key, item);
  }
  return [...map.values()];
}

function visitArrayKey(item) {
  if (typeof item === 'string') return item.trim().toLowerCase();
  const school = String(item?.school || item?.visitSchool || item?.host || 'Florida').trim().toLowerCase();
  const date = String(item?.date || item?.visitDate || item?.visitStart || '').slice(0, 10);
  const type = String(item?.visitType || item?.type || item?.eventType || 'visit').trim().toLowerCase();
  return `${school}|${date}|${type}`;
}

function offerArrayKey(item) {
  if (typeof item === 'string') return item.trim().toLowerCase();
  const school = String(item?.school || item?.schoolName || item?.name || '').trim().toLowerCase();
  const date = String(item?.date || item?.offerDate || '').slice(0, 10);
  const type = String(item?.offerType || item?.type || 'offer').trim().toLowerCase();
  return `${school}|${date}|${type}`;
}

function preservePlayerFields(existing, incoming) {
  const identityValidator = require('./identity-record-validator');
  const { mergeCompetitorArrays } = require('./recruiting-competitor-merge');
  const merged = { ...existing, ...incoming };
  ['natlRank', 'posRank', 'stateRank', 'rating', 'ratingOverride', 'vaultGrade', 'vaultGradeUpdatedAt', 'stars', 'htWt', 'school', 'on3Id', 'commitDate', 'classYear', 'staff_lead_id', 'secondary_recruiter_id', 'hometownCity', 'hometownState', 'stateFips', 'pinLat', 'pinLng'].forEach((field) => {
    if (merged[field] == null && existing[field] != null) merged[field] = existing[field];
  });
  if (merged.school && !identityValidator.isValidSchoolField(merged.school)) {
    merged.school = identityValidator.sanitizeSchoolField(existing?.school) || null;
  }
  if (!merged.skinny && existing.skinny) merged.skinny = existing.skinny;
  if (merged.skinny && identityValidator.validatePlayerIdentityRecord({ slug: merged.slug, name: merged.name, pos: merged.pos, classYear: merged.classYear, school: merged.school, skinny: merged.skinny }).errors.includes('truncated_skinny')) {
    merged.skinny = existing.skinny && !identityValidator.validatePlayerIdentityRecord({ slug: merged.slug, name: merged.name, pos: merged.pos, classYear: merged.classYear, school: merged.school, skinny: existing.skinny }).errors.includes('truncated_skinny') ? existing.skinny : null;
  }
  if (incoming.headliner == null && existing.headliner != null) merged.headliner = existing.headliner;

  const mergedCompetitors = mergeCompetitorArrays(existing.competitors, incoming.competitors);
  if (mergedCompetitors) merged.competitors = mergedCompetitors;
  else if (Array.isArray(existing.competitors) && existing.competitors.length) merged.competitors = existing.competitors;

  const mergedVisits = mergeVisitOfferArrays(existing.visits, incoming.visits, visitArrayKey);
  if (mergedVisits) merged.visits = mergedVisits;
  else if (Array.isArray(existing.visits) && existing.visits.length) merged.visits = existing.visits;

  const mergedOffers = mergeVisitOfferArrays(existing.offers, incoming.offers, offerArrayKey);
  if (mergedOffers) merged.offers = mergedOffers;
  else if (Array.isArray(existing.offers) && existing.offers.length) merged.offers = existing.offers;

  merged.updatedAt = nowIso();
  return merged;
}

async function upsertPlayer(player, options = {}) {
  if (isBlockedPlayer(player)) {
    return null;
  }
  const existing = player?.slug ? await getPlayerBySlug(player.slug) : null;
  const merged = existing ? preservePlayerFields(existing, player) : player;
  const gm2 = require('./gm2');
  const ingress = gm2.ingestPlayer(merged, {
    subsystem: options.subsystem || 'recruiting-store',
    existing,
    repairMode: !!options.repairMode
  });
  const normalized = normalizePlayer(ingress.normalized || merged);
  if (normalized.school) {
    const identityValidator = require('./identity-record-validator');
    if (!identityValidator.isValidSchoolField(normalized.school)) {
      delete normalized.school;
    }
  }
  if (normalized.fromSchool) {
    const identityValidator = require('./identity-record-validator');
    if (!identityValidator.isValidSchoolField(normalized.fromSchool, { allowCollege: true })) {
      delete normalized.fromSchool;
    }
  }
  if (!isFloridaCommit(normalized) && normalized.category === 'recruit') {
    normalized.category = 'target';
    if (normalized.status === 'committed') normalized.status = 'uncommitted';
  }
  const sb = initSupabase();
  if (sb) {
    const { data, error } = await sb.from('players').upsert(playerToRow(normalized), { onConflict: 'slug' }).select().single();
    if (error) {
      if (isSupabaseUnavailableError(error)) {
        disableSupabase(error.message);
      } else {
        throw error;
      }
    } else {
      const saved = rowToPlayer(data);
      await syncIdentityPatterns(saved);
      try {
        require('./scouting-update-engine').queuePlayerScoutingRefresh(saved.slug, {
          reason: 'recruiting_player_update'
        });
      } catch {
        /* optional */
      }
      return saved;
    }
  }
  const players = await loadPlayersLocal();
  const idx = players.findIndex((p) => p.slug === normalized.slug);
  if (idx >= 0) players[idx] = preservePlayerFields(players[idx], normalized);
  else players.push({ ...normalized, updatedAt: nowIso() });
  await savePlayersLocal(players);
  const saved = idx >= 0 ? players[idx] : normalized;
  await syncIdentityPatterns(saved);
  try {
    require('./scouting-update-engine').queuePlayerScoutingRefresh(saved.slug, {
      reason: 'recruiting_player_update'
    });
  } catch {
    /* optional */
  }
  return saved;
}

async function syncIdentityPatterns(player) {
  try {
    const patternStore = require('./identity-patterns-store');
    const entry = await patternStore.syncPatternsForPlayer(player);
    return entry?.validation || { valid: true, missingPatterns: [] };
  } catch (err) {
    console.warn('[recruiting] identity pattern sync failed:', player?.slug, err.message);
    return { valid: false, missingPatterns: ['sync_failed'], error: err.message };
  }
}

async function getRankings() {
  const sb = initSupabase();
  if (sb) {
    const { data, error } = await sb.from('class_rankings').select('*');
    if (error) {
      if (isSupabaseUnavailableError(error)) {
        disableSupabase(error.message);
      } else {
        throw error;
      }
    } else {
      return (data || []).map((r) => ({
        classYear: r.class_year,
        nationalRank: r.national_rank,
        secRank: r.sec_rank,
        classScore: r.class_score != null ? Number(r.class_score) : null,
        source: r.source,
        updatedAt: r.updated_at
      }));
    }
  }
  return await loadRankingsLocal();
}

async function upsertRanking(ranking) {
  const row = {
    classYear: ranking.classYear,
    nationalRank: ranking.nationalRank,
    secRank: ranking.secRank,
    classScore: ranking.classScore,
    source: ranking.source || 'on3',
    updatedAt: nowIso()
  };
  const sb = initSupabase();
  if (sb) {
    const { error } = await sb.from('class_rankings').upsert({
      class_year: row.classYear,
      national_rank: row.nationalRank,
      sec_rank: row.secRank,
      class_score: row.classScore,
      source: row.source,
      updated_at: row.updatedAt
    }, { onConflict: 'class_year' });
    if (error) {
      if (isSupabaseUnavailableError(error)) {
        disableSupabase(error.message);
      } else {
        throw error;
      }
    } else {
      return row;
    }
  }
  const rankings = await loadRankingsLocal();
  const idx = rankings.findIndex((r) => r.classYear === row.classYear);
  if (idx >= 0) rankings[idx] = row;
  else rankings.push(row);
  await saveRankingsLocal(rankings);
  return row;
}

async function getEvents({ since, limit = 50 } = {}) {
  const sb = initSupabase();
  if (sb) {
    let q = sb.from('recruiting_events').select('*').order('created_at', { ascending: false }).limit(limit);
    if (since) q = q.gt('created_at', new Date(since).toISOString());
    const { data, error } = await q;
    if (error) {
      if (isSupabaseUnavailableError(error)) {
        disableSupabase(error.message);
      } else {
        throw error;
      }
    } else {
      return (data || []).map(normalizeEvent);
    }
  }
  let events = await loadEventsLocal();
  if (since) {
    const sinceTs = new Date(since).getTime();
    events = events.filter((e) => new Date(e.createdAt).getTime() > sinceTs);
  }
  return events.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit).map(normalizeEvent);
}

function normalizeEvent(raw) {
  return {
    id: raw.id,
    playerId: raw.playerId || raw.player_id || null,
    playerSlug: raw.playerSlug || raw.player_slug,
    eventType: raw.eventType || raw.event_type,
    title: raw.title,
    detail: raw.detail || '',
    skinny: raw.skinny || '',
    classYear: raw.classYear || raw.class_year || null,
    payload: raw.payload || {},
    source: raw.source || 'manual',
    createdAt: raw.createdAt || raw.created_at || nowIso()
  };
}

async function clearEvents() {
  const sb = initSupabase();
  if (sb) {
    const { error } = await sb.from('recruiting_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    return [];
  }
  await saveEventsLocal([]);
  return [];
}

async function deleteEventsMatching(predicate) {
  const events = await loadEventsLocal();
  const removed = events.filter(predicate);
  const kept = events.filter((e) => !predicate(e));
  await saveEventsLocal(kept);
  return { removed: removed.length, kept: kept.length, removedEvents: removed };
}

async function isDuplicateEvent(row) {
  const events = await loadEventsLocal();
  const since = Date.now() - 24 * 60 * 60 * 1000;
  return events.some(
    (e) =>
      e.playerSlug === row.playerSlug &&
      e.eventType === row.eventType &&
      e.title === row.title &&
      new Date(e.createdAt).getTime() > since
  );
}

async function hasExistingCommitFingerprint(fp) {
  if (!fp) return false;
  const events = await loadEventsLocal();
  return events.some((e) => {
    if (e.source !== 'on3' || !['commit', 'flip'].includes(e.eventType)) return false;
    return commitFingerprint(e.payload?.player || {}) === fp;
  });
}

async function hasExistingIntelFingerprint(fp) {
  if (!fp) return false;
  const events = await loadEventsLocal();
  return events.some((e) => {
    const efp = e.payload?.intelFingerprint || intelFingerprint(
      e.payload?.player?.on3Id || e.payload?.player?.id || e.playerId,
      e.eventType,
      e.payload?.timestamp || e.createdAt
    );
    return efp === fp;
  });
}

async function createEvent(event) {
  const gm2 = require('./gm2');
  const ingress = gm2.ingestEvent(event, { subsystem: 'recruiting-store' });
  if (ingress.action === 'reject' || ingress.action === 'quarantine') {
    console.log('[recruiting-store] GM2 blocked event:', ingress.reason, event.playerSlug, event.eventType);
    return null;
  }
  if (ingress.action === 'needs_resolution') {
    console.log('[recruiting-store] GM2 needs_resolution event:', event.playerSlug, event.eventType);
    return null;
  }

  const player = event.payload?.player;
  const fp =
    player && ['commit', 'flip'].includes(event.eventType)
      ? commitFingerprint(player)
      : null;

  const intelFp =
    !fp && event.eventType
      ? intelFingerprint(
          player?.on3Id || player?.id || event.playerId,
          event.eventType,
          event.payload?.timestamp || event.visitStart || event.createdAt
        )
      : null;

  if (intelFp) {
    const events = await loadEventsLocal();
    const existingIntel = events.find((e) => {
      const efp = e.payload?.intelFingerprint || intelFingerprint(
        e.payload?.player?.on3Id || e.payload?.player?.id || e.playerId,
        e.eventType,
        e.payload?.timestamp || e.createdAt
      );
      return efp === intelFp;
    });
    if (existingIntel) {
      console.log('[recruiting-store] Skipped duplicate intel event:', intelFp, event.playerSlug);
      return normalizeEvent(existingIntel);
    }
  }

  if (fp && (event.source || 'manual') === 'on3') {
    const events = await loadEventsLocal();
    const existing = events.find((e) => {
      if (e.source !== 'on3' || !['commit', 'flip'].includes(e.eventType)) return false;
      return commitFingerprint(e.payload?.player || {}) === fp;
    });
    if (existing) {
      console.log('[recruiting-store] Skipped duplicate commit event:', fp, event.playerSlug);
      return normalizeEvent(existing);
    }
  }

  const row = normalizeEvent({
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...event,
    payload: {
      ...(event.payload || {}),
      ...(fp ? { commitFingerprint: fp } : {}),
      ...(intelFp ? { intelFingerprint: intelFp } : {})
    },
    createdAt: nowIso()
  });
  if ((row.source || 'manual') === 'manual' && (await isDuplicateEvent(row))) {
    return row;
  }
  const sb = initSupabase();
  if (sb) {
    const { data, error } = await sb.from('recruiting_events').insert({
      player_id: row.playerId,
      player_slug: row.playerSlug,
      event_type: row.eventType,
      title: row.title,
      detail: row.detail,
      skinny: row.skinny,
      class_year: row.classYear,
      payload: row.payload,
      source: row.source
    }).select().single();
    if (error) {
      if (isSupabaseUnavailableError(error)) {
        disableSupabase(error.message);
      } else {
        throw error;
      }
    } else {
      return normalizeEvent({
        id: data.id,
        player_id: data.player_id,
        player_slug: data.player_slug,
        event_type: data.event_type,
        title: data.title,
        detail: data.detail,
        skinny: data.skinny,
        class_year: data.class_year,
        payload: data.payload,
        source: data.source,
        created_at: data.created_at
      });
    }
  }
  const events = await loadEventsLocal();
  events.unshift(row);
  await saveEventsLocal(events);
  return row;
}

async function getBoard(classYear) {
  const { filterAllowlistedTargets } = require('./recruiting-target-allowlist');
  const players = await getAllPlayers();
  const year = parseInt(classYear, 10);
  const commits = await getHubCommits(year);
  const rawTargets = players.filter(
    (p) => Number(p.classYear) === year && p.category === 'target' && !isHubCommittedStatus(p)
  );
  const targets = filterAllowlistedTargets(rawTargets, year);
  const rankings = (await getRankings()).find((r) => Number(r.classYear) === year) || null;
  return { classYear: year, commits, targets, rankings };
}

async function getPortalBoard() {
  const players = await getAllPlayers();
  const incoming = players
    .filter((p) => p.category === 'portal' && p.status !== 'portal_out')
    .map((p) => ({
      ...p,
      on3ProfileUrl: p.on3ProfileUrl || buildOn3ProfileUrl(p),
      starsDisplay: p.starsDisplay || '★'.repeat(Math.min(5, parseInt(p.stars, 10) || 0))
    }));
  const headliner = selectPortalHeadliner(incoming);
  return {
    incoming,
    count: incoming.length,
    headliner,
    headlinerSlug: headliner?.slug || null,
    headlinerSource: headliner?.headliner ? 'manual' : 'stars'
  };
}

/** Manual `headliner: true` wins; otherwise highest star count (then rating, then natl rank). */
function selectPortalHeadliner(incoming) {
  if (!incoming?.length) return null;
  const manual = incoming.find((p) => p.headliner);
  if (manual) return manual;
  return incoming.slice().sort((a, b) => {
    const starDiff = (parseInt(b.stars, 10) || 0) - (parseInt(a.stars, 10) || 0);
    if (starDiff) return starDiff;
    const ratingDiff = (Number(b.rating) || 0) - (Number(a.rating) || 0);
    if (ratingDiff) return ratingDiff;
    const aNatl = parseInt(a.natlRank, 10);
    const bNatl = parseInt(b.natlRank, 10);
    if (Number.isFinite(aNatl) && Number.isFinite(bNatl)) return aNatl - bNatl;
    return 0;
  })[0];
}

async function fireRecruitingEvent({ eventType, player, skinny, detail, source, verification = null }) {
  const et = String(eventType || '').toLowerCase();
  if (isVisitEventType(et)) {
    throw new Error('Visit intel cannot use fireRecruitingEvent — use recordVisitIntel instead');
  }

  let normalized = normalizePlayer(player);
  const existing = await getPlayerBySlug(normalized.slug);
  const monitoring = require('./recruiting-monitoring');

  if (['commit', 'flip'].includes(et)) {
    const missing = [];
    if (!normalized.name) missing.push('name');
    if (!normalized.classYear) missing.push('classYear');
    if (!normalized.on3Id && !existing?.on3Id) missing.push('on3Id');
    if (missing.length) {
      await monitoring.sendMonitoringAlert({
        level: 'warning',
        type: 'blocked_event',
        eventType: et,
        player: normalized.name || normalized.slug,
        playerSlug: normalized.slug,
        reason: `Commit blocked: missing required fields (${missing.join(', ')})`,
        source: source || 'unknown',
        meta: { missingFields: missing }
      });
      throw new Error(`Commit blocked: missing fields: ${missing.join(', ')}`);
    }
  }

  if (et === 'decommit') {
    const decommitValidator = require('./decommit-validator');
    const gate = await decommitValidator.validateDecommitEvent({
      player: normalized,
      existingPlayer: existing,
      verification,
      inferenceTrigger: verification ? null : 'unverified_on3_ingest'
    });
    if (!gate.allowed) {
      const sourceType = String(verification?.sourceType || verification?.source || source || '').toLowerCase();
      await monitoring.sendMonitoringAlert({
        level: 'warning',
        type: 'blocked_event',
        eventType: 'decommit',
        player: normalized.name || gate.playerName,
        playerSlug: normalized.slug || gate.playerSlug,
        reason: monitoring.mapDecommitBlockReason(gate, verification, source),
        source: source || 'unknown',
        meta: {
          gateReason: gate.reason,
          hasVerification: !!verification,
          explicitDecommit: !!verification?.explicitDecommit,
          sourceType: sourceType || null,
          snapshotAbsenceDetected:
            gate.reason === 'snapshot_absence' ||
            gate.reason === 'missing_from_board' ||
            !verification
        }
      });
      throw new Error(`Decommit blocked: ${gate.reason}`);
    }
  }

  if (existing) normalized = preservePlayerFields(existing, normalized);
  const statusMap = {
    commit: 'committed',
    decommit: 'decommitted',
    flip: 'committed',
    portal_in: 'portal_in',
    portal_out: 'portal_out',
    target_update: 'target'
  };
  normalized.status = statusMap[et] || normalized.status;
  if (['commit', 'flip'].includes(et)) {
    normalized.committedTo = 'Florida';
    normalized.category = 'recruit';
    normalized.status = 'committed';
  }
  if (et === 'decommit') {
    normalized.status = 'decommitted';
    normalized.committedTo = verification?.currentCommit || null;
    normalized.category = normalized.category === 'portal' ? 'portal' : 'recruit';
  }
  normalized.skinny = skinny || normalized.skinny;
  normalized.updatedAt = nowIso();
  const saved = await upsertPlayer(normalized);

  const titles = {
    commit: `${saved.name} commits to Florida`,
    decommit: `${saved.name} decommits from Florida`,
    flip: `${saved.name} flips to Florida`,
    portal_in:
      saved.committedTo === 'Florida' || saved.status === 'enrolled'
        ? `${saved.name} transfers to Florida`
        : `${saved.name} enrolls via portal`,
    portal_out: `${saved.name} portal exit confirmed`,
    target_update: `Update: ${saved.name}`,
    ranking_change: `Class ranking update`
  };

  const event = await createEvent({
    playerId: saved.id,
    playerSlug: saved.slug,
    eventType,
    title: titles[eventType] || `Recruiting update: ${saved.name}`,
    detail: detail || saved.profileNote || '',
    skinny: skinny || saved.skinny || `${saved.pos} · ${saved.stars}★ · ${saved.school}`,
    classYear: saved.classYear,
    payload: {
      player: saved,
      verifiedDecommit: et === 'decommit',
      verification: et === 'decommit' ? verification : undefined
    },
    source: source || 'manual'
  });

  monitoring.recordFiredEvent({ eventType: et, playerSlug: saved.slug, source: source || 'manual' });

  return { player: saved, event };
}

function storageMode() {
  return initSupabase() ? 'supabase' : 'local';
}

async function upsertTargetFromVisitIntel(intel) {
  if (!intel?.playerSlug && !intel?.playerName) return null;
  const slug = intel.playerSlug || slugify(intel.playerName);
  const existing = await getPlayerBySlug(slug);
  if (existing && isFloridaCommit(existing)) return existing;

  const isCancel = intel.eventType === 'visit_cancelled' || intel.eventType === 'ov_change';
  const eventType =
    isCancel ? 'visit_cancelled' : intel.eventType === 'official_visit' || intel.eventType === 'unofficial_visit'
      ? intel.eventType
      : intel.eventType || 'target_update';

  const mergedPlayer = {
    ...(existing || {}),
    slug,
    name: intel.playerName || existing?.name,
    pos: intel.pos || existing?.pos,
    classYear: intel.classYear || existing?.classYear,
    school: intel.school || existing?.school,
    stars: intel.stars || existing?.stars,
    natlRank: intel.natlRank || existing?.natlRank,
    committedTo: existing?.committedTo ?? null,
    nextVisitSchool: intel.nextVisitSchool || existing?.nextVisitSchool
  };
  const copy = require('./recruiting-alert-templates').buildRecruitingCopy({
    player: mergedPlayer,
    existing,
    eventType,
    row: intel
  });

  const patch = {
    slug,
    name: intel.playerName || existing?.name,
    pos: intel.pos || existing?.pos,
    classYear: intel.classYear || existing?.classYear,
    on3Id: intel.playerId || existing?.on3Id,
    category: 'target',
    status: 'uncommitted',
    committedTo: existing?.committedTo ?? null,
    skinny: copy.skinny,
    profileNote: copy.profileNote
  };

  if (isCancel) {
    patch.ufOvStatus = 'cancelled';
    patch.ufOvCancelledAt = intel.timestamp || intel.reportedAt || nowIso();
    patch.nextVisitSchool = intel.nextVisitSchool || existing?.nextVisitSchool || null;
    patch.visitStart = null;
    patch.visitEnd = null;
  } else if (intel.eventType === 'official_visit' || intel.eventType === 'unofficial_visit') {
    patch.visitStart = intel.visitStart || existing?.visitStart || null;
    patch.visitEnd = intel.visitEnd || existing?.visitEnd || null;
    patch.ufOvStatus = 'scheduled';
  }

  if (existing) return upsertPlayer(preservePlayerFields(existing, patch));
  return upsertPlayer(patch);
}

module.exports = {
  slugify,
  isFloridaCommit,
  isHubFloridaCommitStatus,
  isCommittedAnywhere,
  normalizePlayer,
  preservePlayerFields,
  mergeVisitOfferArrays,
  visitArrayKey,
  offerArrayKey,
  getStoreInfo,
  getAllPlayers,
  getPlayerBySlug,
  resolvePlayerKey,
  findBySlug,
  findByNameAndClass,
  upsertPlayer,
  getRankings,
  upsertRanking,
  getEvents,
  createEvent,
  clearEvents,
  deleteEventsMatching,
  getBoard,
  getHubCommits,
  getPortalBoard,
  selectPortalHeadliner,
  fireRecruitingEvent,
  upsertTargetFromVisitIntel,
  storageMode,
  DATA_DIR,
  PLAYERS_PATH
};
