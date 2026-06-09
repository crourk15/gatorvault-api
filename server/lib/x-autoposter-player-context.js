/**
 * Verified player context for autoposter — On3/Rivals/GatorVault records only. No inference.
 */
const INVALID_NAME_PARTS = new Set([
  'her', 'his', 'the', 'new', 'four', 'five', 'star', 'class', 'florida', 'gators', 'gator',
  'other', 'top', 'per', 'via', 'our', 'own', 'breaking', 'official', 'unofficial', 'south',
  'north', 'ole', 'miss', 'state', 'carolina', 'georgia', 'alabama', 'tennessee', 'recruit',
  'recruits', 'target', 'targets', 'nation', 'machine', 'prediction', 'rivals', 'online',
  'gators', 'weekend', 'this', 'that', 'with', 'from', 'they', 'will', 'now', 'has', 'have',
  'had', 'for', 'and', 'to', 'on', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
  'saturday', 'sunday', 'today', 'tomorrow', 'analyst', 'analysts', 'logged', 'logs'
]);

function isValidPlayerName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 4 || trimmed.length > 48) return false;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  if (parts.some((p) => INVALID_NAME_PARTS.has(p.toLowerCase()))) return false;
  if (!parts.every((p) => /^[A-Za-z][A-Za-z'-]{1,}$/.test(p))) return false;
  return true;
}

const VERIFIED_PATCH_KEYS = new Set([
  'name',
  'pos',
  'classYear',
  'school',
  'stars',
  'rating',
  'natlRank',
  'htWt',
  'headliner',
  'category',
  'inState',
  'committedTo',
  'status'
]);

function parseCityState(school) {
  const s = String(school || '').trim();
  const m = s.match(/^(.+?),\s*([A-Z]{2})$/);
  if (!m) return null;
  const city = m[1].trim();
  const state = m[2].trim();
  if (!city || city.length < 2) return null;
  return `${city}, ${state}`;
}

function formatStarsLabel(stars) {
  const n = parseInt(stars, 10);
  if (!n || n < 1 || n > 5) return null;
  return `${n}★`;
}

function deriveUfTargetStatus(player) {
  if (!player) return null;
  const category = String(player.category || '').toLowerCase();
  if (player.headliner) {
    return category === 'portal' ? 'top UF portal target' : 'top UF priority target';
  }
  if (category === 'portal') return 'UF portal target';
  const natl = player.natlRank != null ? Number(player.natlRank) : null;
  if (natl && natl > 0 && natl <= 100) return 'UF priority target';
  if (category === 'target') return 'UF target';
  return null;
}

function mergeVerifiedFields(player, patch) {
  const out = { ...(player || {}) };
  if (!patch || typeof patch !== 'object') return out;
  for (const [key, val] of Object.entries(patch)) {
    if (!VERIFIED_PATCH_KEYS.has(key)) continue;
    if (val == null || val === '') continue;
    if (out[key] == null || out[key] === '' || out[key] === 0) {
      out[key] = val;
    }
  }
  return out;
}

function formatPlayerContext(player) {
  const name = String(player?.name || '').trim();
  const pos = String(player?.pos || '').trim() || null;
  const classYear = player?.classYear != null ? Number(player.classYear) : null;
  const starsLabel = formatStarsLabel(player?.stars);
  const location = parseCityState(player?.school);
  const ufStatus = deriveUfTargetStatus(player);
  const htWt = String(player?.htWt || '').trim() || null;

  const hasMinimumContext =
    isValidPlayerName(name) && !!(pos || (classYear && !Number.isNaN(classYear)) || starsLabel);

  return {
    name,
    pos,
    classYear: classYear && !Number.isNaN(classYear) ? classYear : null,
    starsLabel,
    location,
    ufStatus,
    htWt,
    natlRank: player?.natlRank != null ? Number(player.natlRank) : null,
    hasMinimumContext
  };
}

async function resolvePlayerContext({ playerSlug, playerName, patch = null } = {}) {
  const store = require('./recruiting-store');
  let player = null;
  if (playerSlug) {
    player = await store.getPlayerBySlug(playerSlug);
  }
  if (!player && playerName) {
    const all = await store.getAllPlayers();
    const key = String(playerName).toLowerCase();
    player = all.find((p) => String(p.name || '').toLowerCase() === key) || null;
  }
  const merged = mergeVerifiedFields(player, patch);
  if (!merged.name && playerName) merged.name = playerName;
  return formatPlayerContext(merged);
}

function buildPlayerDescriptor(ctx) {
  const lead = [];
  if (ctx.starsLabel) lead.push(ctx.starsLabel);
  if (ctx.pos) lead.push(ctx.pos);
  lead.push(ctx.name);
  let line = lead.join(' ');
  if (ctx.location) line += ` (${ctx.location})`;

  if (ctx.ufStatus && ctx.classYear) {
    line += ` — a ${ctx.ufStatus} in the ${ctx.classYear} class`;
  } else if (ctx.classYear) {
    line += ` — ${ctx.classYear} class`;
  } else if (ctx.ufStatus) {
    line += ` — a ${ctx.ufStatus}`;
  }
  return line;
}

function formatUniversalPlayerNews({ source, ctx, newsEvent }) {
  const src = String(source || 'GatorVault').trim();
  const event = String(newsEvent || '').trim().replace(/\.$/, '');
  if (!src || !ctx?.name || !event) return null;
  const descriptor = buildPlayerDescriptor(ctx);
  return `${src} reports that ${descriptor} has ${event}. 🐊`;
}

async function buildPlayerNewsPost({ source, newsEvent, playerSlug, playerName, patch = null }) {
  const ctx = await resolvePlayerContext({ playerSlug, playerName, patch });
  if (!ctx.hasMinimumContext) return null;
  const line = formatUniversalPlayerNews({ source, ctx, newsEvent });
  if (!line) return null;
  return {
    text: line,
    playerName: ctx.name,
    context: ctx
  };
}

function newsEventForIntel(intel) {
  const visitRange =
    intel.visitStart && intel.visitEnd ? ` (${intel.visitStart}–${intel.visitEnd})` : intel.visitStart ? ` (${intel.visitStart})` : '';

  switch (intel.eventType) {
    case 'official_visit':
      return `scheduled an OV to Florida${visitRange}`;
    case 'unofficial_visit':
      return `scheduled a visit to Gainesville${visitRange}`;
    case 'visit_cancelled':
    case 'ov_change': {
      const next = intel.nextVisitSchool ? ` and will visit ${intel.nextVisitSchool} this weekend` : '';
      return `cancelled his OV to Florida${next}`;
    }
    case 'prediction': {
      const conf = intel.confidencePct != null ? ` (${intel.confidencePct}% confidence)` : '';
      if (/rivals|futurecast|prediction machine/i.test(String(intel.source || intel.status || ''))) {
        return `picked up a Florida FutureCast prediction${conf}`;
      }
      if (/rpm|on3/i.test(String(intel.source || intel.detail || ''))) {
        return `logged an On3 RPM pick for Florida${conf}`;
      }
      return `picked up a UF prediction${conf}`;
    }
    case 'trending':
    case 'recruiting_momentum':
      return 'moved up on Florida\'s recruiting board';
    case 'offer':
    case 'target_update':
    case 'offers':
      return 'received an offer from UF';
    case 'commit':
    case 'commitment':
      return 'committed to Florida';
    case 'decommit': {
      const school =
        intel.cancelledSchool ||
        intel.detail?.match(/decommitted from ([^.,]+)/i)?.[1]?.trim() ||
        null;
      return school ? `decommitted from ${school}` : 'decommitted';
    }
    case 'portal_in':
      return 'entered the transfer portal (UF target)';
    case 'portal_out':
    case 'portal':
      return 'entered the transfer portal';
    default:
      if (intel.detail) return String(intel.detail).replace(/\.$/, '').slice(0, 120);
      if (intel.status) return String(intel.status).replace(/\.$/, '').slice(0, 120);
      return null;
  }
}

function newsEventForRecruitingEvent(ev) {
  const et = String(ev.eventType || '').toLowerCase();
  const player = ev.payload?.player || {};
  const school = player.committedTo || player.committed_to || null;
  switch (et) {
    case 'commit':
      return 'committed to Florida';
    case 'flip':
      return 'flipped to Florida';
    case 'decommit':
      return school ? `decommitted from ${school}` : 'decommitted';
    case 'portal_in':
      return 'entered the transfer portal (UF target)';
    case 'portal_out':
      return 'entered the transfer portal';
    case 'prediction':
      return 'picked up a UF prediction';
    case 'visit_cancelled':
      return 'cancelled his OV to Florida';
    case 'offer':
    case 'target_update':
      return 'received an offer from UF';
    case 'official_visit':
      return 'scheduled an OV to Florida';
    case 'unofficial_visit':
      return 'scheduled a visit to Gainesville';
    default:
      if (ev.detail) return String(ev.detail).replace(/\.$/, '').slice(0, 120);
      if (ev.title) return String(ev.title).replace(/^[^:]+:\s*/, '').replace(/\.$/, '').slice(0, 120);
      return null;
  }
}

function sourceLabelForIntel(intel) {
  if (intel.analystName) {
    if (/rivals|futurecast/i.test(String(intel.source || ''))) return `Rivals analyst ${intel.analystName}`;
    return intel.analystName;
  }
  return intel.source || 'GatorVault Recruiting';
}

function verifiedPatchFromIntel(intel) {
  return {
    name: intel.playerName,
    pos: intel.pos,
    classYear: intel.classYear,
    school: intel.school,
    stars: intel.stars,
    natlRank: intel.natlRank
  };
}

function verifiedPatchFromRow(row) {
  return {
    name: row.playerName,
    pos: row.pos,
    classYear: row.classYear,
    school: row.school,
    stars: row.stars,
    natlRank: row.natlRank
  };
}

function verifiedPatchFromPlayer(player) {
  if (!player) return null;
  return {
    name: player.name,
    pos: player.pos,
    classYear: player.classYear,
    school: player.school,
    stars: player.stars,
    natlRank: player.natlRank,
    htWt: player.htWt,
    headliner: player.headliner,
    category: player.category,
    inState: player.inState,
    committedTo: player.committedTo,
    status: player.status
  };
}

module.exports = {
  isValidPlayerName,
  parseCityState,
  formatStarsLabel,
  deriveUfTargetStatus,
  resolvePlayerContext,
  buildPlayerDescriptor,
  formatUniversalPlayerNews,
  buildPlayerNewsPost,
  newsEventForIntel,
  newsEventForRecruitingEvent,
  sourceLabelForIntel,
  verifiedPatchFromIntel,
  verifiedPatchFromRow,
  verifiedPatchFromPlayer
};
