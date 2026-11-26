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
  RB: {
    dek: 'Do not spend a portal slot here unless the backfield situation changes.',
    hunt: 'Hold the room.',
  },
  TE: {
    dek: 'Not a 10–12 slot unless a difference-maker falls.',
    hunt: 'Hold the room.',
  },
};

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
        alreadySigned: (need.hsIncoming || []).map(stripParen).filter(Boolean),
      };
    })
    .filter((row) => row.room)
    .sort((a, b) => a.rank - b.rank);
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
  daysUntilYmd,
};
