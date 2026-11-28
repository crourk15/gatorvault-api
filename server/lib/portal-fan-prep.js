/**
 * Fan-safe winter 2027 portal prep (FutureCast Portal Room).
 * Rooms, thesis, NCAA window — gap-fillers only when they fit a hole.
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
    dek: 'If a 2026 quarterback leaves, Florida is in the market. A portal QB still taxes the tackle budget.',
    hunt: 'Year-1 starter. Pocket plus enough legs for Sumrall. 2+ years left if we can get it.',
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

function portalRoomForPos(raw) {
  const p = String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  if (p === 'OT') return 'OT';
  if (p === 'IOL' || p === 'OG' || p === 'G' || p === 'C' || p === 'OC') return 'IOL';
  if (p === 'S' || p === 'SS' || p === 'FS' || p === 'STAR') return 'S';
  if (p === 'CB') return 'CB';
  if (p === 'DT' || p === 'NT' || p === 'DL' || p === 'IDL') return 'IDL';
  if (p === 'QB') return 'QB';
  if (p === 'LB' || p === 'ILB' || p === 'OLB' || p === 'MIKE' || p === 'WILL') return 'LB';
  if (p === 'EDGE' || p === 'DE' || p === 'JACK') return 'EDGE';
  if (p === 'WR') return 'WR';
  if (p === 'RB' || p === 'HB') return 'RB';
  if (p === 'TE') return 'TE';
  return null;
}

const OTHER_FLORIDA_SCHOOLS =
  /\bflorida\s+(state|atlantic|international|a\s*&\s*m|am|gulf|tech|poly|college)|south\s+florida|central\s+florida|west\s+florida|\bfsu\b|\bfau\b|\bfiu\b|\bfamu\b|\busf\b|\bucf\b/i;

/** University of Florida / Gators — not FAU, FSU, UCF, USF, FIU, FAMU. */
function isFloridaSchoolName(raw) {
  const s = String(raw || '').trim();
  if (!s) return false;
  if (OTHER_FLORIDA_SCHOOLS.test(s)) return false;
  return /^(uf|university of florida|florida(?:\s+gators)?)$/i.test(s) || /\bgators\b/i.test(s);
}

function isUfPortalCommit(player) {
  if (!player) return false;
  if (isFloridaSchoolName(player.committedTo || player.committed_to)) return true;
  const status = String(player.status || '').toLowerCase();
  return status === 'portal_in' && isFloridaSchoolName(player.school);
}

/** Verified college transfer who actually plays the hole — never a random name. */
function portalGapFitsNeed(player, room) {
  if (!player || !room) return false;
  if (String(player.category || '').toLowerCase() !== 'portal') return false;
  if (String(player.status || '').toLowerCase() === 'portal_out') return false;
  if (isUfPortalCommit(player)) return false;
  if (portalRoomForPos(player.position || player.pos) !== room) return false;
  const name = String(player.name || '').trim();
  if (!name) return false;
  const from = String(player.fromSchool || player.previousSchool || player.school || '').trim();
  if (!from || isFloridaSchoolName(from)) return false;
  return true;
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

function calendarYmdInEt(at = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(at);
}

function daysUntilYmd(ymd, at = new Date()) {
  const target = Date.parse(`${ymd}T00:00:00Z`);
  const now = Date.parse(`${calendarYmdInEt(at)}T00:00:00Z`);
  if (!Number.isFinite(target) || !Number.isFinite(now)) return null;
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
        gapFillers: [],
        scanTargets: [],
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
    gapFillers: [],
    scanTargets: [],
  });
  return rooms.sort((a, b) => a.rank - b.rank);
}

async function overlayLiveHsClass(prep, opts = {}) {
  const elite = require('./recruiting-hub-elite');
  const store = require('./recruiting-store');
  const { scanTargetsForRoom, readLastReport } = require('./portal-target-sweep');
  const report = opts.report || readLastReport();
  const { commits } = await elite.loadHubHsClassCommits(2027);

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

  let incoming = [];
  try {
    const board = await store.getPortalBoard();
    incoming = Array.isArray(board && board.incoming) ? board.incoming : [];
  } catch (err) {
    console.warn('[portal-fan-prep] portal board read failed', err && err.message);
  }

  const rooms = (prep.rooms || []).map((row) => {
    const fillers = incoming
      .filter((player) => portalGapFitsNeed(player, row.room))
      .map((player) =>
        toChip(
          {
            name: player.name,
            slug: player.slug || player.id,
            position: player.position || player.pos,
            stars: player.stars,
            natlRank: player.natlRank,
            committedTo: player.fromSchool || player.previousSchool || player.school || null,
          },
          'gap'
        )
      )
      .filter(Boolean);
    const scans = (scanTargetsForRoom(row.room, report) || []).filter((chip) => {
      const name = String(chip.name || '').trim().toLowerCase();
      const slug = String(chip.slug || '').trim().toLowerCase();
      return !fillers.some(
        (f) =>
          (slug && String(f.slug || '').toLowerCase() === slug) ||
          String(f.name || '').trim().toLowerCase() === name
      );
    });
    return {
      ...row,
      alreadySigned: sortChips(signedByRoom.get(row.room) || []),
      stillRecruiting: [],
      gapFillers: sortChips(fillers),
      scanTargets: scans,
    };
  });
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
    namesLandWhen:
      'Call sheets on every room. PFF scan until they enter. Stamp when On3 or the beat verifies.',
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
  portalGapFitsNeed,
  isFloridaSchoolName,
  isUfPortalCommit,
  chipName,
  daysUntilYmd,
};
