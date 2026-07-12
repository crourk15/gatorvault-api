/**
 * Real competitor extraction — no default schools or synthetic scores.
 */
const { parseUfPct, isFloridaSchool: isFloridaSchoolScoring } = require('./recruiting-hub-scoring');
const { resolveCommitmentOverride } = require('./commitment-prediction-override');

function isFloridaSchool(value) {
  return isFloridaSchoolScoring(value);
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

function normalizeSchoolName(name) {
  return String(name || '').trim().slice(0, 28);
}

function addCompetitor(map, name, score, trend = 'flat') {
  const normalized = normalizeSchoolName(name);
  if (!normalized || isFloridaSchool(normalized)) return;
  const key = normalized.toLowerCase();
  const existing = map.get(key);
  const parsedScore = score != null ? parseUfPct(score) : null;
  if (!existing) {
    map.set(key, {
      school: normalized,
      logo: schoolInitials(normalized),
      score: parsedScore,
      trend,
    });
    return;
  }
  if (parsedScore != null) existing.score = parsedScore;
  if (trend !== 'flat') existing.trend = trend;
}

function extractCommittedElsewhere(player) {
  const school = player.committedTo ?? player.school;
  if (!school || isFloridaSchool(school)) return null;
  const status = String(player.status || player.ufOvStatus || '').toLowerCase();
  if (status.includes('commit') && !isFloridaSchool(school)) return normalizeSchoolName(school);
  if (player.committedTo && !isFloridaSchool(player.committedTo)) {
    return normalizeSchoolName(player.committedTo);
  }
  return null;
}

function parseLeaderName(field) {
  if (!field) return null;
  if (typeof field === 'string') return field.trim() || null;
  return field.name || field.school || field.schoolName || null;
}

function extractRealCompetitors(player, intelRows = []) {
  const map = new Map();
  const slug = String(player.slug || '').toLowerCase();
  const hasPlayerCompetitors = Array.isArray(player.competitors) && player.competitors.length > 0;

  for (const entry of player.competitors || []) {
    if (typeof entry === 'string') {
      addCompetitor(map, entry, null);
      continue;
    }
    addCompetitor(
      map,
      entry?.school || entry?.schoolName || entry?.name,
      entry?.score ?? entry?.probability ?? entry?.pct ?? null,
      entry?.trend || 'flat'
    );
  }

  // Confirmed On3 RPM board — merge absolute school % (never invent schools).
  try {
    const { rpmTopFromOn3TopTeams } = require('./autoposter/rewrite/comp-sourcing');
    const classYear = Number(player.classYear) || 2028;
    const topTeams = player.on3TopTeams || player.topTeams || [];
    if (Array.isArray(topTeams) && topTeams.length) {
      for (const row of rpmTopFromOn3TopTeams(topTeams, classYear)) {
        if (row?.school && row.pct != null) {
          addCompetitor(map, row.school, row.pct, 'flat');
        }
      }
    }
  } catch {
    /* optional */
  }

  for (const field of [player.leaderSchool, player.predictionLeader, player.topSchool]) {
    const name = parseLeaderName(field);
    if (name) addCompetitor(map, name, null);
  }

  const committedElsewhere = extractCommittedElsewhere(player);
  if (committedElsewhere) {
    // Real school only — do not invent a fake RPM %.
    addCompetitor(map, committedElsewhere, null);
  }

  const rivals = player.rivalsLastPrediction;
  if (rivals) {
    if (typeof rivals === 'string') {
      addCompetitor(map, rivals, null);
    } else {
      addCompetitor(map, rivals.school || rivals.schoolName || rivals.name, rivals.pct ?? rivals.confidence);
    }
  }

  if (!hasPlayerCompetitors) {
    for (const row of intelRows) {
      const rowSlug = String(row.playerSlug || row.player_slug || '').toLowerCase();
      if (rowSlug !== slug) continue;

      if (row.predictionSchool && !isFloridaSchool(row.predictionSchool)) {
        addCompetitor(
          map,
          row.predictionSchool,
          row.confidencePct,
          row.movementDelta > 0 ? 'up' : row.movementDelta < 0 ? 'down' : 'flat'
        );
      }
      if (row.nextVisitSchool && !isFloridaSchool(row.nextVisitSchool)) {
        addCompetitor(map, row.nextVisitSchool, null);
      }
      if (row.competitorSchool && !isFloridaSchool(row.competitorSchool)) {
        addCompetitor(map, row.competitorSchool, row.competitorScore ?? null);
      }
      if (Array.isArray(row.competitorMentions)) {
        for (const mention of row.competitorMentions) {
          const name = typeof mention === 'string' ? mention : mention?.school || mention?.name;
          const score = typeof mention === 'object' ? mention?.score ?? mention?.pct : null;
          if (name) addCompetitor(map, name, score);
        }
      }
    }
  }

  const all = [...map.values()].filter((c) => c.school);
  const scored = all.filter((c) => c.score != null && Number.isFinite(Number(c.score)));
  // Prefer confirmed RPM rows; fall back to named rivals only when no scores exist.
  const preferred = scored.length ? scored : all;
  return preferred.sort((a, b) => Number(b.score ?? -1) - Number(a.score ?? -1)).slice(0, 5);
}

function resolveStrictUfScore(player, intelRows = []) {
  if (resolveCommitmentOverride(player)) return null;

  // Confirmed On3 UF RPM first when present.
  const rpm = parseUfPct(player.ufRpmPct);
  if (rpm != null && rpm > 0) return rpm;

  const pct = parseUfPct(player.ufProbability);
  if (pct != null && pct > 0) return pct;

  // Florida row on On3 topTeams board.
  try {
    const on3Recruit = require('./on3-recruit-client');
    const classYear = Number(player.classYear) || 2028;
    const topTeams = player.on3TopTeams || player.topTeams || [];
    if (Array.isArray(topTeams) && topTeams.length) {
      const yearTeams = on3Recruit.getYearTopTeams
        ? on3Recruit.getYearTopTeams(topTeams, classYear)
        : topTeams;
      const ufTeam = yearTeams.find(
        (t) => on3Recruit.isFloridaTeam?.(t) || isFloridaSchool(t?.team?.name || t?.team?.fullName)
      );
      if (ufTeam) {
        const ufPct = parseUfPct(
          ufTeam.percent ?? ufTeam.percentage ?? ufTeam.prediction ?? ufTeam.pct
        );
        if (ufPct != null && ufPct > 0) return ufPct;
      }
    }
  } catch {
    /* optional */
  }

  const rivals = player.rivalsLastPrediction;
  if (rivals && typeof rivals === 'object') {
    const school = rivals.school || rivals.schoolName || rivals.name;
    if (isFloridaSchool(school)) {
      const conf = parseUfPct(rivals.pct ?? rivals.confidence ?? player.rivalsConfidence);
      if (conf != null && conf > 0) return conf;
    }
  }

  const slug = String(player.slug || '').toLowerCase();
  for (const row of intelRows) {
    const rowSlug = String(row.playerSlug || row.player_slug || '').toLowerCase();
    if (rowSlug !== slug) continue;
    if (row.predictionSchool && isFloridaSchool(row.predictionSchool) && row.confidencePct != null) {
      const conf = parseUfPct(row.confidencePct);
      if (conf != null && conf > 0) return conf;
    }
  }

  return null;
}

function topCompetitorScore(competitors) {
  if (!competitors.length) return null;
  const scored = competitors.filter((c) => c.score != null && Number.isFinite(Number(c.score)));
  if (!scored.length) return null;
  return Math.max(...scored.map((c) => Number(c.score)));
}

function hasRealInterestData(player) {
  const pct = parseUfPct(player.ufProbability);
  if (pct != null && pct > 0) return true;
  if (player.rivalsConfidence != null && Number.isFinite(Number(player.rivalsConfidence))) return true;
  const leader = parseLeaderName(player.leaderSchool ?? player.predictionLeader ?? player.topSchool);
  if (leader) return true;
  if (player.rivalsLastPrediction) return true;
  return false;
}

function hasRealVisitData(player, intelRows = []) {
  const slug = String(player.slug || '').toLowerCase();
  if (player.visitStart || player.visitEnd) return true;
  for (const arr of [player.visits, player.visitHistory]) {
    if (!Array.isArray(arr)) continue;
    for (const visit of arr) {
      if (!visit) continue;
      const school =
        typeof visit === 'string'
          ? visit
          : visit.school || visit.visitSchool || visit.host || visit.location || '';
      if (school) return true;
    }
  }
  for (const row of intelRows) {
    const rowSlug = String(row.playerSlug || row.player_slug || '').toLowerCase();
    if (rowSlug !== slug) continue;
    const et = String(row.eventType || '').toLowerCase();
    if (/visit|ov_change/.test(et)) return true;
  }
  return false;
}

function hasRealIntelData(player, intelRows = []) {
  const slug = String(player.slug || '').toLowerCase();
  return intelRows.some((row) => {
    const rowSlug = String(row.playerSlug || row.player_slug || '').toLowerCase();
    if (rowSlug !== slug) return false;
    const source = String(row.source || '').toLowerCase();
    if (/beat_writer|twitter|x_post|podcast|headline/i.test(source)) return false;
    return true;
  });
}

function hasRealStaffPriority(player) {
  return Boolean(
    player.staff_lead_id ||
      player.staffLeadId ||
      player.secondary_recruiter_id ||
      player.secondaryRecruiterId
  );
}

module.exports = {
  extractRealCompetitors,
  topCompetitorScore,
  resolveStrictUfScore,
  hasRealInterestData,
  hasRealVisitData,
  hasRealIntelData,
};
