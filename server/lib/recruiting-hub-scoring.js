/**
 * Recruiting Hub scoring models — UF battle position, threat, momentum, visits, staff.
 */

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function calcUfScore(interestLevel, visitScore, staffPriority, intelConfidence, timelineFit) {
  const score =
    clamp(Number(interestLevel) || 0, 0, 1) * 0.3 +
    clamp(Number(visitScore) || 0, 0, 1) * 0.25 +
    clamp(Number(staffPriority) || 0, 0, 1) * 0.2 +
    clamp(Number(intelConfidence) || 0, 0, 1) * 0.15 +
    clamp(Number(timelineFit) || 0, 0, 1) * 0.1;
  return Math.round(score * 100);
}

function parseUfPct(raw) {
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  const num = Number(raw);
  return Math.min(100, Math.max(0, Math.round(num <= 1 ? num * 100 : num)));
}

function isFloridaSchool(value) {
  return /florida|gators|\buf\b/i.test(String(value || ''));
}

function deriveInterestLevel(player) {
  const pct = parseUfPct(player.ufProbability);
  if (pct != null && pct > 0) return clamp(pct / 100, 0, 1);

  const leader = player.leaderSchool ?? player.predictionLeader ?? player.topSchool ?? null;
  const leaderName = typeof leader === 'string' ? leader : leader?.name || leader?.school || '';
  if (isFloridaSchool(leaderName)) return 0.9;
  if (leaderName && !isFloridaSchool(leaderName)) return 0.3;

  const tier = String(player.tier || '').toUpperCase();
  if (tier === 'TOP') return 0.7;
  if (tier === 'HIGH') return 0.6;
  if (player.isTarget) return 0.5;
  return 0.3;
}

function deriveVisitScore(player, intelRows) {
  const slug = String(player.slug || '').toLowerCase();
  let score = 0.2;

  const visitFields = [
    player.visitStart,
    player.visitEnd,
    ...(Array.isArray(player.visits) ? player.visits : []),
    ...(Array.isArray(player.visitHistory) ? player.visitHistory : []),
  ];

  for (const v of visitFields) {
    if (!v) continue;
    if (typeof v === 'object') {
      const school = v.school || v.visitSchool || v.host || '';
      if (isFloridaSchool(school) || !school) {
        const type = String(v.type || v.visitType || '').toUpperCase();
        if (type.includes('OFFICIAL') || type === 'OV') score = Math.max(score, 0.9);
        else score = Math.max(score, 0.7);
      }
    } else if (player.visitStart && isFloridaSchool(player.nextVisitSchool)) {
      score = Math.max(score, 0.8);
    } else if (player.visitStart) {
      score = Math.max(score, 0.5);
    }
  }

  if (player.visitStart) {
    const d = new Date(player.visitStart);
    if (!Number.isNaN(d.getTime())) {
      const daysUntil = (d.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      if (daysUntil >= 0 && daysUntil <= 60) score = Math.max(score, 0.8);
      else if (daysUntil < 0 && daysUntil >= -30) score = Math.max(score, 0.9);
    }
  }

  for (const row of intelRows) {
    const rowSlug = String(row.playerSlug || row.player_slug || '').toLowerCase();
    if (rowSlug !== slug) continue;
    const et = String(row.eventType || '').toLowerCase();
    if (et === 'official_visit' || et === 'ov_change') score = Math.max(score, 0.8);
    else if (et === 'unofficial_visit' || et === 'visit') score = Math.max(score, 0.7);
    else if (et === 'visit_cancelled') score = Math.min(score, 0.3);
  }

  return clamp(score, 0, 1);
}

function deriveStaffPriority(player) {
  const tier = String(player.tier || '').toUpperCase();
  if (tier === 'TOP' || player.headliner) return 0.9;
  if (tier === 'HIGH') return 0.8;
  if (tier === 'MEDIUM') return 0.6;
  if (player.isTarget) return 0.5;
  return 0.4;
}

function deriveIntelConfidence(player, intelRows) {
  const slug = String(player.slug || '').toLowerCase();
  const playerIntel = intelRows.filter(
    (r) => String(r.playerSlug || r.player_slug || '').toLowerCase() === slug
  );
  if (!playerIntel.length) {
    const rivals = player.rivalsConfidence != null ? Number(player.rivalsConfidence) : null;
    if (rivals != null && Number.isFinite(rivals)) return clamp(rivals / 100, 0, 1);
    return 0.4;
  }

  let positive = 0;
  let negative = 0;
  for (const row of playerIntel) {
    const delta = Number(row.movementDelta);
    const et = String(row.eventType || '').toLowerCase();
    if (delta > 0 || et === 'momentum_up' || et === 'offer') positive += 1;
    else if (delta < 0 || et === 'momentum_down' || et === 'visit_cancelled') negative += 1;
  }

  if (positive > negative) return 0.9;
  if (negative > positive) return 0.4;
  return 0.6;
}

function deriveTimelineFit(player) {
  const cy = Number(player.classYear);
  const currentYear = new Date().getFullYear();
  if (!Number.isFinite(cy)) return 0.5;
  const yearsOut = cy - currentYear;
  if (yearsOut <= 1) return 0.9;
  if (yearsOut === 2) return 0.7;
  if (yearsOut === 3) return 0.5;
  return 0.4;
}

function deriveUfScoreInputs(player, intelRows = []) {
  return {
    interestLevel: deriveInterestLevel(player),
    visitScore: deriveVisitScore(player, intelRows),
    staffPriority: deriveStaffPriority(player),
    intelConfidence: deriveIntelConfidence(player, intelRows),
    timelineFit: deriveTimelineFit(player),
  };
}

function resolveUfScore(player, intelRows = []) {
  const pct = parseUfPct(player.ufProbability);
  if (pct != null && pct > 0) return pct;
  const inputs = deriveUfScoreInputs(player, intelRows);
  return calcUfScore(
    inputs.interestLevel,
    inputs.visitScore,
    inputs.staffPriority,
    inputs.intelConfidence,
    inputs.timelineFit
  );
}

function getBattleDifficulty(ufScore, topCompetitorScore, trend) {
  if (ufScore == null || topCompetitorScore == null) return 'unknown';
  const uf = Number(ufScore);
  const top = Number(topCompetitorScore);
  if (!Number.isFinite(uf) || !Number.isFinite(top)) return 'unknown';
  const gap = uf - top;

  if (uf >= 80 && gap >= 20 && trend !== 'down') return 'easy';
  if (uf >= 65 && gap >= 10 && trend !== 'down') return 'moderate';
  if (uf >= 50 && gap <= 10 && gap >= -10) return 'hard';
  if (uf >= 60 && trend === 'down') return 'flip';
  if (uf < 40 && top >= 60) return 'longshot';
  return 'hard';
}

function getBattleColor(ufScore) {
  if (ufScore == null || !Number.isFinite(Number(ufScore))) return null;
  const uf = Number(ufScore);
  if (uf >= 70) return 'blue';
  if (uf >= 40) return 'orange';
  return 'red';
}

function calcThreatIndex(competitorScore, ufScore, trend) {
  const base = (Number(competitorScore) || 0) - (Number(ufScore) || 0);
  const trendBoost = trend === 'up' ? 10 : trend === 'down' ? -10 : 0;
  const raw = base + trendBoost;
  return clamp(Math.round(raw + 50), 0, 100);
}

function calcMomentumMeter(
  recentCommits,
  recentMisses,
  bigWins,
  bigLosses,
  positiveIntelEvents,
  negativeIntelEvents
) {
  const score =
    (Number(recentCommits) || 0) * 8 +
    (Number(bigWins) || 0) * 10 +
    (Number(positiveIntelEvents) || 0) * 3 -
    (Number(recentMisses) || 0) * 6 -
    (Number(bigLosses) || 0) * 8 -
    (Number(negativeIntelEvents) || 0) * 4;
  const normalized = clamp(score, -50, 50);
  return Math.round(((normalized + 50) * 100) / 100);
}

function calcVisitImpact(visitType, timingDays, intelReaction) {
  const typeBase = visitType === 'OV' ? 30 : visitType === 'UV' ? 20 : 10;
  const timingBoost =
    timingDays >= 0 ? Math.max(0, 20 - timingDays) : Math.max(0, 20 + timingDays);
  const intelBoost = intelReaction === 'strong' ? 20 : intelReaction === 'mixed' ? 10 : 0;
  return clamp(typeBase + timingBoost + intelBoost, 0, 100);
}

function calcStaffImpact(wins, losses, assistWins, assistLosses, positionRoomQuality, visitCloses) {
  const score =
    (Number(wins) || 0) * 10 +
    (Number(assistWins) || 0) * 5 +
    (Number(visitCloses) || 0) * 6 +
    (Number(positionRoomQuality) || 0) / 10 -
    (Number(losses) || 0) * 8 -
    (Number(assistLosses) || 0) * 4;
  return clamp(Math.round(score), 0, 100);
}

function normalizePipelineScore(raw) {
  if (raw <= 0) return 0;
  return clamp(Math.round((raw / 120) * 100), 0, 100);
}

module.exports = {
  calcUfScore,
  deriveUfScoreInputs,
  deriveInterestLevel,
  deriveVisitScore,
  deriveStaffPriority,
  deriveIntelConfidence,
  deriveTimelineFit,
  resolveUfScore,
  getBattleDifficulty,
  getBattleColor,
  calcThreatIndex,
  calcMomentumMeter,
  calcVisitImpact,
  calcStaffImpact,
  normalizePipelineScore,
  parseUfPct,
  isFloridaSchool,
};
