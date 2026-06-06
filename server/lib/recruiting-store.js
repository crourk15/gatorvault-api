const fs = require('fs');
const path = require('path');
const { slugify } = require('./slug');

const DATA_DIR = path.join(__dirname, '..', 'data', 'recruiting');
const PLAYERS_PATH = path.join(DATA_DIR, 'players.json');
const EVENTS_PATH = path.join(DATA_DIR, 'events.json');
const RANKINGS_PATH = path.join(DATA_DIR, 'rankings.json');

let supabase = null;

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

function normalizePlayer(raw) {
  const slug = raw.slug || slugify(raw.name);
  return {
    id: raw.id || slug,
    slug,
    name: raw.name,
    pos: raw.pos,
    classYear: raw.classYear || raw.class_year || null,
    school: raw.school || '',
    htWt: raw.htWt || raw.ht_wt || '',
    stars: raw.stars || 0,
    rating: raw.rating != null ? Number(raw.rating) : null,
    natlRank: raw.natlRank || raw.natl_rank || raw.natl || null,
    posRank: raw.posRank || raw.pos_rank || null,
    stateRank: raw.stateRank || raw.state_rank || raw.stRk || null,
    inState: !!(raw.inState ?? raw.in_state),
    category: raw.category || 'recruit',
    status: raw.status || 'committed',
    committedTo: raw.committedTo || raw.committed_to || 'Florida',
    fromSchool: raw.fromSchool || raw.from_school || null,
    commitDate: raw.commitDate || raw.commit_date || raw.date || null,
    skinny: raw.skinny || raw.note || '',
    profileNote: raw.profileNote || raw.profile_note || '',
    on3Id: raw.on3Id || raw.on3_id || null,
    starsDisplay: raw.starsDisplay || raw.stars_display || null,
    updatedAt: raw.updatedAt || raw.updated_at || nowIso()
  };
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
  if (sb) {
    const { data, error } = await sb.from('players').select('*').order('updated_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToPlayer);
  }
  return (await loadPlayersLocal()).map(normalizePlayer);
}

async function getPlayerBySlug(slug) {
  const sb = initSupabase();
  if (sb) {
    const { data, error } = await sb.from('players').select('*').eq('slug', slug).maybeSingle();
    if (error) throw error;
    return rowToPlayer(data);
  }
  const players = await loadPlayersLocal();
  const p = players.find((x) => x.slug === slug);
  return p ? normalizePlayer(p) : null;
}

function preservePlayerFields(existing, incoming) {
  const merged = { ...existing, ...incoming };
  ['natlRank', 'posRank', 'stateRank', 'rating', 'stars', 'htWt', 'school', 'on3Id', 'commitDate', 'classYear'].forEach((field) => {
    if (merged[field] == null && existing[field] != null) merged[field] = existing[field];
  });
  if (!merged.skinny && existing.skinny) merged.skinny = existing.skinny;
  merged.updatedAt = nowIso();
  return merged;
}

async function upsertPlayer(player) {
  const normalized = normalizePlayer(player);
  const sb = initSupabase();
  if (sb) {
    const { data, error } = await sb.from('players').upsert(playerToRow(normalized), { onConflict: 'slug' }).select().single();
    if (error) throw error;
    return rowToPlayer(data);
  }
  const players = await loadPlayersLocal();
  const idx = players.findIndex((p) => p.slug === normalized.slug);
  if (idx >= 0) players[idx] = preservePlayerFields(players[idx], normalized);
  else players.push({ ...normalized, updatedAt: nowIso() });
  await savePlayersLocal(players);
  return idx >= 0 ? players[idx] : normalized;
}

async function getRankings() {
  const sb = initSupabase();
  if (sb) {
    const { data, error } = await sb.from('class_rankings').select('*');
    if (error) throw error;
    return (data || []).map((r) => ({
      classYear: r.class_year,
      nationalRank: r.national_rank,
      secRank: r.sec_rank,
      classScore: r.class_score != null ? Number(r.class_score) : null,
      source: r.source,
      updatedAt: r.updated_at
    }));
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
    if (error) throw error;
    return row;
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
    if (error) throw error;
    return (data || []).map(normalizeEvent);
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

async function createEvent(event) {
  const row = normalizeEvent({
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...event,
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
    if (error) throw error;
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
  const events = await loadEventsLocal();
  events.unshift(row);
  await saveEventsLocal(events);
  return row;
}

async function getBoard(classYear) {
  const players = await getAllPlayers();
  const year = parseInt(classYear, 10);
  const commits = players.filter((p) => p.category === 'recruit' && p.classYear === year);
  const targets = players.filter((p) => p.category === 'target' && p.classYear === year);
  const rankings = (await getRankings()).find((r) => r.classYear === year) || null;
  return { classYear: year, commits, targets, rankings };
}

async function getPortalBoard() {
  const players = await getAllPlayers();
  const incoming = players.filter((p) => p.category === 'portal' && p.status !== 'portal_out');
  return { incoming, count: incoming.length };
}

async function fireRecruitingEvent({ eventType, player, skinny, detail, source }) {
  let normalized = normalizePlayer(player);
  const existing = await getPlayerBySlug(normalized.slug);
  if (existing) normalized = preservePlayerFields(existing, normalized);
  const statusMap = {
    commit: 'committed',
    decommit: 'decommitted',
    flip: 'committed',
    portal_in: 'portal_in',
    portal_out: 'portal_out',
    target_update: 'target'
  };
  normalized.status = statusMap[eventType] || normalized.status;
  normalized.skinny = skinny || normalized.skinny;
  normalized.updatedAt = nowIso();
  const saved = await upsertPlayer(normalized);

  const titles = {
    commit: `${saved.name} commits to Florida`,
    decommit: `${saved.name} decommits from Florida`,
    flip: `${saved.name} flips to Florida`,
    portal_in: `${saved.name} enters portal — UF target`,
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
    payload: { player: saved },
    source: source || 'manual'
  });

  return { player: saved, event };
}

function storageMode() {
  return initSupabase() ? 'supabase' : 'local';
}

module.exports = {
  slugify,
  normalizePlayer,
  getAllPlayers,
  getPlayerBySlug,
  upsertPlayer,
  getRankings,
  upsertRanking,
  getEvents,
  createEvent,
  clearEvents,
  getBoard,
  getPortalBoard,
  fireRecruitingEvent,
  storageMode,
  DATA_DIR,
  PLAYERS_PATH
};
