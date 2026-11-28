/**
 * GatorVault portal targets from our systems — On3 watch, beat portal intel,
 * recruiting-store portal rows — then hole-fit + Buy score.
 * Never invent names. Never mark them Florida commits.
 */
const { slugify } = require('./slug');
const { computePortalBuyScore } = require('./portal-buy-score');
const { portalRoomForPos, isUfPortalCommit } = require('./portal-fan-prep');

const ROOM_CAP = {
  'must-add': 5,
  high: 4,
  conditional: 2,
  watch: 2,
  stable: 1,
  hold: 1,
};

function isFloridaSchoolNameSafe(raw) {
  return /\bflorida\b|\bgators\b/i.test(String(raw || ''));
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
  if (String(row.category || '').toLowerCase() === 'portal') return true;
  const status = String(row.status || row.eventType || row.triggerType || '').toLowerCase();
  return status.includes('portal');
}

/** Hard gate: verified college transfer who fills a live hole. */
function isPortalTargetCandidate(row, room) {
  if (!row || !room) return false;
  const name = cleanName(row.name || row.full_name || row.playerName);
  if (!looksLikePersonName(name)) return false;
  if (!isVerifiedPortalSource(row)) return false;
  if (String(row.category || '').toLowerCase() === 'recruit') return false;
  if (String(row.status || '').toLowerCase() === 'portal_out') return false;
  if (isUfPortalCommit(row)) return false;
  const from = fromSchoolOf(row);
  if (!from || isFloridaSchoolNameSafe(from)) return false;
  if (portalRoomForPos(row.position || row.pos) !== room) return false;
  return true;
}

function toCandidate(row, source) {
  const name = cleanName(row.name || row.full_name || row.playerName);
  const slug = String(row.slug || row.playerSlug || slugify(name)).toLowerCase();
  const fromSchool = fromSchoolOf(row);
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
    pffGrade: row.pffGrade ?? row.pff_grade ?? row.pff ?? null,
    yearsLeft: row.yearsLeft ?? row.years_left ?? row.elig ?? null,
    stars: row.stars ?? null,
    natlRank: row.natlRank ?? row.natl ?? null,
    schemeFit: row.schemeFit ?? row.scheme_score ?? null,
    floridaOffer: row.floridaOffer || row.flOffer || false,
    floridaVisit: row.floridaVisit || row.ufVisit || false,
    staffFlag: row.staffFlag || false,
    beatLink: source === 'beat' || row.beatLink || false,
    category: 'portal',
    status: row.status || 'portal_in',
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

function collectPortalTargetCandidates({ incoming = [], intel = [], on3 = [] } = {}) {
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
  return out;
}

function roomCap(tier) {
  return ROOM_CAP[String(tier || '').toLowerCase()] ?? 2;
}

function passesHoldGate(score, tier) {
  const t = String(tier || '').toLowerCase();
  if (t !== 'stable' && t !== 'hold' && t !== 'watch') return true;
  const production = Math.max(score.pts.year1Starter || 0, score.pts.nonPowerProduction || 0);
  if (t === 'watch') return production >= 12 || score.buyScore >= 28;
  return production >= 20 || score.buyScore >= 40;
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
    byRoom.set(room.room, fits.slice(0, roomCap(room.tier)));
  }
  return byRoom;
}

function toScanChip(row) {
  if (!row || !row.name) return null;
  return {
    name: row.name,
    slug: row.slug || '',
    position: row.position || row.room || '',
    stars: Number(row.stars) > 0 ? Number(row.stars) : null,
    natlRank: Number(row.natlRank) > 0 ? Number(row.natlRank) : null,
    status: 'scan',
    committedTo: row.fromSchool || row.school || null,
    buyScore: row.buyScore,
    source: row.source,
  };
}

module.exports = {
  ROOM_CAP,
  isPortalTargetCandidate,
  collectPortalTargetCandidates,
  rankPortalTargets,
  toScanChip,
  looksLikePersonName,
};
