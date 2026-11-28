/**
 * GatorVault portal targets from our systems — PFF scan board, On3 watch,
 * beat portal intel, recruiting-store portal rows — then hole-fit + Buy score.
 * Never invent PFF. Never mark them Florida commits.
 */
const fs = require('fs');
const path = require('path');
const { slugify } = require('./slug');
const { computePortalBuyScore } = require('./portal-buy-score');
const { portalRoomForPos, isUfPortalCommit, isFloridaSchoolName } = require('./portal-fan-prep');

const ROOM_CAP = {
  'must-add': 5,
  high: 5,
  conditional: 5,
  watch: 5,
  stable: 5,
  hold: 5,
};

const SCAN_BOARD = path.join(__dirname, '..', 'data', 'portal', 'winter-2027-scan.json');

function isFloridaSchoolNameSafe(raw) {
  return isFloridaSchoolName(raw);
}

function cleanName(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikePersonName(name) {
  if (!name || name.length < 4 || name.length > 40) return false;
  if (!/^[A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*)+$/.test(name)) return false;
  if (/\b(coach|staff|gators|florida|portal|transfer|verified|target|room)\b/i.test(name)) {
    return false;
  }
  const parts = name.split(/\s+/);
  if (parts.length < 2) return false;
  if (parts.some((part) => part.replace(/[.'-]/g, '').length < 2)) return false;
  return true;
}

function fromSchoolOf(row) {
  return String(row.fromSchool || row.previousSchool || row.school || row.college || '').trim();
}

function isVerifiedPortalSource(row) {
  const source = String(row.source || '').toLowerCase();
  if (source === 'on3' || source === 'beat' || source === 'store') return true;
  if (source === 'pff' || source === 'gv-scan' || source === 'scan') return true;
  if (String(row.category || '').toLowerCase() === 'portal') return true;
  const status = String(row.status || row.eventType || row.triggerType || '').toLowerCase();
  return status.includes('portal');
}

/** Day 1–2 2027 NFL projections are not GatorVault portal buys. */
function isNflBound(row) {
  if (!row) return false;
  if (row.nflBound === true) return true;
  const round = Number(row.nflDraftRound ?? row.draftRound);
  if (Number.isFinite(round) && round >= 1 && round <= 3) return true;
  const band = String(row.nflProjection || row.draftProjection || '').toLowerCase();
  return /\b(r1|r2|r3|1st round|2nd round|3rd round|first round|second round|third round)\b/.test(band);
}

/** Hard gate: verified college transfer who fills a live hole. */
function isPortalTargetCandidate(row, room) {
  if (!row || !room) return false;
  const name = cleanName(row.name || row.full_name || row.playerName);
  if (!looksLikePersonName(name)) return false;
  if (!isVerifiedPortalSource(row)) return false;
  if (String(row.category || '').toLowerCase() === 'recruit') return false;
  if (String(row.status || '').toLowerCase() === 'portal_out') return false;
  if (isNflBound(row)) return false;
  if (isUfPortalCommit(row)) return false;
  const from = fromSchoolOf(row);
  if (!from || isFloridaSchoolNameSafe(from)) return false;
  if (portalRoomForPos(row.position || row.pos) !== room) return false;
  return true;
}

function scanish(source) {
  const s = String(source || '').toLowerCase();
  return s === 'pff' || s === 'gv-scan' || s === 'scan';
}

function toCandidate(row, source) {
  const name = cleanName(row.name || row.full_name || row.playerName);
  const slug = String(row.slug || row.playerSlug || slugify(name)).toLowerCase();
  const fromSchool = fromSchoolOf(row);
  const scan = scanish(source) || scanish(row.source);
  return {
    name,
    slug,
    position: String(row.position || row.pos || '').toUpperCase(),
    fromSchool,
    school: fromSchool,
    conference: row.conference || row.conf || '',
    conferenceTier: row.conferenceTier || row.level || '',
    starts: row.starts ?? row.gamesStarted ?? null,
    snapPct: row.snapPct ?? row.snap_pct ?? null,
    snaps: row.snaps ?? row.offenseSnaps ?? row.defenseSnaps ?? null,
    pffGrade: row.pffGrade ?? row.pff_grade ?? row.pff ?? null,
    yearsLeft: row.yearsLeft ?? row.years_left ?? row.elig ?? null,
    ht: row.ht || row.height || null,
    wt: row.wt ?? row.weight ?? null,
    jersey: row.jersey ?? row.number ?? null,
    note: row.note || null,
    announcedPortal: !!row.announcedPortal,
    nflBound: isNflBound(row),
    nflDraftRound: row.nflDraftRound ?? row.draftRound ?? null,
    production: row.production || null,
    stars: row.stars ?? null,
    natlRank: row.natlRank ?? row.natl ?? null,
    schemeFit: row.schemeFit ?? row.scheme_score ?? null,
    floridaOffer: row.floridaOffer || row.flOffer || false,
    floridaVisit: row.floridaVisit || row.ufVisit || false,
    staffFlag: row.staffFlag || false,
    beatLink: source === 'beat' || row.beatLink || false,
    category: scan ? 'scan' : 'portal',
    status: row.status || (scan ? 'scan' : 'portal_in'),
    source,
    sourceUrl: row.sourceUrl || row.url || null,
  };
}

function fromIntelItem(item) {
  const blob = [
    item.eventType,
    item.triggerType,
    item.portalEventType,
    item.status,
    item.summary,
    item.text,
    item.detail,
  ]
    .map((v) => String(v || ''))
    .join(' ');
  if (!/portal/i.test(blob) && item.triggerType !== 'portal_elite') return null;
  if (!item.playerName && !item.name) return null;
  return toCandidate(
    {
      ...item,
      name: item.playerName || item.name,
      slug: item.playerSlug || item.slug,
      position: item.pos || item.position,
      fromSchool: item.fromSchool || item.previousSchool || item.school,
    },
    'beat'
  );
}

function loadPffScanBoard() {
  try {
    const buf = fs.readFileSync(SCAN_BOARD);
    const text = buf[1] === 0 ? buf.toString('utf16le') : buf.toString('utf8');
    const data = JSON.parse(text.replace(/^\uFEFF/, ''));
    const players = Array.isArray(data && data.players) ? data.players : [];
    const blocked = new Set(
      (Array.isArray(data && data.blockedNfl) ? data.blockedNfl : []).map((row) =>
        String(row && row.name ? row.name : '')
          .trim()
          .toLowerCase()
      )
    );
    return players.filter((row) => {
      const name = String(row && row.name ? row.name : '')
        .trim()
        .toLowerCase();
      if (name && blocked.has(name)) return false;
      return !isNflBound(row);
    });
  } catch {
    return [];
  }
}

function collectPortalTargetCandidates({ incoming = [], intel = [], on3 = [], scan = [] } = {}) {
  const out = [];
  const seen = new Set();
  function push(row, source) {
    const cand = source === 'beat' && row.source === 'beat' ? row : toCandidate(row, source);
    if (!cand || !cand.name) return;
    const key = cand.slug || cand.name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(cand);
  }
  for (const row of on3) push(row, 'on3');
  for (const row of incoming) push(row, 'store');
  for (const item of intel) {
    const cand = fromIntelItem(item);
    if (cand) {
      const key = cand.slug || cand.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(cand);
    }
  }
  for (const row of scan) push(row, row.source || 'pff');
  return out;
}

function roomCap(tier) {
  return ROOM_CAP[String(tier || '').toLowerCase()] ?? 2;
}

const HUNT_P4_FLOOR = 2;
const HUNT_NON_POWER_CAP = 3;

function passesHoldGate(score, tier) {
  const t = String(tier || '').toLowerCase();
  if (t !== 'stable' && t !== 'hold' && t !== 'watch') return true;
  const production = Math.max(score.pts.year1Starter || 0, score.pts.nonPowerProduction || 0);
  if (t === 'watch') return production >= 12 || score.buyScore >= 28;
  return production >= 20 || score.buyScore >= 40;
}

function candKey(row) {
  return String((row && (row.slug || row.name)) || '')
    .trim()
    .toLowerCase();
}

function isP4Row(row) {
  return String(row && row.conferenceTier ? row.conferenceTier : '').toLowerCase() === 'p4';
}

/** Best score, but G5 grades cannot bury two buyable P4 names when they exist. */
function pickHuntBoard(fits, cap) {
  const ranked = [...fits].sort(
    (a, b) => b.buyScore - a.buyScore || String(a.name).localeCompare(String(b.name))
  );
  const out = [];
  const taken = new Set();
  function add(row) {
    if (!row) return false;
    const key = candKey(row);
    if (!key || taken.has(key) || out.length >= cap) return false;
    taken.add(key);
    out.push(row);
    return true;
  }
  for (const row of ranked) {
    if (out.length >= cap) break;
    if (!isP4Row(row) && out.filter((r) => !isP4Row(r)).length >= HUNT_NON_POWER_CAP) continue;
    add(row);
  }
  const extras = ranked.filter((row) => isP4Row(row) && !taken.has(candKey(row)));
  for (const extra of extras) {
    if (out.filter(isP4Row).length >= HUNT_P4_FLOOR) break;
    let replaceAt = -1;
    for (let i = out.length - 1; i >= 0; i -= 1) {
      if (!isP4Row(out[i])) {
        replaceAt = i;
        break;
      }
    }
    if (replaceAt < 0) {
      add(extra);
      continue;
    }
    taken.delete(candKey(out[replaceAt]));
    out[replaceAt] = extra;
    taken.add(candKey(extra));
  }
  for (const row of ranked) {
    if (out.length >= cap) break;
    add(row);
  }
  out.sort((a, b) => b.buyScore - a.buyScore || String(a.name).localeCompare(String(b.name)));
  return out.slice(0, cap);
}

function rankPortalTargets(candidates, rooms) {
  const byRoom = new Map();
  for (const room of rooms || []) {
    const fits = [];
    for (const cand of candidates || []) {
      if (!isPortalTargetCandidate(cand, room.room)) continue;
      const scored = computePortalBuyScore(cand, { roomTier: room.tier, room: room.room });
      if (!passesHoldGate(scored, room.tier)) continue;
      fits.push({
        ...cand,
        room: room.room,
        roomTier: room.tier,
        buyScore: scored.buyScore,
        productionPath: scored.productionPath,
        conferenceTier: scored.conferenceTier,
        pts: scored.pts,
      });
    }
    fits.sort((a, b) => b.buyScore - a.buyScore || String(a.name).localeCompare(String(b.name)));
    byRoom.set(room.room, pickHuntBoard(fits, roomCap(room.tier)));
  }
  return byRoom;
}

function toScanChip(row) {
  if (!row || !row.name) return null;
  const school = row.fromSchool || row.school || null;
  return {
    name: row.name,
    slug: row.slug || '',
    position: row.position || row.room || '',
    stars: Number(row.stars) > 0 ? Number(row.stars) : null,
    natlRank: Number(row.natlRank) > 0 ? Number(row.natlRank) : null,
    status: 'scan',
    committedTo: school,
    school,
    conference: row.conference || null,
    pffGrade: row.pffGrade ?? null,
    snaps: row.snaps ?? null,
    ht: row.ht || null,
    wt: row.wt ?? null,
    jersey: row.jersey || null,
    yearsLeft: row.yearsLeft ?? null,
    note: row.note || null,
    announcedPortal: !!row.announcedPortal,
    buyScore: row.buyScore,
    productionPath: row.productionPath || null,
    source: row.source,
    sourceUrl: row.sourceUrl || null,
  };
}

module.exports = {
  ROOM_CAP,
  SCAN_BOARD,
  isPortalTargetCandidate,
  collectPortalTargetCandidates,
  rankPortalTargets,
  toScanChip,
  looksLikePersonName,
  loadPffScanBoard,
  isNflBound,
  pickHuntBoard,
  HUNT_P4_FLOOR,
  HUNT_NON_POWER_CAP,
};
