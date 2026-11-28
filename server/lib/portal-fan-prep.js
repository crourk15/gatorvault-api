/**
 * Fan-safe winter 2027 portal prep.
 * Rooms, thesis, NCAA window — never named portal candidates.
 * fanShip stays false. getPortalBoard() stays empty until Charles ships names.
 */
const { loadWinter2027PortalResearch } = require('./portal-winter-research');
const { getPortalSeasonState } = require('./recruiting-cycle.ts');

const WINDOW_LABEL = 'January 4–13, 2027';

const TIER_LABEL = {
  'must-add': 'Must add',
  high: 'High',
  conditional: 'Only if',
  watch: 'Watch',
  stable: 'Hold',
};

/** Public room copy — no outgoing-portal predictions, no invented targets. */
const FAN_COPY = {
  OT: {
    dek: 'Both tackle spots. Most expensive portal buy. 2027 true freshmen are not Year-1 SEC starters.',
    hunt: 'Power-conference tackle who can start in 2027. Length, 2+ years left. Two if the budget holds.',
  },
  S: {
    dek: 'One-year safeties leave a hole. One 2027 commit is not enough.',
    hunt: 'Range-and-tackle safety who can play SS or STAR in Year 1. 2+ years left.',
  },
  CB: {
    dek: 'Secondary is a portal shop. Quality starter snaps still look thin.',
    hunt: 'Press-man corner with starter snaps. Not a depth body.',
  },
  IDL: {
    dek: 'Interior only if the staff needs a Year-1 two-gap piece.',
    hunt: 'Year-1 interior who can two-gap. Not a roster filler.',
  },
  QB: {
    dek: 'Only if the 2027 starter is not already on the roster. A portal QB taxes the tackle budget.',
    hunt: 'Do not shop a quarterback until that call is made.',
  },
  LB: {
    dek: 'Only a difference-maker. Not a depth body.',
    hunt: 'A Year-1 MIKE/WILL who changes the front. Pass if he is just a count.',
  },
  EDGE: {
    dek: 'Pass-rush JACK piece. Not a 30-man roster filler.',
    hunt: 'A rush piece who can play JACK in Year 1.',
  },
  WR: {
    dek: 'Headcount is fine. A true WR1 only if the staff wants a Year-1 dude.',
    hunt: 'Do not spend a 10–12 slot on a body. Royal is a freshman.',
  },
  IOL: {
    dek: 'Interior is signed. Not a 10–12 portal slot unless a Year-1 starter falls.',
    hunt: 'Hold the room.',
  },
  RB: {
    dek: 'Do not spend a portal slot here unless the backfield situation changes.',
    hunt: 'Hold the room.',
  },
  TE: {
    dek: 'Not a 10–12 slot unless a difference-maker falls.',
    hunt: 'Hold the room.',
  },
};

const FLIP_WATCH_POS = {
  'jalen-brewster': 'IDL',
  'keldrid-ben': 'RB',
  'andre-hyppolite': 'S',
  'ace-alston': 'CB',
};

function portalRoomForPos(raw) {
  const p = String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  if (p === 'OT') return 'OT';
  if (p === 'IOL' || p === 'OG' || p === 'C' || p === 'OC') return 'IOL';
  if (p === 'S' || p === 'SS' || p === 'FS' || p === 'STAR') return 'S';
  if (p === 'CB') return 'CB';
  if (p === 'DT' || p === 'NT' || p === 'DL' || p === 'IDL') return 'IDL';
  if (p === 'QB') return 'QB';
  if (p === 'LB' || p === 'ILB' || p === 'OLB' || p === 'MIKE' || p === 'WILL') return 'LB';
  if (p === 'EDGE' || p === 'DE' || p === 'JACK') return 'EDGE';
  if (p === 'WR') return 'WR';
  if (p === 'RB') return 'RB';
  if (p === 'TE') return 'TE';
  return null;
}

function toChip(row, status) {
  const name = String(row.name || '').trim();
  const slug = String(row.slug || row.id || '')
    .trim()
    .toLowerCase();
  if (!name) return null;
  const natl = Number.parseInt(String(row.natlRank ?? row.natl ?? ''), 10);
  const stars = Number.parseInt(String(row.stars ?? ''), 10);
  return {
    name,
    slug,
    position: String(row.position || row.pos || '').trim(),
    stars: Number.isFinite(stars) && stars > 0 ? stars : null,
    natlRank: Number.isFinite(natl) && natl > 0 ? natl : null,
    status,
    committedTo: row.committedTo ? String(row.committedTo).trim() : null,
  };
}

function chipName(row) {
  if (!row) return '';
  if (typeof row === 'string') return stripParen(row);
  return String(row.name || '').trim();
}

const BLOCKED_FAN_KEYS = [
  'namedCandidates',
  'outgoingLikely',
  'departingLikely',
  'staffThesis',
  'fanSurfacesBlocked',
  'why',
];

function stripParen(raw) {
  return String(raw || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function daysUntilYmd(ymd, at = new Date()) {
  const target = Date.parse(`${ymd}T00:00:00Z`);
  if (!Number.isFinite(target)) return null;
  const now = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  return Math.max(0, Math.round((target - now) / 86400000));
}

function fanRooms(needs) {
  return (Array.isArray(needs) ? needs : [])
    .map((need) => {
      const room = String(need.room || '').trim();
      const copy = FAN_COPY[room] || {};
      const hunt = copy.hunt || (need.hunt ? String(need.hunt) : 'Hold the room.');
      return {
        rank: Number(need.rank) || 99,
        room,
        tier: String(need.tier || 'watch'),
        tierLabel: TIER_LABEL[need.tier] || 'Watch',
        dek: copy.dek || hunt,
        hunt,
        alreadySigned: (need.hsIncoming || []).map((raw) => {
          const name = stripParen(raw);
          return name ? { name, slug: '', position: room, stars: null, natlRank: null, status: 'commit', committedTo: null } : null;
        }).filter(Boolean),
        stillRecruiting: [],
      };
    })
    .filter((row) => row.room)
    .sort((a, b) => a.rank - b.rank);
}

function sortChips(rows) {
  return [...rows].sort((a, b) => {
    const ar = Number(a.natlRank) > 0 ? Number(a.natlRank) : 9999;
    const br = Number(b.natlRank) > 0 ? Number(b.natlRank) : 9999;
    if (ar !== br) return ar - br;
    return String(a.name).localeCompare(String(b.name));
  });
}

function ensureIolRoom(rooms, iolChips) {
  if (!iolChips.length) return rooms;
  if (rooms.some((row) => row.room === 'IOL')) {
    return rooms.map((row) =>
      row.room === 'IOL' ? { ...row, alreadySigned: iolChips } : row
    );
  }
  const copy = FAN_COPY.IOL;
  rooms.push({
    rank: 11,
    room: 'IOL',
    tier: 'stable',
    tierLabel: 'Hold',
    dek: copy.dek,
    hunt: copy.hunt,
    alreadySigned: iolChips,
    stillRecruiting: [],
  });
  return rooms.sort((a, b) => a.rank - b.rank);
}

async function overlayLiveHsClass(prep) {
  const elite = require('./recruiting-hub-elite');
  const {
    ALLOWLIST_2027,
    FLIP_WATCH_2027,
    FLIP_WATCH_COMMITS_2027,
    CANONICAL_TARGET_NAMES,
  } = require('./recruiting-target-allowlist');
  const { commits } = await elite.loadHubHsClassCommits(2027);
  const heat = await elite.buildHubHeatIndex(2027);

  const signedByRoom = new Map();
  for (const player of commits || []) {
    const room = portalRoomForPos(player.position || player.pos);
    if (!room) continue;
    const chip = toChip(player, 'commit');
    if (!chip) continue;
    const list = signedByRoom.get(room) || [];
    list.push(chip);
    signedByRoom.set(room, list);
  }

  const recruitingByRoom = new Map();
  const seen = new Set();
  for (const row of heat || []) {
    const slug = String(row.id || row.slug || '')
      .trim()
      .toLowerCase();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const room = portalRoomForPos(row.position) || FLIP_WATCH_POS[slug] || null;
    if (!room) continue;
    const flip = FLIP_WATCH_2027.includes(slug) || Boolean(row.flipWatch);
    const chip = toChip(
      {
        ...row,
        slug,
        committedTo: row.committedTo || FLIP_WATCH_COMMITS_2027[slug] || null,
      },
      flip ? 'flip' : 'target'
    );
    if (!chip) continue;
    const list = recruitingByRoom.get(room) || [];
    list.push(chip);
    recruitingByRoom.set(room, list);
  }

  for (const slug of ALLOWLIST_2027) {
    if (seen.has(slug)) continue;
    const room = FLIP_WATCH_POS[slug] || null;
    if (!room) {
      // Open hunt with no heat row still belongs on RB if it is Tranard.
      if (slug === 'tranard-roberts') {
        const chip = toChip(
          { name: CANONICAL_TARGET_NAMES[slug] || slug, slug, position: 'RB' },
          'target'
        );
        if (chip) {
          const list = recruitingByRoom.get('RB') || [];
          list.push(chip);
          recruitingByRoom.set('RB', list);
        }
      }
      continue;
    }
    const chip = toChip(
      {
        name: CANONICAL_TARGET_NAMES[slug] || slug,
        slug,
        position: room,
        committedTo: FLIP_WATCH_COMMITS_2027[slug] || null,
      },
      FLIP_WATCH_2027.includes(slug) ? 'flip' : 'target'
    );
    if (!chip) continue;
    const list = recruitingByRoom.get(room) || [];
    list.push(chip);
    recruitingByRoom.set(room, list);
  }

  const rooms = (prep.rooms || []).map((row) => ({
    ...row,
    alreadySigned: sortChips(signedByRoom.get(row.room) || []),
    stillRecruiting: sortChips(recruitingByRoom.get(row.room) || []),
  }));
  ensureIolRoom(rooms, sortChips(signedByRoom.get('IOL') || []));
  return { ...prep, rooms, classYear: 2027 };
}

async function getFanPortalPrepLive(at = new Date()) {
  const prep = getFanPortalPrep(at);
  try {
    return await overlayLiveHsClass(prep);
  } catch (err) {
    console.warn('[portal-fan-prep] live HS overlay failed', err && err.message);
    return prep;
  }
}

function getFanPortalPrep(at = new Date()) {
  const research = loadWinter2027PortalResearch();
  if (research.fanShip === true) {
    throw new Error('winter 2027 portal research is desk-only — fanShip must stay false');
  }
  const season = getPortalSeasonState(at);
  const rooms = fanRooms(research.needs);
  const mustAdd = rooms.filter((row) => row.tier === 'must-add').map((row) => row.room);
  const prep = {
    ok: true,
    fanShip: false,
    status: 'prep',
    namesLandWhen: 'Names land when they are verified.',
    season,
    window: {
      opens: research.window.opens,
      closes: research.window.closes,
      days: research.window.days,
      label: WINDOW_LABEL,
      daysUntilOpen: daysUntilYmd(research.window.opens, at),
    },
    thesis: {
      addCount: '10–12 difference makers',
      not: 'Not 30 practice bodies.',
      line: 'NIL decides how many of those 10–12 Florida can actually buy.',
    },
    rooms,
    mustAdd,
    incomingCount: 0,
  };
  for (const key of BLOCKED_FAN_KEYS) {
    if (key in prep) delete prep[key];
  }
  return prep;
}

module.exports = {
  WINDOW_LABEL,
  FAN_COPY,
  getFanPortalPrep,
  getFanPortalPrepLive,
  overlayLiveHsClass,
  portalRoomForPos,
  chipName,
  daysUntilYmd,
};
