/**
 * Recruiting board tier enrichment for /api/recruiting/board
 */
const { slugify } = require('./slug');
const { filterBlockedRecruits } = require('./recruiting-blocked-players');
const { getBreakdownBySlug } = require('./war-room-store');
const { enrichTargetsWithBoardSeed } = require('./target-board-enrich');
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

function normalizeRating100(rating) {
  const n = Number(rating);
  if (!Number.isFinite(n) || n <= 0) return 0;
  // On3/247 display ratings are typically 0–100; legacy fractional 0–1 still supported.
  return n > 1 ? n : n * 100;
}

function assignTier(player) {
  const stars = Number(player.stars) || 0;
  const rating = normalizeRating100(playerRating(player));
  if (!stars && !rating) return 'EVAL';
  if (stars >= 5 || rating >= 98) return 'TOP';
  if (stars >= 4 || rating >= 90) return 'HIGH';
  if (stars >= 3 || rating >= 85) return 'MEDIUM';
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
  const evaluatorNotes =
    breakdown.insiderNotes || breakdown.staffNotes || breakdown.recruitingStory || null;
  const {
    isGenericBeatArticle,
    isVerifiedScoutingTrait,
    isCompositeBio,
    intelReferencesPlayer,
  } = require('./recruiting-intel-quality');
  const notesOk =
    evaluatorNotes &&
    !isGenericBeatArticle(String(evaluatorNotes), enriched.name) &&
    intelReferencesPlayer(String(evaluatorNotes), enriched.name);
  const strengths = Array.isArray(breakdown.strengths)
    ? breakdown.strengths.filter(
        (s) =>
          s &&
          !isCompositeBio(String(s)) &&
          intelReferencesPlayer(String(s), enriched.name) &&
          isVerifiedScoutingTrait(String(s), enriched.name)
      )
    : [];
  const weaknesses = Array.isArray(breakdown.weaknesses)
    ? breakdown.weaknesses.filter(
        (s) => s && !isCompositeBio(String(s)) && isVerifiedScoutingTrait(String(s), enriched.name)
      )
    : [];
  const projection =
    breakdown.projection && !isGenericBeatArticle(String(breakdown.projection), enriched.name)
      ? String(breakdown.projection).trim()
      : null;
  const playerComp = breakdown.comparison || enriched.playerComp || null;
  const profileNote = String(enriched.profileNote || player.profileNote || '').trim();
  const profileNoteOk =
    profileNote && !isGenericBeatArticle(profileNote, enriched.name);
  const profileProjection =
    profileNoteOk && profileNote.match(/\b(?:He|She|They)\s+projects?\s+as[^.]+\./i)?.[0]?.trim() ||
    null;
  const fallbackInsider = profileNoteOk ? profileNote : null;
  return {
    ...enriched,
    strengths,
    weaknesses,
    projection: projection || profileProjection || enriched.projection || null,
    playerComp,
    insiderNotes: notesOk
      ? String(evaluatorNotes).trim()
      : fallbackInsider || enriched.insiderNotes || null,
    evaluatorNotes,
    profileNote:
      profileNoteOk
        ? profileNote
        : breakdown.recruitingStory &&
            !isGenericBeatArticle(String(breakdown.recruitingStory), enriched.name)
          ? breakdown.recruitingStory
          : null,
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
    // Never forge Fit % from composite rating — Fit requires scheme evidence (see scheme-fit-evidence.js).
    fitScore: player.fitScore != null && Number(player.fitScore) > 0 ? Number(player.fitScore) : null,
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
    hometownCity: player.hometownCity || player.city || null,
    city: player.hometownCity || player.city || null,
    hometownState: player.hometownState || player.state || player.st || null,
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
    nilValue: player.nilValue ?? null,
    nilEstimate: player.nilEstimate ?? player.nilValue ?? null,
    movementDirection:
      player.movementDirection ??
      (player.interestMeter === 'rising' ? 'up' : player.interestMeter === 'falling' ? 'down' : 'flat'),
  };
  return mergeWarRoomFields(player, base);
}

function normalizeBoardPlayerName(player) {
  return String(player.name || player.id || '').trim().toLowerCase();
}

function boardPlayerIdentityKeys(player) {
  const keys = [];
  const slug = String(player.slug || '').trim().toLowerCase();
  if (slug) keys.push(`slug:${slug}`);
  const name = normalizeBoardPlayerName(player);
  if (name) keys.push(`name:${name}`);
  return keys;
}

function preferBoardPlayer(existing, incoming) {
  if (existing.isCommittedToUF && !incoming.isCommittedToUF) return existing;
  if (!existing.isCommittedToUF && incoming.isCommittedToUF) return incoming;
  return existing;
}

function dedupeBoardPlayers(players) {
  const byName = new Map();
  for (const player of players) {
    const key = normalizeBoardPlayerName(player);
    if (!key) continue;
    const prev = byName.get(key);
    byName.set(key, prev ? preferBoardPlayer(prev, player) : player);
  }
  return [...byName.values()];
}

function dropTargetsAlreadyCommitted(commits, targets) {
  const commitKeys = new Set();
  for (const commit of commits) {
    for (const key of boardPlayerIdentityKeys(commit)) commitKeys.add(key);
  }
  return targets.filter((target) => {
    const keys = boardPlayerIdentityKeys(target);
    return !keys.some((key) => commitKeys.has(key));
  });
}

function enrichBoard(board, staffMode = false) {
  const classYear = parseInt(board.classYear, 10) || 2027;
  const allowlist = require('./recruiting-target-allowlist');
  const rawTargets = filterBlockedRecruits(board.targets || []);
  const commitSlugs = new Set(
    (board.commits || [])
      .map((p) => String(p.slug || '').trim().toLowerCase())
      .filter(Boolean)
  );
  const seededTargets = enrichTargetsWithBoardSeed(rawTargets, classYear, allowlist, {
    skipSlugs: commitSlugs,
  });
  const commits = filterBlockedRecruits(board.commits || []).map((p) => enrichPlayer(p, true, staffMode));
  const targets = dropTargetsAlreadyCommitted(
    commits,
    seededTargets.map((p) => enrichPlayer(p, false, staffMode))
  );
  const players = dedupeBoardPlayers([...commits, ...targets]);

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
    commits: players.filter((p) => p.isCommittedToUF),
    targets: players.filter((p) => !p.isCommittedToUF),
    rankings: board.rankings || null,
  };
}

module.exports = {
  enrichBoard,
  assignTier,
  TIER_LABELS,
  dedupeBoardPlayers,
  dropTargetsAlreadyCommitted,
};
