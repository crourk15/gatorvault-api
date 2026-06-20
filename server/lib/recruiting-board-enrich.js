/**
 * Recruiting board tier enrichment for /api/recruiting/board
 */
const { slugify } = require('./slug');
const { filterBlockedRecruits } = require('./recruiting-blocked-players');
const { getBreakdownBySlug } = require('./war-room-store');
const TIER_LABELS = {
  TOP: 'Top Priorities',
  HIGH: 'High Interest',
  MEDIUM: 'Medium Interest',
  LOW: 'Low Interest',
  EVAL: 'Evaluation Needed',
};

function playerRating(player) {
  const raw = player.displayRating ?? player.vaultGrade ?? player.rating;
  return raw != null ? Number(raw) : 0;
}

function assignTier(player) {
  const stars = Number(player.stars) || 0;
  const rating = playerRating(player);
  if (!stars && !rating) return 'EVAL';
  if (stars >= 5 || rating >= 0.98) return 'TOP';
  if (stars >= 4 || rating >= 0.9) return 'HIGH';
  if (stars >= 3 || rating >= 0.85) return 'MEDIUM';
  return 'LOW';
}

function evalStatus(player, isCommit) {
  if (isCommit) return 'Committed';
  const ov = String(player.ufOvStatus || '').toUpperCase();
  if (ov.includes('COMMIT') && !ov.includes('ELSE')) return 'Committed Elsewhere';
  if (ov.includes('OFFER')) return 'Offered';
  if (ov.includes('VISIT')) return 'Visiting';
  return 'Pending Eval';
}

function staffGrade(player) {
  const grade = player.vaultGrade ?? player.displayRating ?? player.rating;
  if (grade == null || grade === '') return null;
  const n = Number(grade);
  if (!Number.isFinite(n)) return String(grade);
  if (n >= 0.95) return 'A';
  if (n >= 0.88) return 'B';
  return 'C';
}

function mergeWarRoomFields(player, enriched) {
  const slug = enriched.slug || slugify(player.name);
  const breakdown = getBreakdownBySlug(slug);
  if (!breakdown) return enriched;
  const strengths = Array.isArray(breakdown.strengths) ? breakdown.strengths.filter(Boolean) : [];
  const weaknesses = Array.isArray(breakdown.weaknesses) ? breakdown.weaknesses.filter(Boolean) : [];
  const evaluatorNotes =
    breakdown.insiderNotes || breakdown.staffNotes || breakdown.recruitingStory || null;
  return {
    ...enriched,
    strengths,
    weaknesses,
    evaluatorNotes,
    skinny: enriched.skinny || (evaluatorNotes ? String(evaluatorNotes).slice(0, 280) : null),
    profileNote: enriched.profileNote || breakdown.recruitingStory || null,
  };
}

function enrichPlayer(player, isCommit, staffMode) {
  const tier = assignTier(player);
  const slug = player.slug || slugify(player.name);
  const base = {
    slug,
    name: player.name,
    position: player.pos || player.position || null,
    pos: player.pos || player.position || null,
    classYear: player.classYear,
    state: player.state || player.st || null,
    ufProbability: player.ufProbability ?? null,
    fitScore: player.fitScore ?? (playerRating(player) || null),
    staffGrade: staffGrade(player),
    status: evalStatus(player, isCommit),
    notes: staffMode ? player.skinny || player.profileNote || null : null,
    notePreview: staffMode
      ? null
      : player.skinny
        ? String(player.skinny).slice(0, 120)
        : null,
    tier,
    tierLabel: TIER_LABELS[tier],
    lifecycle: isCommit ? (player.lifecycle || 'commit') : 'HIGH_SCHOOL',
    school: player.school || null,
    stars: player.stars || null,
    rating: playerRating(player) || null,
    displayRating: player.displayRating ?? playerRating(player) ?? null,
    natlRank: player.natlRank ?? player.natl ?? null,
    natl: player.natlRank ?? player.natl ?? null,
    posRank: player.posRank ?? null,
    stateRank: player.stateRank ?? null,
    htWt: player.htWt || null,
    committedTo: player.committedTo ?? null,
    ufOvStatus: player.ufOvStatus ?? null,
    visitStart: player.visitStart ?? null,
    visitEnd: player.visitEnd ?? null,
    nextVisitSchool: player.nextVisitSchool ?? null,
    headliner: !!(player.headliner ?? player.isUFtarget),
    isTarget: !isCommit,
    isCommittedToUF: isCommit,
    skinny: player.skinny || player.profileNote || null,
    profileNote: player.profileNote || null,
    commitDate: player.commitDate || player.commit_date || null,
    inState: player.inState ?? player.in_state ?? (String(player.state || player.st || '').toUpperCase() === 'FL'),
    playerComp: player.playerComp || null,
    schemeFit: player.schemeFit || null,
    projection: player.projection || null,
    jerseyNumber: player.jerseyNumber ?? player.jersey ?? null,
    vaultGrade: player.vaultGrade ?? null,
    movementDirection:
      player.movementDirection ??
      (player.interestMeter === 'rising' ? 'up' : player.interestMeter === 'falling' ? 'down' : 'flat'),
  };
  return mergeWarRoomFields(player, base);
}

function enrichBoard(board, staffMode = false) {
  const commits = filterBlockedRecruits(board.commits || []).map((p) => enrichPlayer(p, true, staffMode));
  const targets = filterBlockedRecruits(board.targets || []).map((p) => enrichPlayer(p, false, staffMode));
  const players = [...commits, ...targets];

  const tiers = ['TOP', 'HIGH', 'MEDIUM', 'LOW', 'EVAL'].map((tier) => ({
    tier,
    label: TIER_LABELS[tier],
    count: players.filter((p) => p.tier === tier).length,
    players: players.filter((p) => p.tier === tier),
  }));

  return {
    classYear: board.classYear,
    lifecycle: 'HIGH_SCHOOL',
    players,
    tiers,
    commits,
    targets,
    rankings: board.rankings || null,
  };
}

module.exports = { enrichBoard, assignTier, TIER_LABELS };
