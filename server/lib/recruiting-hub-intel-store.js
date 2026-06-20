/**
 * Recruiting Hub Intel Store — curated UF recruiting movement + battle board.
 * No beat tweets, roster noise, or generic UF news.
 */
const fs = require('fs');
const path = require('path');
const store = require('./recruiting-store');
const intelStore = require('./recruiting-intel-store');
const { enrichBoard } = require('./recruiting-board-enrich');
const {
  resolveUfScore,
  deriveUfScoreInputs,
  calcUfScore,
  getBattleDifficulty,
  getBattleColor,
  normalizePipelineScore,
} = require('./recruiting-hub-scoring');
const {
  extractRealCompetitors,
  topCompetitorScore,
  resolveStrictUfScore,
} = require('./recruiting-hub-competitors');

const HUB_CLASS_YEARS = [2027, 2028, 2029];
const FEED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const VERIFIED_SOURCES = new Set(['on3', 'manual', 'rivals_pm']);

const BLOCKED_SOURCE = /beat_writer|auto:beat|twitter|x_post|x-autoposter|podcast|program_news|camp_recap|live_feed|headline/i;

const ALLOWED_INTEL_EVENTS = new Set([
  'official_visit',
  'unofficial_visit',
  'visit_cancelled',
  'ov_change',
  'visit',
  'offer',
  'prediction',
  'prediction_change',
  'rivals_futurecast',
  'ranking_change',
  'target_update',
  'staff_note',
  'momentum_up',
  'momentum_down',
  'flip_watch',
  'commit_watch',
]);

const PUBLIC_VISIT = new Set(['official_visit', 'unofficial_visit', 'visit_cancelled', 'ov_change', 'visit']);

const BLOCKED_SUMMARY = /podcast|camp recap|gator tales|gnfp|breakdown show|listen now|spotify|apple podcasts|youtube\.com\/watch/i;

function playerPos(player) {
  return player?.position || player?.pos || '—';
}

function parseUfPct(raw) {
  if (raw == null || !Number.isFinite(Number(raw))) return 0;
  const num = Number(raw);
  return Math.min(100, Math.max(0, Math.round(num <= 1 ? num * 100 : num)));
}

function profileUrl(player) {
  const slug = player?.slug || String(player?.name || '').toLowerCase().replace(/\s+/g, '-');
  return `/vault/recruiting/player/${encodeURIComponent(slug)}`;
}

function formatNextVisit(player) {
  if (!player?.visitStart) return null;
  const d = new Date(player.visitStart);
  if (Number.isNaN(d.getTime())) return String(player.visitStart);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function shortNote(player) {
  const note = player?.notePreview ?? player?.skinny ?? player?.notes;
  if (!note || !String(note).trim()) return null;
  const text = String(note).trim();
  return text.length > 140 ? `${text.slice(0, 137)}…` : text;
}

function schoolInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '—';
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts.map((p) => p[0]).join('').slice(0, 4).toUpperCase();
}

function isFloridaSchool(value) {
  return /florida|gators|\buf\b/i.test(String(value || ''));
}

function isRosterPlayer(player) {
  const lc = String(player?.lifecycle || '').toUpperCase();
  const cat = String(player?.category || '').toLowerCase();
  return lc === 'ROSTER' || cat === 'roster';
}

function isActivePortalTarget(player) {
  const cat = String(player?.category || '').toLowerCase();
  const st = String(player?.status || '').toLowerCase();
  const isPortal =
    cat === 'portal' ||
    st.includes('portal') ||
    String(player?.lifecycle || '').toUpperCase() === 'PORTAL';
  if (!isPortal) return false;
  if (player.isCommittedToUF) return false;
  if (player.committedTo && isFloridaSchool(player.committedTo)) return false;
  if (player.committedTo && !isFloridaSchool(player.committedTo)) return false;
  return (
    parseUfPct(player.ufProbability) >= 34 ||
    player.tier === 'TOP' ||
    player.tier === 'HIGH' ||
    player.isTarget
  );
}

function normalizePoolPlayer(player, classYear, kind) {
  return {
    slug: String(player.slug || '').toLowerCase(),
    name: player.name,
    position: playerPos(player),
    classYear: player.classYear || classYear,
    ufProbability: player.ufProbability,
    movementDirection: player.movementDirection,
    tier: player.tier,
    visitStart: player.visitStart,
    notePreview: player.notePreview,
    skinny: player.skinny,
    notes: player.notes,
    leaderSchool: player.leaderSchool ?? player.predictionLeader ?? player.topSchool ?? null,
    isCommit: kind === 'commit',
    isPortal: kind === 'portal',
    profileUrl: profileUrl(player),
  };
}

async function loadHubRecruitingPool() {
  const pool = new Map();

  for (const year of HUB_CLASS_YEARS) {
    const board = await store.getBoard(year);
    const enriched = enrichBoard(board, false);
    for (const player of enriched.targets || []) {
      if (!player.slug || isRosterPlayer(player)) continue;
      pool.set(String(player.slug).toLowerCase(), normalizePoolPlayer(player, year, 'target'));
    }
  }

  const all = await store.getAllPlayers();
  for (const player of all) {
    if (!player.slug || isRosterPlayer(player)) continue;
    const year = Number(player.classYear);
    if (isActivePortalTarget(player)) {
      pool.set(String(player.slug).toLowerCase(), normalizePoolPlayer(player, year || 2027, 'portal'));
      continue;
    }
    if (HUB_CLASS_YEARS.includes(year) && player.isTarget && !player.isCommittedToUF) {
      if (!pool.has(String(player.slug).toLowerCase())) {
        pool.set(String(player.slug).toLowerCase(), normalizePoolPlayer(player, year, 'target'));
      }
    }
  }

  return pool;
}

function intelMatchesPool(row, pool) {
  const slug = String(row.playerSlug || row.player_slug || '').toLowerCase();
  if (!slug || !pool.has(slug)) return false;
  const meta = pool.get(slug);
  if (meta.isCommit) return false;
  if (meta.isPortal && row.eventType === 'offer') {
    const cy = Number(row.classYear || meta.classYear);
    if (!HUB_CLASS_YEARS.includes(cy)) return false;
  }
  return true;
}

function isCuratedHubIntel(row, pool) {
  if (!row || row.resolutionStatus === 'needs_resolution' || row.surfaced === false) return false;
  if (!row.playerSlug || !row.playerName) return false;
  if (row.ufRelevant === false) return false;
  if (!intelMatchesPool(row, pool)) return false;

  const source = String(row.source || '').toLowerCase();
  if (BLOCKED_SOURCE.test(source)) return false;
  if (!VERIFIED_SOURCES.has(source)) return false;

  const et = String(row.eventType || '').toLowerCase();
  if (!ALLOWED_INTEL_EVENTS.has(et)) return false;
  if (et === 'commit' || et === 'flip' || et === 'decommit' || et === 'portal_out') return false;
  if (et === 'portal_in' && !pool.get(String(row.playerSlug).toLowerCase())?.isPortal) return false;
  if (et === 'offer') {
    const meta = pool.get(String(row.playerSlug).toLowerCase());
    if (meta?.isPortal) return false;
  }

  const summary = String(row.detail || row.text || '').trim();
  if (!summary || summary.length < 8) return false;
  if (BLOCKED_SUMMARY.test(summary)) return false;
  if (/^https?:\/\//i.test(summary) && !row.playerName) return false;

  return true;
}

function mapIntelEventType(row) {
  const et = String(row.eventType || '').toLowerCase();
  const delta = Number(row.movementDelta);
  if (PUBLIC_VISIT.has(et)) return 'visit';
  if (et === 'offer') return 'offer';
  if (delta > 0 || et === 'momentum_up' || et === 'flip_watch') return 'up';
  if (delta < 0 || et === 'momentum_down') return 'down';
  if (Number.isFinite(delta) && delta !== 0) return delta > 0 ? 'up' : 'down';
  return 'intel';
}

function buildIntelSummary(row, meta) {
  const et = String(row.eventType || '').toLowerCase();
  const detail = String(row.detail || row.text || '').trim();
  const name = meta?.name || row.playerName;

  if (PUBLIC_VISIT.has(et)) {
    if (/cancel/i.test(et) || /cancel/i.test(detail)) return `${name} — visit canceled`;
    if (row.visitDates || row.visitStart) return `${name} — visit scheduled (${row.visitDates || row.visitStart})`;
    return `${name} — visit update`;
  }
  if (et === 'offer') return `${name} — offer extended`;
  if (et === 'ranking_change') return `${name} — ranking movement`;
  if (et === 'prediction' || et === 'prediction_change' || et === 'rivals_futurecast') {
    return `${name} — battle movement (${detail.slice(0, 90)})`;
  }
  if (et === 'staff_note' || et === 'target_update') return `${name} — staff reaction: ${detail.slice(0, 100)}`;
  if (et === 'flip_watch' || et === 'commit_watch') return `${name} — ${detail.slice(0, 110)}`;

  const delta = Number(row.movementDelta);
  if (Number.isFinite(delta) && delta !== 0) {
    return `${name} — UF momentum ${delta > 0 ? 'up' : 'down'} (${delta > 0 ? '+' : ''}${delta})`;
  }

  return detail.length > 140 ? `${detail.slice(0, 137)}…` : detail;
}

function mapIntelToFeedItem(row, meta) {
  return {
    id: String(row.fingerprint || row.id),
    timestamp: row.reportedAt || row.timestamp || row.createdAt,
    name: meta.name,
    position: meta.position,
    class: meta.classYear,
    event: mapIntelEventType(row),
    summary: buildIntelSummary(row, meta),
    profileUrl: meta.profileUrl,
  };
}

const RECENT_VISIT_MS = 14 * 24 * 60 * 60 * 1000;

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isRelevantVisit(visitStart) {
  if (!visitStart) return false;
  const d = new Date(visitStart);
  if (Number.isNaN(d.getTime())) return false;
  const diffMs = startOfDay(d).getTime() - startOfDay(new Date()).getTime();
  return diffMs >= -RECENT_VISIT_MS;
}

function visitTimestamp(visitStart) {
  const d = new Date(visitStart);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function isRecruitingNote(text) {
  const trimmed = String(text || '').trim();
  if (trimmed.length < 8) return false;
  if (BLOCKED_SUMMARY.test(trimmed)) return false;
  return true;
}

function qualifiesInsiderIntel(meta) {
  if (meta.tier === 'TOP' || meta.tier === 'HIGH') return true;
  return parseUfPct(meta.ufProbability) >= 34;
}

function boardVisitItem(meta) {
  const formatted = formatNextVisit(meta) || String(meta.visitStart);
  return {
    id: `board-visit-${meta.slug}`,
    timestamp: visitTimestamp(meta.visitStart),
    name: meta.name,
    position: meta.position,
    class: meta.classYear,
    event: 'visit',
    summary: `${meta.name} — visit scheduled (${formatted})`,
    profileUrl: meta.profileUrl,
  };
}

function boardInsiderIntelItem(meta, note) {
  const summary = note.length > 140 ? `${note.slice(0, 137)}…` : note;
  return {
    id: `board-intel-${meta.slug}`,
    timestamp: new Date().toISOString(),
    name: meta.name,
    position: meta.position,
    class: meta.classYear,
    event: 'intel',
    summary,
    profileUrl: meta.profileUrl,
  };
}

function boardCompetitorChangeItem(meta, row) {
  const school =
    row.predictionSchool ||
    row.nextVisitSchool ||
    row.competitorSchool ||
    'competitor';
  return {
    id: `board-competitor-${meta.slug}-${row.fingerprint || row.id}`,
    timestamp: row.reportedAt || row.timestamp || row.createdAt || new Date().toISOString(),
    name: meta.name,
    position: meta.position,
    class: meta.classYear,
    event: mapIntelEventType(row),
    summary: `${meta.name} — battle movement (${school})`,
    profileUrl: meta.profileUrl,
  };
}

function hasRecordedOffer(player) {
  if (countFloridaOffers(player) > 0) return true;
  const ov = String(player.ufOvStatus || '').toUpperCase();
  return ov.includes('OFFER');
}

function boardOfferItem(meta) {
  return {
    id: `board-offer-${meta.slug}`,
    timestamp: new Date().toISOString(),
    name: meta.name,
    position: meta.position,
    class: meta.classYear,
    event: 'offer',
    summary: `${meta.name} — UF offer on record`,
    profileUrl: meta.profileUrl,
  };
}
function boardMovementItem(meta) {
  const summary =
    meta.notePreview ??
    meta.skinny ??
    (meta.movementDirection === 'up'
      ? `${meta.name} — UF trending up on the board`
      : `${meta.name} — UF trending down on the board`);

  return {
    id: `board-${meta.slug}-${meta.movementDirection}`,
    timestamp: new Date().toISOString(),
    name: meta.name,
    position: meta.position,
    class: meta.classYear,
    event: meta.movementDirection === 'up' ? 'up' : 'down',
    summary: String(summary).slice(0, 140),
    profileUrl: meta.profileUrl,
  };
}

async function buildHubMovementFeed() {
  const pool = await loadHubRecruitingPool();
  const rawMap = loadRawPlayerMap();
  const cutoff = Date.now() - FEED_WINDOW_MS;
  const rows = intelStore.listIntel({ limit: 600 });
  const items = [];
  const covered = new Set();

  for (const row of rows) {
    const ts = new Date(row.reportedAt || row.timestamp || row.createdAt).getTime();
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    if (!isCuratedHubIntel(row, pool)) continue;
    const slug = String(row.playerSlug).toLowerCase();
    const meta = pool.get(slug);
    items.push(mapIntelToFeedItem(row, meta));
    covered.add(slug);
  }

  for (const meta of pool.values()) {
    if (meta.isCommit) continue;
    if (covered.has(meta.slug)) continue;
    const raw = rawMap.get(String(meta.slug).toLowerCase()) || {};
    const merged = { ...raw, ...meta };

    if (isRelevantVisit(meta.visitStart)) {
      items.push(boardVisitItem(meta));
      covered.add(meta.slug);
      continue;
    }

    if (hasRecordedOffer(merged)) {
      items.push(boardOfferItem(meta));
      covered.add(meta.slug);
      continue;
    }

    const slugIntel = rows.filter(
      (r) => String(r.playerSlug || r.player_slug || '').toLowerCase() === String(meta.slug).toLowerCase()
    );
    const competitorRow = slugIntel.find((row) => {
      const ts = new Date(row.reportedAt || row.timestamp || row.createdAt).getTime();
      if (!Number.isFinite(ts) || ts < cutoff) return false;
      const et = String(row.eventType || '').toLowerCase();
      return (
        et === 'prediction_change' ||
        et === 'rivals_futurecast' ||
        et === 'prediction' ||
        row.predictionSchool ||
        row.nextVisitSchool
      );
    });
    if (competitorRow) {
      items.push(boardCompetitorChangeItem(meta, competitorRow));
      covered.add(meta.slug);
      continue;
    }

    if (meta.movementDirection !== 'up' && meta.movementDirection !== 'down') continue;
    items.push(boardMovementItem(meta));
    covered.add(meta.slug);
  }

  const seen = new Set();
  const deduped = [];
  for (const item of items.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )) {
    const key = `${item.id}:${item.summary.slice(0, 48)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
    if (deduped.length >= 25) break;
  }

  return deduped;
}

const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]);

const STAFF_ALLOWLIST = {
  sumrall: { staffId: 'sumrall', name: 'Jon Sumrall', role: 'Head Coach' },
  faulkner: { staffId: 'faulkner', name: 'Buster Faulkner', role: 'Offensive Coordinator' },
  white: { staffId: 'white', name: 'Brad White', role: 'Defensive Coordinator' },
  chatman: { staffId: 'chatman', name: 'Gerald Chatman', role: 'Assistant Head Coach / DL' },
  collins: { staffId: 'collins', name: 'Chris Collins', role: 'Linebackers Coach' },
  craddock: { staffId: 'craddock', name: 'Joe Craddock', role: 'Quarterbacks Coach' },
  davis: { staffId: 'davis', name: 'Marcus Davis', role: 'Outside Wide Receivers Coach' },
  foster: { staffId: 'foster', name: 'Chris Foster', role: 'Running Backs Coach' },
  galante: { staffId: 'galante', name: 'Johnathan Galante', role: 'Special Teams Coordinator' },
  gasparato: { staffId: 'gasparato', name: 'Greg Gasparato', role: 'Safeties Coach' },
  hardmon: { staffId: 'hardmon', name: 'Bam Hardmon', role: 'Cornerbacks Coach' },
  harris: { staffId: 'harris', name: 'Brandon Harris', role: 'Director of Player Personnel' },
  mckissack: { staffId: 'mckissack', name: 'Evan McKissack', role: 'Tight Ends Coach' },
  mcknight: { staffId: 'mcknight', name: 'Trent McKnight', role: 'Passing Game Coordinator / WR' },
  trautwein: { staffId: 'trautwein', name: 'Phil Trautwein', role: 'Offensive Line Coach' },
  'katie-turner': { staffId: 'katie-turner', name: 'Katie Turner', role: 'Recruiting Operations' },
  'chris-prescott': { staffId: 'chris-prescott', name: 'Chris Prescott', role: 'Recruiting Personnel' },
  'drew-hughes': { staffId: 'drew-hughes', name: 'Drew Hughes', role: 'Recruiting Personnel' },
  'cody-collins': { staffId: 'cody-collins', name: 'Cody Collins', role: 'Recruiting Personnel' },
  'nick-mcdonald': { staffId: 'nick-mcdonald', name: 'Nick McDonald', role: 'Recruiting Personnel' },
  'drew-raucina': { staffId: 'drew-raucina', name: 'Drew Raucina', role: 'Recruiting Personnel' },
  'joe-hamilton': { staffId: 'joe-hamilton', name: 'Joe Hamilton', role: 'Recruiting Personnel' },
  'skylar-wise': { staffId: 'skylar-wise', name: 'Skylar Wise', role: 'Recruiting Personnel' },
};

const STATE_CENTROIDS = {
  AL: { lat: 32.806671, lng: -86.79113 },
  AK: { lat: 61.370716, lng: -152.404419 },
  AZ: { lat: 33.729759, lng: -111.431221 },
  AR: { lat: 34.969704, lng: -92.373123 },
  CA: { lat: 36.116203, lng: -119.681564 },
  CO: { lat: 39.059811, lng: -105.311104 },
  CT: { lat: 41.597782, lng: -72.755371 },
  DE: { lat: 39.318523, lng: -75.507141 },
  FL: { lat: 27.766279, lng: -81.686783 },
  GA: { lat: 33.040619, lng: -83.643074 },
  HI: { lat: 21.094318, lng: -157.498337 },
  ID: { lat: 44.240459, lng: -114.478828 },
  IL: { lat: 40.349457, lng: -88.986137 },
  IN: { lat: 39.849426, lng: -86.258278 },
  IA: { lat: 42.011539, lng: -93.210526 },
  KS: { lat: 38.5266, lng: -96.726486 },
  KY: { lat: 37.66814, lng: -84.670067 },
  LA: { lat: 31.169546, lng: -91.867805 },
  ME: { lat: 44.693947, lng: -69.381927 },
  MD: { lat: 39.063946, lng: -76.802101 },
  MA: { lat: 42.230171, lng: -71.530106 },
  MI: { lat: 43.326618, lng: -84.536095 },
  MN: { lat: 45.694454, lng: -93.900192 },
  MS: { lat: 32.741646, lng: -89.678696 },
  MO: { lat: 38.456085, lng: -92.288368 },
  MT: { lat: 46.921925, lng: -110.454353 },
  NE: { lat: 41.12537, lng: -98.268082 },
  NV: { lat: 38.313515, lng: -117.055374 },
  NH: { lat: 43.452492, lng: -71.563896 },
  NJ: { lat: 40.298904, lng: -74.521011 },
  NM: { lat: 34.840515, lng: -106.248482 },
  NY: { lat: 42.165726, lng: -74.948051 },
  NC: { lat: 35.630066, lng: -79.806419 },
  ND: { lat: 47.528912, lng: -99.784012 },
  OH: { lat: 40.388783, lng: -82.764915 },
  OK: { lat: 35.565342, lng: -96.928917 },
  OR: { lat: 44.572021, lng: -122.070938 },
  PA: { lat: 40.590752, lng: -77.209755 },
  RI: { lat: 41.680893, lng: -71.51178 },
  SC: { lat: 33.856892, lng: -80.945007 },
  SD: { lat: 44.299782, lng: -99.438828 },
  TN: { lat: 35.747845, lng: -86.692345 },
  TX: { lat: 31.054487, lng: -97.563461 },
  UT: { lat: 40.150032, lng: -111.862434 },
  VT: { lat: 44.045876, lng: -72.710686 },
  VA: { lat: 37.769337, lng: -78.169968 },
  WA: { lat: 47.400902, lng: -121.490494 },
  WV: { lat: 38.491226, lng: -80.954453 },
  WI: { lat: 44.268543, lng: -89.616508 },
  WY: { lat: 42.755966, lng: -107.30249 },
  DC: { lat: 38.897438, lng: -77.026817 },
};

const PLAYERS_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'players.json');
const MOMENTUM_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const OFFER_INTEL_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

function parseCityState(text) {
  const m = String(text || '').match(/,\s*([A-Z]{2})\b/);
  return m ? m[1] : null;
}

function resolvePlayerState(player) {
  const direct = player?.state || player?.hometownState || player?.hometown_state || null;
  if (direct) {
    const trimmed = String(direct).trim();
    if (trimmed.length === 2 && US_STATE_CODES.has(trimmed.toUpperCase())) {
      return trimmed.toUpperCase();
    }
    const parsed = parseCityState(trimmed);
    if (parsed && US_STATE_CODES.has(parsed)) return parsed;
  }
  for (const field of [player?.school, player?.skinny, player?.scoutingReport]) {
    const parsed = parseCityState(field);
    if (parsed && US_STATE_CODES.has(parsed)) return parsed;
  }
  return null;
}

function loadRawPlayerMap() {
  try {
    const raw = JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf8'));
    const map = new Map();
    for (const p of raw) {
      if (p.slug) map.set(String(p.slug).toLowerCase(), p);
    }
    return map;
  } catch {
    return new Map();
  }
}

function resolveStaffEntry(player) {
  const rawId =
    player.staff_lead_id ||
    player.staffLeadId ||
    player.secondary_recruiter_id ||
    player.secondaryRecruiterId ||
    null;
  if (!rawId) return null;
  const key = String(rawId).toLowerCase().trim();
  if (STAFF_ALLOWLIST[key]) return STAFF_ALLOWLIST[key];
  for (const entry of Object.values(STAFF_ALLOWLIST)) {
    if (entry.name.toLowerCase() === key || entry.staffId === key) return entry;
  }
  return null;
}

function countFloridaOffers(player) {
  let count = 0;
  const lists = [player.offers, player.offerList].filter(Array.isArray);
  for (const list of lists) {
    for (const offer of list) {
      const school =
        typeof offer === 'string' ? offer : offer?.school || offer?.schoolName || offer?.name || '';
      if (isFloridaSchool(school)) count += 1;
    }
  }
  return count;
}

function countFloridaVisits(player) {
  let count = 0;
  if (player.visitStart && isFloridaSchool(player.nextVisitSchool)) count += 1;

  const visitArrays = [player.visits, player.visitHistory].filter(Array.isArray);
  for (const arr of visitArrays) {
    for (const visit of arr) {
      if (!visit) continue;
      const school =
        typeof visit === 'string'
          ? visit
          : visit.school || visit.visitSchool || visit.host || visit.location || '';
      if (isFloridaSchool(school)) count += 1;
    }
  }
  return count;
}

function classifyIntelSentiment(row) {
  const et = String(row.eventType || '').toLowerCase();
  const delta = Number(row.movementDelta);
  if (et === 'momentum_down' || et === 'visit_cancelled' || delta < 0) return 'negative';
  if (
    et === 'momentum_up' ||
    et === 'offer' ||
    et === 'official_visit' ||
    et === 'unofficial_visit' ||
    et === 'visit' ||
    et === 'flip_watch' ||
    delta > 0
  ) {
    return 'positive';
  }
  return null;
}

function topCompetitorScoreForPlayer(player, intelRows) {
  const competitors = extractRealCompetitors(player, intelRows);
  return topCompetitorScore(competitors);
}

async function loadHubFootprintPlayers() {
  const rawMap = loadRawPlayerMap();
  const seen = new Set();
  const players = [];

  function addPlayer(enriched, kind) {
    const slug = String(enriched.slug || '').toLowerCase();
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    const raw = rawMap.get(slug) || {};
    players.push({
      ...raw,
      ...enriched,
      _footprintKind: kind,
    });
  }

  for (const year of HUB_CLASS_YEARS) {
    const board = await store.getBoard(year);
    const enriched = enrichBoard(board, false);
    for (const p of enriched.commits || []) {
      if (!p.slug || isRosterPlayer(p)) continue;
      addPlayer(p, 'commit');
    }
    for (const p of enriched.targets || []) {
      if (!p.slug || isRosterPlayer(p)) continue;
      addPlayer(p, 'target');
    }
  }

  const all = await store.getAllPlayers();
  for (const p of all) {
    const slug = String(p.slug || '').toLowerCase();
    if (!slug || seen.has(slug) || isRosterPlayer(p)) continue;
    const raw = rawMap.get(slug) || {};
    const merged = { ...raw, ...p };
    if (isActivePortalTarget(merged)) {
      addPlayer(merged, 'portal');
    }
  }

  return players;
}

async function buildHubFootprint() {
  const hubPlayers = await loadHubFootprintPlayers();
  const intelRows = intelStore.listIntel({ limit: 2000 });
  const now = Date.now();
  const cutoffMomentum = now - MOMENTUM_WINDOW_MS;
  const cutoffOffer = now - OFFER_INTEL_WINDOW_MS;

  const stateBuckets = new Map();

  function ensureState(st) {
    if (!stateBuckets.has(st)) {
      stateBuckets.set(st, {
        state: st,
        targets: 0,
        commits: 0,
        offers: 0,
        visits: 0,
        ufScores: [],
        positiveIntel: 0,
        negativeIntel: 0,
        playerRecords: [],
        staffMap: new Map(),
      });
    }
    return stateBuckets.get(st);
  }

  for (const player of hubPlayers) {
    const st = resolvePlayerState(player);
    if (!st) continue;

    const bucket = ensureState(st);
    const slug = String(player.slug).toLowerCase();
    const playerIntel = intelRows.filter(
      (r) => String(r.playerSlug || r.player_slug || '').toLowerCase() === slug
    );

    const isCommit = player.isCommittedToUF || player._footprintKind === 'commit';
    const isTarget =
      !isCommit &&
      (player._footprintKind === 'target' ||
        player._footprintKind === 'portal' ||
        player.isTarget);

    if (isCommit) bucket.commits += 1;
    if (isTarget) bucket.targets += 1;

    let offerCount = countFloridaOffers(player);
    let visitCount = countFloridaVisits(player);

    for (const row of playerIntel) {
      const ts = new Date(row.reportedAt || row.timestamp || row.createdAt).getTime();
      if (!Number.isFinite(ts)) continue;
      const et = String(row.eventType || '').toLowerCase();
      if (et === 'offer' && ts >= cutoffOffer) offerCount += 1;
      if (PUBLIC_VISIT.has(et) && isFloridaSchool(row.detail || row.text || 'Florida')) {
        visitCount += 1;
      } else if (PUBLIC_VISIT.has(et)) {
        visitCount += 1;
      }
    }

    bucket.offers += offerCount;
    bucket.visits += visitCount;

    const inputs = deriveUfScoreInputs(player, playerIntel);
    void inputs;
    const ufScore = resolveStrictUfScore(player, playerIntel);
    if (ufScore != null) bucket.ufScores.push(ufScore);

    const competitors = extractRealCompetitors(player, playerIntel);
    const competitorScore = topCompetitorScore(competitors);
    const trend =
      player.movementDirection === 'up'
        ? 'up'
        : player.movementDirection === 'down'
          ? 'down'
          : 'flat';

    bucket.playerRecords.push({
      id: player.slug,
      name: player.name,
      position: playerPos(player),
      class: player.classYear,
      status: isCommit ? 'commit' : 'target',
      ufScore,
      competitorScore,
      trend,
      isPortal: player._footprintKind === 'portal',
      battleDifficulty:
        ufScore != null && competitorScore != null
          ? getBattleDifficulty(ufScore, competitorScore, trend)
          : 'unknown',
      pinLat: player.pinLat ?? player.lat ?? null,
      pinLng: player.pinLng ?? player.lng ?? null,
    });

    const staff = resolveStaffEntry(player);
    if (staff) {
      const staffKey = staff.staffId;
      const entry = bucket.staffMap.get(staffKey) || {
        staffId: staff.staffId,
        name: staff.name,
        role: staff.role,
        assignedPlayers: 0,
        wins: 0,
        losses: 0,
      };
      entry.assignedPlayers += 1;
      if (isCommit) entry.wins += 1;
      else if (player.movementDirection === 'down' || player.committedTo) entry.losses += 1;
      bucket.staffMap.set(staffKey, entry);
    }
  }

  for (const row of intelRows) {
    const slug = String(row.playerSlug || row.player_slug || '').toLowerCase();
    const player = hubPlayers.find((p) => String(p.slug).toLowerCase() === slug);
    if (!player) continue;
    const st = resolvePlayerState(player);
    if (!st) continue;
    const ts = new Date(row.reportedAt || row.timestamp || row.createdAt).getTime();
    if (!Number.isFinite(ts) || ts < cutoffMomentum) continue;
    const sentiment = classifyIntelSentiment(row);
    if (!sentiment) continue;
    const bucket = ensureState(st);
    if (sentiment === 'positive') bucket.positiveIntel += 1;
    else bucket.negativeIntel += 1;
  }

  const pins = [];
  const states = [];

  for (const bucket of stateBuckets.values()) {
    const hasActivity =
      bucket.targets + bucket.commits + bucket.offers + bucket.visits > 0 ||
      bucket.positiveIntel + bucket.negativeIntel > 0;
    if (!hasActivity) continue;

    const ufScore = bucket.ufScores.length
      ? Math.round(bucket.ufScores.reduce((a, b) => a + b, 0) / bucket.ufScores.length)
      : null;

    const rawPipeline =
      bucket.commits * 10 +
      bucket.offers * 3 +
      bucket.visits * 4 +
      bucket.targets * 2 +
      bucket.positiveIntel * 5 -
      bucket.negativeIntel * 5;

    const pipelineScore = normalizePipelineScore(rawPipeline);
    if (pipelineScore <= 0 && !hasActivity) continue;

    let momentum = 'flat';
    if (bucket.positiveIntel > bucket.negativeIntel) momentum = 'up';
    else if (bucket.negativeIntel > bucket.positiveIntel) momentum = 'down';

    const topPlayers = [...bucket.playerRecords]
      .sort((a, b) => (b.ufScore ?? -1) - (a.ufScore ?? -1))
      .slice(0, 5)
      .map(({ trend, isPortal, battleDifficulty, ...rest }) => {
        void trend;
        void isPortal;
        void battleDifficulty;
        const centroid = STATE_CENTROIDS[bucket.state];
        return {
          ...rest,
          pinLat: rest.pinLat ?? centroid?.lat ?? null,
          pinLng: rest.pinLng ?? centroid?.lng ?? null,
        };
      });

    const staffActivity = [...bucket.staffMap.values()].filter((s) => s.assignedPlayers > 0);

    states.push({
      state: bucket.state,
      targets: bucket.targets,
      commits: bucket.commits,
      offers: bucket.offers,
      visits: bucket.visits,
      ufScore,
      pipelineScore,
      momentum,
      topPlayers,
      staffActivity,
    });

    for (const rec of bucket.playerRecords) {
      const centroid = STATE_CENTROIDS[bucket.state];
      const lat = rec.pinLat ?? centroid?.lat ?? null;
      const lng = rec.pinLng ?? centroid?.lng ?? null;
      if (lat == null || lng == null) continue;

      let pinType = 'target';
      if (rec.status === 'commit') pinType = 'commit';
      else if (rec.isPortal) pinType = 'portal';
      else if (rec.battleDifficulty === 'flip' || rec.battleDifficulty === 'hard') pinType = 'battle';

      pins.push({
        id: rec.id,
        name: rec.name,
        state: bucket.state,
        lat,
        lng,
        status: rec.status,
        ufScore: rec.ufScore,
        pinType,
      });
    }
  }

  states.sort((a, b) => b.pipelineScore - a.pipelineScore);

  return {
    states,
    pins,
    meta: {
      playerCount: hubPlayers.length,
      stateCount: states.length,
      pinCount: pins.length,
    },
  };
}

function buildCompetitors(player, intelRows) {
  return extractRealCompetitors(player, intelRows).map((c) => ({
    school: c.school,
    logo: c.logo,
    score: c.score,
    trend: c.trend || 'flat',
  }));
}

async function buildHubBattleBoard() {
  const pool = await loadHubRecruitingPool();
  const rawMap = loadRawPlayerMap();
  const intelRows = intelStore.listIntel({ limit: 600 });
  const rows = [];

  for (const meta of pool.values()) {
    if (meta.isCommit) continue;
    const raw = rawMap.get(String(meta.slug).toLowerCase()) || {};
    const merged = { ...raw, ...meta };
    const slugIntel = intelRows.filter(
      (r) => String(r.playerSlug || r.player_slug || '').toLowerCase() === String(meta.slug).toLowerCase()
    );

    const ufScore = resolveStrictUfScore(merged, slugIntel);
    const competitors = buildCompetitors(merged, slugIntel);
    const topCompetitor = topCompetitorScore(competitors);

    if (ufScore == null && !competitors.length) continue;

    const trend =
      meta.movementDirection === 'up'
        ? 'up'
        : meta.movementDirection === 'down'
          ? 'down'
          : 'flat';

    const intel = shortNote(meta);

    rows.push({
      id: meta.slug,
      name: meta.name,
      position: meta.position,
      class: meta.classYear,
      battleDifficulty:
        ufScore != null && topCompetitor != null
          ? getBattleDifficulty(ufScore, topCompetitor, trend)
          : 'unknown',
      battleColor: ufScore != null ? getBattleColor(ufScore) : null,
      trend,
      competitors,
      ufScore,
      nextVisit: formatNextVisit(meta),
      intel: intel || null,
    });
  }

  rows.sort((a, b) => (b.ufScore ?? -1) - (a.ufScore ?? -1));
  return rows.slice(0, 12);
}

module.exports = {
  loadHubRecruitingPool,
  buildHubMovementFeed,
  buildHubBattleBoard,
  buildHubFootprint,
  STAFF_ALLOWLIST,
};
