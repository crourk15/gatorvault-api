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

function teamPct(row) {
  if (!row) return null;
  const v =
    row.percent != null ? Number(row.percent) : row.prediction != null ? Number(row.prediction) : null;
  if (v == null || !Number.isFinite(v)) return null;
  return v > 1 ? v : v * 100;
}

function formatPct(v) {
  if (v == null || !Number.isFinite(Number(v))) return null;
  const n = Number(v);
  const pct = n <= 1 ? n * 100 : n;
  return `${Math.round(pct)}%`;
}

function interestedSchoolsFromTopTeams(topTeams, classYear, limit = 8) {
  const year = Number(classYear) || 2028;
  const yearRows = on3Recruit.getYearTopTeams(topTeams || [], year);
  const rows = yearRows.length ? yearRows : topTeams || [];
  return rows
    .filter((t) => !on3Recruit.isHighSchoolOrg(t))
    .map((t) => {
      const school = teamLabel(t);
      if (!school) return null;
      const pct = formatPct(teamPct(t));
      const status = t.status ? String(t.status) : null;
      const bits = [school];
      if (pct) bits.push(`RPM ~${pct}`);
      if (status && !/unknown/i.test(status)) bits.push(status);
      return {
        school,
        pct: teamPct(t),
        status,
        label: bits.join(' · ')
      };
    })
    .filter(Boolean)
    .sort((a, b) => (Number(b.pct) || 0) - (Number(a.pct) || 0))
    .slice(0, limit);
}

function ufRpmFromTopTeams(topTeams, classYear) {
  const uf = on3Recruit.getFloridaTeam(topTeams || [], Number(classYear) || 2028);
  if (!uf) return null;
  return teamPct(uf);
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
  interestedSchoolsFromTopTeams,
  ufRpmFromTopTeams,
  rankingLine,
  mergePlayerWithProfile,
  hydrateRecruitBoard
};
