/**
 * Recruiting board tier enrichment for /api/recruiting/board
 */
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

function enrichPlayer(player, isCommit, staffMode) {
  const tier = assignTier(player);
  return {
    slug: player.slug,
    name: player.name,
    position: player.pos || player.position || null,
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
    lifecycle: 'HIGH_SCHOOL',
    school: player.school || null,
    stars: player.stars || null,
    rating: playerRating(player) || null,
    isTarget: !isCommit,
    isCommittedToUF: isCommit,
  };
}

function enrichBoard(board, staffMode = false) {
  const commits = (board.commits || []).map((p) => enrichPlayer(p, true, staffMode));
  const targets = (board.targets || []).map((p) => enrichPlayer(p, false, staffMode));
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
