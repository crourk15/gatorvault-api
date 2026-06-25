/**
 * Build FutureCast page snapshots from recruiting store (DB/Supabase when configured).
 */
const FUTURECAST_CLASS_YEAR = 2027;
const MOVEMENT_WINDOW_DAYS = 7;
const { isFloridaSchool, isActiveUfTarget } = require('./recruiting-target-filters');
const {
  resolveCommitmentOverride,
  applyCommitmentPredictionOverride,
} = require('./commitment-prediction-override');

function buildHeatmap(players, windowDays = MOVEMENT_WINDOW_DAYS) {
  let upCount = 0;
  let downCount = 0;
  let flatCount = 0;
  for (const p of players) {
    const delta = p.trendDelta7d;
    if (delta == null) {
      flatCount += 1;
      continue;
    }
    if (delta > 0) upCount += 1;
    else if (delta < 0) downCount += 1;
    else flatCount += 1;
  }
  return { upCount, downCount, flatCount, windowDays };
}

async function loadOfflineBoardPlayers() {
  const store = require('./recruiting-store');
  const { CANONICAL_TARGET_NAMES } = require('./recruiting-target-allowlist');
  const { loadRecruitingRankings } = require('./load-recruiting-rankings');
  const { getLiveBoardTargets } = require('./live-board-targets');

  const rankings = loadRecruitingRankings();
  const board = await store.getBoard(FUTURECAST_CLASS_YEAR);
  const liveTargets = await getLiveBoardTargets(FUTURECAST_CLASS_YEAR);
  const seen = new Set();
  const players = [];

  function pushPlayer(p, { requireActiveTarget }) {
    const slug = String(p.slug || '').toLowerCase();
    if (!slug || seen.has(slug)) return;
    const override = resolveCommitmentOverride({ ...p, slug });
    if (requireActiveTarget && !isActiveUfTarget(p) && !override) return;
    seen.add(slug);
    const rank = rankings.get(slug);
    const committedTo = override?.committedTo ?? p.committedTo ?? p.committed_to ?? null;
    const ufCommitted = isFloridaSchool(committedTo);
    if (override) {
      players.push(
        applyCommitmentPredictionOverride({
          id: String(p.id || slug),
          slug,
          name: String(p.name || CANONICAL_TARGET_NAMES[slug] || slug),
          classYear: Number(p.classYear || FUTURECAST_CLASS_YEAR),
          position: String(p.pos || p.position || rank?.position || 'ATH'),
          school: p.school ?? null,
          hometown: p.hometown ?? null,
          state: p.state ?? null,
          composite: Number(p.rating || rank?.compositeScore || 0),
          stars: Number(p.stars || rank?.stars || 0),
          natlRank: p.natlRank ?? rank?.nationalRank ?? null,
          posRank: p.posRank ?? rank?.positionRank ?? null,
          stateRank: p.stateRank ?? rank?.stateRank ?? null,
          committedTo,
          competingSchools: [],
          predictors: [],
        })
      );
      return;
    }
    players.push({
      id: String(p.id || slug),
      slug,
      name: String(p.name || CANONICAL_TARGET_NAMES[slug] || slug),
      classYear: Number(p.classYear || FUTURECAST_CLASS_YEAR),
      position: String(p.pos || p.position || rank?.position || 'ATH'),
      school: p.school ?? null,
      hometown: p.hometown ?? null,
      state: p.state ?? null,
      composite: Number(p.rating || rank?.compositeScore || 0),
      stars: Number(p.stars || rank?.stars || 0),
      natlRank: p.natlRank ?? rank?.nationalRank ?? null,
      posRank: p.posRank ?? rank?.positionRank ?? null,
      stateRank: p.stateRank ?? rank?.stateRank ?? null,
      ufConfidence: ufCommitted ? 100 : Number(p.ufConfidence ?? p.confidence ?? 55),
      fitScore:
        p.ufFitScore != null && Number.isFinite(Number(p.ufFitScore))
          ? Math.round(Number(p.ufFitScore))
          : null,
      trendDelta7d:
        p.delta7d != null
          ? Number(p.delta7d)
          : p.movementDelta != null
            ? Number(p.movementDelta)
            : 0,
      volatility7d: Number(p.volatility7d ?? 0.1),
      priority: String(p.priority || 'medium').toLowerCase() === 'high' ? 'high' : 'medium',
      committedTo,
      competingSchools: [],
      predictors: [],
    });
  }

  for (const p of board.commits || []) {
    pushPlayer(p, { requireActiveTarget: false });
  }
  for (const p of liveTargets) {
    pushPlayer(p, { requireActiveTarget: true });
  }

  return players.filter(
    (p) => isActiveUfTarget(p) || isFloridaSchool(p.committedTo) || p.ufPredictionSuppressed
  );
}

function boardPlayerToFeedRow(p) {
  const now = new Date().toISOString();
  return {
    id: p.id,
    playerId: p.id,
    playerSlug: p.slug,
    fullName: p.name,
    classYear: p.classYear ?? FUTURECAST_CLASS_YEAR,
    position: p.position ?? 'ATH',
    lifecycle: 'HS',
    school: p.school ?? '',
    confidence: p.ufConfidence ?? 50,
    delta: p.trendDelta7d ?? 0,
    sourceType: 'MODEL',
    predictorId: 'allowlist',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    committedTo: p.committedTo ?? null,
    ufStatus: isFloridaSchool(p.committedTo) ? 'COMMITTED' : null,
    ufFitScore: p.fitScore ?? null,
    ufProbability: p.ufConfidence ?? null,
    stabilityScore: p.ufConfidence ?? null,
    volatilityScore: p.volatility7d ?? 0,
    stars: p.stars ?? null,
    natlRank: p.natlRank ?? null,
    posRank: p.posRank ?? null,
    stateRank: p.stateRank ?? null,
    rating: p.composite ?? null,
  };
}

function boardPlayerToStaffRow(p) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    delta: p.trendDelta7d ?? 0,
    delta7d: p.trendDelta7d ?? 0,
    volatilityScore: p.volatility7d ?? 0,
    ufFitScore: p.fitScore ?? null,
    lifecycle: 'HS',
  };
}

function boardPlayerToHighPriority(p) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    classYear: p.classYear ?? FUTURECAST_CLASS_YEAR,
    position: p.position ?? 'ATH',
    school: p.school ?? null,
    htWt: null,
    stars: p.stars ?? null,
    headliner: p.priority === 'high',
    committedTo: p.committedTo ?? null,
    compositeScore: p.composite ?? 0,
    nationalRank: p.natlRank ?? null,
    positionRank: p.posRank ?? null,
    stateRank: p.stateRank ?? null,
    rating: p.composite ?? null,
    natlRank: p.natlRank ?? null,
    posRank: p.posRank ?? null,
    movementDelta: p.trendDelta7d ?? 0,
    delta7d: p.trendDelta7d ?? 0,
    insiderNotes: null,
    notePreview: null,
    skinny: null,
    visitHistory: [],
    ufOvStatus: null,
    visitStart: null,
    visitEnd: null,
    ufConfidence: p.ufConfidence ?? null,
    fitScore: p.fitScore ?? null,
    volatility7d: p.volatility7d ?? 0,
    predictors: [],
    competingSchools: p.competingSchools ?? [],
  };
}

async function buildFutureCastClassPayload() {
  const store = require('./recruiting-store');
  const board = await store.getBoard(FUTURECAST_CLASS_YEAR);
  const allRankings = await store.getRankings();
  const rankings = (allRankings || []).find((r) => r.classYear === FUTURECAST_CLASS_YEAR);
  const commits = board.commits || [];
  const inStateCount = commits.filter((c) => c.inState).length;
  const blueChips = commits.filter((c) => (Number(c.stars) || 0) >= 4).length;
  const classImpactScore =
    rankings?.classScore != null ? Math.round(Number(rankings.classScore) * 100) / 100 : null;
  const ratings = commits
    .map((c) => Number(c.rating))
    .filter((n) => Number.isFinite(n) && n > 0);
  const teamImpactScore = ratings.length
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
    : null;

  return {
    classYear: FUTURECAST_CLASS_YEAR,
    commitCount: commits.length,
    targetCount: (board.targets || []).length,
    blueChips,
    inStatePct: commits.length ? Math.round((inStateCount / commits.length) * 100) : 0,
    rankings: rankings
      ? {
          nationalRank: rankings.nationalRank ?? null,
          secRank: rankings.secRank ?? null,
          classScore: rankings.classScore ?? null,
          source: rankings.source ?? null,
          updatedAt: rankings.updatedAt ?? null,
        }
      : null,
    classImpactScore,
    teamImpactScore,
  };
}

async function buildFutureCastHomePayload() {
  const players = await loadOfflineBoardPlayers();
  const activePredictions = players.filter((p) => !p.ufPredictionSuppressed);
  const heatmap = buildHeatmap(activePredictions);
  const commits = players.filter((p) => isFloridaSchool(p.committedTo)).map(boardPlayerToFeedRow);
  const targets = activePredictions
    .filter(isActiveUfTarget)
    .map(boardPlayerToFeedRow)
    .sort((a, b) => (b.ufProbability ?? 0) - (a.ufProbability ?? 0));
  const trendingUp = activePredictions
    .filter((p) => (p.trendDelta7d ?? 0) > 0 && isActiveUfTarget(p))
    .map(boardPlayerToFeedRow)
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
  const trendingDown = activePredictions
    .filter((p) => (p.trendDelta7d ?? 0) < 0 && isActiveUfTarget(p))
    .map(boardPlayerToFeedRow)
    .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0));

  return {
    classYear: FUTURECAST_CLASS_YEAR,
    commitSort: 'fit',
    heatmap: {
      buckets: [
        { label: 'Up', count: heatmap.upCount },
        { label: 'Down', count: heatmap.downCount },
        { label: 'Flat', count: heatmap.flatCount },
      ],
      windowDays: heatmap.windowDays,
    },
    commits,
    commitTotal: commits.length,
    topTargets: targets.slice(0, 12),
    trendingUp: trendingUp.slice(0, 12),
    trendingDown: trendingDown.slice(0, 12),
    portalWatchlist: [],
  };
}

async function buildMasterBoardPayload(players) {
  const activePredictions = players.filter((p) => !p.ufPredictionSuppressed);
  const heatmap = buildHeatmap(activePredictions);
  const trendingUp = [...activePredictions]
    .filter((p) => (p.trendDelta7d ?? 0) > 0)
    .sort((a, b) => (b.trendDelta7d ?? 0) - (a.trendDelta7d ?? 0));
  const trendingDown = [...activePredictions]
    .filter((p) => (p.trendDelta7d ?? 0) < 0)
    .sort((a, b) => (a.trendDelta7d ?? 0) - (b.trendDelta7d ?? 0));
  const activeTargets = activePredictions.filter(isActiveUfTarget);
  const highPriority = [...activePredictions]
    .filter((p) => p.priority === 'high' && isActiveUfTarget(p))
    .sort((a, b) => (b.ufConfidence ?? 0) - (a.ufConfidence ?? 0));

  return {
    classYear: FUTURECAST_CLASS_YEAR,
    updatedAt: new Date().toISOString(),
    movementHeatmap: {
      upCount: heatmap.upCount,
      downCount: heatmap.downCount,
      flatCount: heatmap.flatCount,
    },
    heatmap: {
      buckets: [
        { label: 'Up', count: heatmap.upCount },
        { label: 'Down', count: heatmap.downCount },
        { label: 'Flat', count: heatmap.flatCount },
      ],
      windowDays: heatmap.windowDays,
    },
    ufConfidenceAverage:
      activePredictions.length > 0
        ? Math.round(
            (activePredictions.reduce((sum, p) => sum + (p.ufConfidence ?? 0), 0) /
              activePredictions.length) *
              10
          ) / 10
        : 0,
    confidenceSparkline: activePredictions.slice(0, 12).map((p) => p.ufConfidence ?? 0),
    commitWatch: [],
    highPriority: {
      playerIds: highPriority.map((p) => p.id),
      players: highPriority.slice(0, 10),
    },
    movementSummary: {
      risers: trendingUp.slice(0, 8).map((p) => p.id),
      fallers: trendingDown.slice(0, 8).map((p) => p.id),
      highVolatility: [],
      riserPlayers: trendingUp.slice(0, 8),
      fallerPlayers: trendingDown.slice(0, 8),
      volatilePlayers: [],
    },
    players,
  };
}

async function buildMovementIntelPayload(players) {
  const activeTargets = players.filter(isActiveUfTarget);
  const heatmap = buildHeatmap(activeTargets);
  const risers = activeTargets
    .filter((p) => (p.trendDelta7d ?? 0) > 0)
    .sort((a, b) => (b.trendDelta7d ?? 0) - (a.trendDelta7d ?? 0));
  const fallers = activeTargets
    .filter((p) => (p.trendDelta7d ?? 0) < 0)
    .sort((a, b) => (a.trendDelta7d ?? 0) - (b.trendDelta7d ?? 0));

  return {
    classYear: FUTURECAST_CLASS_YEAR,
    updatedAt: new Date().toISOString(),
    movementHeatmap: {
      upCount: heatmap.upCount,
      downCount: heatmap.downCount,
      flatCount: heatmap.flatCount,
    },
    heatmap: {
      buckets: [
        { label: 'Up', count: heatmap.upCount },
        { label: 'Down', count: heatmap.downCount },
        { label: 'Flat', count: heatmap.flatCount },
      ],
      windowDays: heatmap.windowDays,
    },
    risers,
    fallers,
    highVolatility: [],
    stable: [],
    fitScoreLeaders: [...activeTargets].sort((a, b) => (b.fitScore ?? -1) - (a.fitScore ?? -1)),
    fitScoreRisks: [...activeTargets].sort((a, b) => (a.fitScore ?? 999) - (b.fitScore ?? 999)),
    alerts: [],
  };
}

async function buildPredictionsPayload(players, limit) {
  const predictions = players
    .filter(isActiveUfTarget)
    .map(boardPlayerToFeedRow)
    .sort((a, b) => (b.ufProbability ?? 0) - (a.ufProbability ?? 0))
    .slice(0, limit);

  return {
    classYear: FUTURECAST_CLASS_YEAR,
    predictions,
    predictors: [],
    windowDays: 7,
  };
}

async function buildStockPayload(players) {
  const active = players.filter(isActiveUfTarget);
  const stockUp = active
    .filter((p) => (p.trendDelta7d ?? 0) > 0)
    .map(boardPlayerToFeedRow)
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
  const stockDown = active
    .filter((p) => (p.trendDelta7d ?? 0) < 0)
    .map(boardPlayerToFeedRow)
    .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0));

  return { stockUp, stockDown, windowDays: 7 };
}

async function buildSnapshotsPayload(stock) {
  return {
    dailyUp: stock.stockUp.slice(0, 8),
    dailyDown: stock.stockDown.slice(0, 8),
    weeklyUp: stock.stockUp.slice(0, 12),
    weeklyDown: stock.stockDown.slice(0, 12),
    dailyWindowDays: 1,
    weeklyWindowDays: 7,
  };
}

async function buildHighPriorityPayload(players) {
  const master = await buildMasterBoardPayload(players);
  const rows = (master.highPriority?.players ?? []).map(boardPlayerToHighPriority);
  return {
    classYear: FUTURECAST_CLASS_YEAR,
    count: rows.length,
    updatedAt: new Date().toISOString(),
    players: rows,
  };
}

async function buildTargetsPayload(players) {
  const targets = players
    .filter(isActiveUfTarget)
    .map(boardPlayerToHighPriority);
  return {
    class_year: FUTURECAST_CLASS_YEAR,
    count: targets.length,
    targets,
    players: targets,
  };
}

async function buildStaffDashboardPayload(intel) {
  return {
    topRisers: (intel.risers ?? []).slice(0, 10).map(boardPlayerToStaffRow),
    topFallers: (intel.fallers ?? []).slice(0, 10).map(boardPlayerToStaffRow),
    highVolatility: (intel.highVolatility ?? []).slice(0, 10).map(boardPlayerToStaffRow),
    lowVolatility: (intel.stable ?? []).slice(0, 10).map(boardPlayerToStaffRow),
    fitLeaders: (intel.fitScoreLeaders ?? []).slice(0, 10).map(boardPlayerToStaffRow),
    fitRisks: (intel.fitScoreRisks ?? []).slice(0, 10).map(boardPlayerToStaffRow),
    heatmap: intel.heatmap ?? { buckets: [], windowDays: 7 },
    alerts: intel.alerts ?? [],
    movementWindowDays: intel.heatmap?.windowDays ?? 7,
    volatilityWindowDays: 7,
    lastUpdated: intel.updatedAt ?? new Date().toISOString(),
  };
}

async function buildAllFuturecastSnapshotPayloads() {
  const players = await loadOfflineBoardPlayers();
  const [home, classData, stock, movementIntel, masterBoard] = await Promise.all([
    buildFutureCastHomePayload(),
    buildFutureCastClassPayload(),
    buildStockPayload(players),
    buildMovementIntelPayload(players),
    buildMasterBoardPayload(players),
  ]);

  const trendingUp = [...players]
    .filter((p) => (p.trendDelta7d ?? 0) > 0)
    .sort((a, b) => (b.trendDelta7d ?? 0) - (a.trendDelta7d ?? 0));
  const trendingDown = [...players]
    .filter((p) => (p.trendDelta7d ?? 0) < 0)
    .sort((a, b) => (a.trendDelta7d ?? 0) - (b.trendDelta7d ?? 0));

  const [predictions6, predictions24, highPriority, snapshots, targets, staffDashboard] =
    await Promise.all([
      buildPredictionsPayload(players, 6),
      buildPredictionsPayload(players, 24),
      buildHighPriorityPayload(players),
      buildSnapshotsPayload(stock),
      buildTargetsPayload(players),
      buildStaffDashboardPayload(movementIntel),
    ]);

  return {
    'futurecast/home.json': home,
    'futurecast/class-2027.json': classData,
    'futurecast/predictions-2027-limit6.json': predictions6,
    'futurecast/predictions-2027-limit24.json': predictions24,
    'futurecast/master-board.json': masterBoard,
    'futurecast/trending.json': {
      classYear: FUTURECAST_CLASS_YEAR,
      updatedAt: new Date().toISOString(),
      trendingUp,
      trendingDown,
    },
    'futurecast/movement-intel.json': movementIntel,
    'futurecast/high-priority-2027.json': highPriority,
    'futurecast/stock.json': stock,
    'futurecast/snapshots.json': snapshots,
    'futurecast/targets-2027.json': targets,
    'home/staff-dashboard.json': staffDashboard,
  };
}

module.exports = {
  buildAllFuturecastSnapshotPayloads,
  buildStaffDashboardPayload,
  buildFutureCastHomePayload,
  loadOfflineBoardPlayers,
};
