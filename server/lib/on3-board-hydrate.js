/**
 * Live On3 board hydration for thin recruiting-store / beat-desk players.
 * Pulls rankings + interested schools so Beat Brief / elite research aren't hollow.
 */
const on3Recruit = require('./on3-recruit-client');
const {
  discoverOn3RecruitSlug,
  profileToSchoolPatch
} = require('./on3-recruit-discovery');

function humanizeSlugName(slugOrName) {
  const raw = String(slugOrName || '').trim();
  if (!raw) return null;
  if (/\s/.test(raw)) return raw;
  return raw
    .replace(/-\d+$/, '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function boardNeedsHydration(player) {
  if (!player) return true;
  const teams = player.on3TopTeams || player.topTeams || [];
  const hasRanks =
    player.natlRank != null ||
    player.nationalRank != null ||
    player.posRank != null ||
    player.positionRank != null ||
    player.stateRank != null;
  const hasStars = player.stars != null;
  return !hasRanks || !teams.length || !hasStars;
}

function profileUsableForClass(profile, classYear) {
  if (!profile || profile.error) return false;
  const cy = Number(profile.classYear);
  const want = Number(classYear);
  if (Number.isFinite(cy) && Number.isFinite(want)) {
    // Reject stale enrolled profiles (e.g. 2024 Nick Carroll) when asking for 2027+.
    if (want >= 2027 && cy <= 2025) return false;
    if (Math.abs(cy - want) > 2) return false;
  }
  return Boolean(profile.name || profile.slug);
}

function teamLabel(row) {
  if (!row) return null;
  if (typeof row === 'string') return row.trim() || null;
  return (
    row.team?.name ||
    row.team?.fullName ||
    row.name ||
    row.school ||
    row.team ||
    null
  );
}

/**
 * Raw On3 Team Predictions value.
 * Live Industry Consensus uses percentage points (17.63). Some lower-board rows
 * carry an identical residual fraction (~0.6887) that must NOT be treated as 69%.
 */
function rawTeamPrediction(row) {
  if (!row) return null;
  const v =
    row.percent != null ? Number(row.percent) : row.prediction != null ? Number(row.prediction) : null;
  if (v == null || !Number.isFinite(v) || v < 0) return null;
  return v;
}

/**
 * Detect whether a topTeams board is percentage-points or 0–1 fractions.
 * Mixed boards (real RPM > 1 plus residual fractions) are percent-scale.
 */
function detectTopTeamsPctScale(rows = []) {
  const vals = (rows || []).map(rawTeamPrediction).filter((v) => v != null && v > 0);
  if (!vals.length) return 'unknown';
  if (vals.some((v) => v > 1)) return 'percent';
  return 'fraction';
}

/**
 * Values that appear identically on many schools are On3 residual noise, not RPM.
 * Example: Penn State/ND/SMU/... all share prediction 0.6887052341597797.
 */
function residualPredictionKeys(rows = [], scale = 'unknown') {
  const counts = new Map();
  for (const row of rows || []) {
    const raw = rawTeamPrediction(row);
    if (raw == null || raw <= 0) continue;
    const key = String(raw);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const residual = new Set();
  for (const [key, count] of counts) {
    if (count < 3) continue;
    const raw = Number(key);
    const pct = scale === 'fraction' ? raw * 100 : raw;
    // Shared micro-defaults only — never drop a real differentiated consensus stack.
    if (pct < 2.5) residual.add(key);
  }
  return residual;
}

function normalizePredictionToPct(raw, scale = 'unknown') {
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  const v = Number(raw);
  if (v < 0) return null;
  if (scale === 'fraction') return v <= 1 ? v * 100 : v;
  // percent / unknown with value > 1: already percentage points
  if (v > 1) return v;
  // Ambiguous lone fraction with no board context: keep legacy fraction→percent.
  if (scale === 'unknown') return v * 100;
  // percent-scale board: 0.6887 means 0.69%, not 69%
  return v;
}

function teamPct(row, scale = 'unknown') {
  return normalizePredictionToPct(rawTeamPrediction(row), scale);
}

function formatPct(v) {
  if (v == null || !Number.isFinite(Number(v))) return null;
  return `${Math.round(Number(v))}%`;
}

function interestedSchoolsFromTopTeams(topTeams, classYear, limit = 8) {
  const year = Number(classYear) || 2028;
  const yearRows = on3Recruit.getYearTopTeams(topTeams || [], year);
  const rows = yearRows.length ? yearRows : topTeams || [];
  const collegeRows = rows.filter((t) => !on3Recruit.isHighSchoolOrg(t));
  const scale = detectTopTeamsPctScale(collegeRows);
  const residual = residualPredictionKeys(collegeRows, scale);
  return collegeRows
    .map((t) => {
      const school = teamLabel(t);
      if (!school) return null;
      const raw = rawTeamPrediction(t);
      const isResidual = raw != null && residual.has(String(raw));
      const pct = isResidual ? null : teamPct(t, scale);
      const status = t.status ? String(t.status) : null;
      const bits = [school];
      if (pct != null && pct > 0) bits.push(`RPM ~${formatPct(pct)}`);
      if (status && !/unknown/i.test(status)) bits.push(status);
      return {
        school,
        pct,
        status,
        residual: isResidual,
        label: bits.join(' · ')
      };
    })
    .filter(Boolean)
    .sort((a, b) => (Number(b.pct) || 0) - (Number(a.pct) || 0))
    .slice(0, limit);
}

function ufRpmFromTopTeams(topTeams, classYear) {
  const year = Number(classYear) || 2028;
  const yearRows = on3Recruit.getYearTopTeams(topTeams || [], year);
  const rows = yearRows.length ? yearRows : topTeams || [];
  const scale = detectTopTeamsPctScale(rows.filter((t) => !on3Recruit.isHighSchoolOrg(t)));
  const uf = on3Recruit.getFloridaTeam(topTeams || [], year);
  if (!uf) return null;
  return teamPct(uf, scale);
}

function rankingLine(player = {}) {
  const bits = [];
  if (player.stars != null) bits.push(`${player.stars}★`);
  const pos = player.position || player.pos;
  if (pos) bits.push(String(pos).toUpperCase());
  const natl = player.natlRank ?? player.nationalRank;
  const posRank = player.posRank ?? player.positionRank;
  const stateRank = player.stateRank;
  if (natl != null) bits.push(`Natl #${natl}`);
  if (posRank != null) bits.push(`Pos #${posRank}`);
  if (stateRank != null) {
    const st = player.state || player.hometownState || '';
    bits.push(st ? `State #${stateRank} (${st})` : `State #${stateRank}`);
  }
  return bits.length ? bits.join(' · ') : null;
}


function isUfSchoolName(name) {
  const s = String(name || '').trim().toLowerCase();
  if (!s) return false;
  if (s === 'florida' || s === 'florida gators' || s === 'uf' || s === 'gators') return true;
  // Do not treat Florida State / South Florida as UF.
  if (/florida\s*state|seminoles|\bfsu\b|south\s*florida|\busf\b/.test(s)) return false;
  return /^florida\b/.test(s) && !/state|south/.test(s);
}


function formatVisitDate(ts) {
  if (ts == null || ts === '') return null;
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return null;
  // On3 uses unix seconds
  const ms = n > 1e12 ? n : n * 1000;
  try {
    return new Date(ms).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function coachNames(row) {
  return (row?.coaches || [])
    .filter(Boolean)
    .map((c) => String(c.name || '').trim())
    .filter(Boolean);
}

function visitTrailFromTopTeams(topTeams, classYear, limit = 10) {
  const year = Number(classYear) || 2028;
  const yearRows = on3Recruit.getYearTopTeams(topTeams || [], year);
  const rows = yearRows.length ? yearRows : topTeams || [];
  return rows
    .filter((t) => !on3Recruit.isHighSchoolOrg(t))
    .map((t) => {
      const school = teamLabel(t);
      if (!school) return null;
      const ov = Number(t.officialVisitCount) || 0;
      const uov = Number(t.unOfficialVisitCount) || 0;
      const latest = t.latestVisit || null;
      const latestDate = formatVisitDate(latest?.dateOccurred);
      const kind = latest
        ? latest.official
          ? 'OV'
          : 'UOV'
        : ov
          ? 'OV'
          : uov
            ? 'UOV'
            : null;
      if (!ov && !uov && !latestDate) return null;
      const bits = [school];
      if (ov) bits.push(`${ov} OV`);
      if (uov) bits.push(`${uov} UOV`);
      if (latestDate) bits.push(`latest ${kind || 'visit'} ${latestDate}`);
      return {
        school,
        officialVisitCount: ov,
        unOfficialVisitCount: uov,
        latestDate,
        latestOfficial: latest ? !!latest.official : null,
        label: bits.join(' · ')
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const ad = a.latestDate || '';
      const bd = b.latestDate || '';
      return bd.localeCompare(ad);
    })
    .slice(0, limit);
}

function ufStaffFromTopTeams(topTeams, classYear) {
  const uf = on3Recruit.getFloridaTeam(topTeams || [], Number(classYear) || 2028);
  if (!uf) return null;
  const coaches = coachNames(uf);
  if (!coaches.length) return null;
  return {
    school: 'Florida',
    status: uf.status || null,
    coaches,
    label: `Florida staff: ${coaches.join(', ')}${uf.status ? ` (${uf.status})` : ''}`
  };
}

function schoolLadderDetailed(topTeams, classYear, limit = 10) {
  const year = Number(classYear) || 2028;
  const schools = interestedSchoolsFromTopTeams(topTeams, year, limit);
  const visits = visitTrailFromTopTeams(topTeams, year, 20);
  const visitMap = new Map(visits.map((v) => [v.school, v]));
  const yearRows = on3Recruit.getYearTopTeams(topTeams || [], year);
  const rows = yearRows.length ? yearRows : topTeams || [];
  const coachMap = new Map();
  for (const t of rows) {
    const school = teamLabel(t);
    if (!school) continue;
    const coaches = coachNames(t);
    if (coaches.length) coachMap.set(school, coaches);
  }
  return schools.map((s) => {
    const v = visitMap.get(s.school);
    const coaches = coachMap.get(s.school) || [];
    const bits = [s.label];
    if (v?.officialVisitCount) bits.push(`${v.officialVisitCount} OV`);
    if (v?.unOfficialVisitCount) bits.push(`${v.unOfficialVisitCount} UOV`);
    if (v?.latestDate) bits.push(`last ${v.latestDate}`);
    if (coaches.length) bits.push(`coach ${coaches[0]}`);
    return { ...s, coaches, visit: v || null, detail: bits.join(' · ') };
  });
}

function measurementsLine(player = {}) {
  const ht = player.htWt || [player.height, player.weight].filter(Boolean).join(' / ');
  return ht ? String(ht).trim() : null;
}

function mergePlayerWithProfile(player, profile, recruitSlug) {
  const patch = profileToSchoolPatch(profile);
  const classYear = profile.classYear || player?.classYear || null;
  const topTeams = profile.topTeams || player?.on3TopTeams || [];
  const ufRpm = ufRpmFromTopTeams(topTeams, classYear);
  const ufTeam = on3Recruit.getFloridaTeam(topTeams, Number(classYear) || 2028);
  const rivals = interestedSchoolsFromTopTeams(topTeams, classYear, 10)
    .map((s) => s.school)
    .filter((s) => !isUfSchoolName(s));

  return {
    ...(player || {}),
    ...patch,
    name: profile.name || player?.name || null,
    fullName: profile.name || player?.fullName || null,
    classYear: classYear || player?.classYear || null,
    position: patch.pos || player?.position || player?.pos || null,
    pos: patch.pos || player?.pos || null,
    stars: patch.stars ?? player?.stars ?? null,
    natlRank: patch.natlRank ?? player?.natlRank ?? null,
    posRank: patch.posRank ?? player?.posRank ?? null,
    stateRank: patch.stateRank ?? player?.stateRank ?? null,
    rating: patch.rating ?? player?.rating ?? null,
    school: patch.school || player?.school || null,
    state: patch.state || player?.state || null,
    hometown: profile.hometownCity
      ? `${profile.hometownCity}${patch.state ? `, ${patch.state}` : ''}`
      : player?.hometown || null,
    on3Slug: recruitSlug || patch.on3Slug || player?.on3Slug || null,
    on3TopTeams: topTeams,
    topTeams,
    competingSchools: rivals.length ? rivals : player?.competingSchools || null,
    rivals: rivals.length ? rivals : player?.rivals || null,
    ufRpmPct: ufRpm != null ? ufRpm : player?.ufRpmPct ?? null,
    ufProbability:
      ufRpm != null ? (ufRpm > 1 ? ufRpm / 100 : ufRpm) : player?.ufProbability ?? null,
    ufStatus:
      player?.ufStatus ||
      (ufTeam?.status ? `Florida ${ufTeam.status}` : player?.status) ||
      null,
    height: profile.height || player?.height || null,
    weight: profile.weight ?? player?.weight ?? null,
    htWt: profile.htWt || player?.htWt || null,
    nilValue: profile.nilValue ?? player?.nilValue ?? null,
    on3ProfileUrl:
      profile.on3ProfileUrl ||
      (recruitSlug ? `https://www.on3.com/rivals/${recruitSlug}/` : player?.on3ProfileUrl) ||
      null,
    visitTrail: visitTrailFromTopTeams(topTeams, classYear, 12),
    ufStaff: ufStaffFromTopTeams(topTeams, classYear),
    schoolLadder: schoolLadderDetailed(topTeams, classYear, 10),
    hydrationSource: 'on3-live'
  };
}

/**
 * Discover + fetch On3 board for a desk slug. Tries multiple class years.
 */
async function hydrateRecruitBoard({
  slug,
  name = null,
  player = null,
  classYear = null,
  pos = null,
  force = false
} = {}) {
  if (!force && player && !boardNeedsHydration(player) && player.on3Slug) {
    return { player, profile: null, recruitSlug: player.on3Slug, source: 'cached' };
  }

  const humanName = humanizeSlugName(name || player?.name || slug);
  const years = [classYear, player?.classYear, player?.year, 2028, 2027, 2029]
    .map((y) => Number(y))
    .filter((y) => Number.isFinite(y) && y >= 2026 && y <= 2032);
  const uniqueYears = [...new Set(years)];

  for (const year of uniqueYears) {
    let discovered;
    try {
      discovered = await discoverOn3RecruitSlug(slug, {
        name: humanName,
        classYear: year,
        player,
        pos: pos || player?.pos || player?.position || null
      });
    } catch {
      discovered = null;
    }
    if (!discovered?.recruitSlug) continue;

    let profile = discovered.profile;
    if (!profile || profile.error || !profile.topTeams?.length) {
      try {
        profile = await on3Recruit.fetchRecruitProfile(discovered.recruitSlug, year);
      } catch {
        profile = null;
      }
    }
    if (!profileUsableForClass(profile, year)) continue;

    const merged = mergePlayerWithProfile(player, profile, discovered.recruitSlug);
    return {
      player: merged,
      profile,
      recruitSlug: discovered.recruitSlug,
      source: discovered.source || 'on3-live'
    };
  }

  return { player: player || null, profile: null, recruitSlug: null, source: null };
}

module.exports = {
  humanizeSlugName,
  isUfSchoolName,
  boardNeedsHydration,
  profileUsableForClass,
  rawTeamPrediction,
  detectTopTeamsPctScale,
  residualPredictionKeys,
  normalizePredictionToPct,
  teamPct,
  interestedSchoolsFromTopTeams,
  ufRpmFromTopTeams,
  rankingLine,
  visitTrailFromTopTeams,
  ufStaffFromTopTeams,
  schoolLadderDetailed,
  measurementsLine,
  mergePlayerWithProfile,
  hydrateRecruitBoard
};
