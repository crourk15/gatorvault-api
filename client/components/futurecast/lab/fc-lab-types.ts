import type { FutureCastPlayer } from '@/lib/futurecast-board-types';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import type { UnderclassmenPlayer } from '@/lib/futurecast-underclassmen-api';
import type { FutureCastHeroMetrics, FutureCastPageSummary } from '@/lib/api/futurecast';
import {
  getPortalSeasonState,
  primaryRecruitingClassYear,
  shouldShowPortalWatchlist,
} from '@/lib/recruiting-cycle';

/** Normalized target row for FutureCast Lab UI modules. */
export type FcLabTarget = {
  id: string;
  slug: string;
  name: string;
  position: string;
  school: string | null;
  classYear: number;
  /** GatorVault multi-signal likelihood — used for Lab buckets + primary bar. */
  ufProbability: number | null;
  ufProbabilityLabel?: string | null;
  /** Confirmed On3 UF RPM — market layer for competitor board. */
  ufRpmPct?: number | null;
  delta7d: number | null;
  fitScore: number | null;
  modelPct: number | null;
  stars: number | null;
  committedTo?: string | null;
  predictors: Array<{ name: string; score: number }>;
  competingSchools?: Array<{ name: string; pct: number }>;
};

function isFloridaCommit(value: string | null | undefined): boolean {
  if (!value) return false;
  return /\bflorida\b|\bgators\b/i.test(String(value));
}

export function futureCastPlayerToLabTarget(p: FutureCastPlayer): FcLabTarget {
  const committed = p.committedTo ?? null;
  const ufConfidence = isFloridaCommit(committed) ? 100 : p.ufConfidence;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    position: p.position,
    school: p.school ?? null,
    classYear: p.classYear,
    ufProbability: ufConfidence,
    ufProbabilityLabel: p.ufProbabilityLabel ?? null,
    ufRpmPct: (p as { ufRpmPct?: number | null }).ufRpmPct ?? null,
    delta7d: p.trendDelta7d,
    fitScore: p.fitScore,
    // Board rows have no separate staff meter — don't duplicate Florida odds as "Model".
    modelPct: null,
    stars: p.stars ?? null,
    committedTo: committed,
    predictors: (p.predictors ?? []).map((x) => ({ name: x.name, score: x.score })),
    competingSchools: (p.competingSchools ?? []).map((x) => ({ name: x.name, pct: x.pct })),
  };
}

export function highPriorityToLabTarget(p: HighPriorityPlayer): FcLabTarget {
  const committed = p.committedTo ?? null;
  // Primary Lab number = GatorVault likelihood (never force On3 RPM over GV).
  const uf = isFloridaCommit(committed) ? 100 : p.ufProbability;
  const rpm =
    p.ufRpmPct != null && Number(p.ufRpmPct) > 0 ? Math.round(Number(p.ufRpmPct)) : null;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    position: p.position,
    school: p.school ?? null,
    classYear: p.classYear ?? primaryRecruitingClassYear(),
    ufProbability: uf,
    ufProbabilityLabel: p.ufProbabilityLabel ?? 'GV',
    ufRpmPct: rpm,
    delta7d: p.delta7d ?? p.movementDelta ?? null,
    fitScore: p.fitScore ?? null,
    // Staff/model meter only when we have a real reading — never surface stored 0 as a score.
    modelPct:
      p.staffConfidence != null && Number(p.staffConfidence) > 0
        ? Number(p.staffConfidence)
        : null,
    stars: p.stars ?? null,
    committedTo: committed,
    predictors: (p.predictors ?? []).map((x) => ({ name: x.name, score: x.score })),
    competingSchools: (p.competingSchools ?? [])
      .filter((x) => x?.name && Number(x.pct) > 0)
      .map((x) => ({ name: x.name, pct: Number(x.pct) })),
  };
}

export function ufPctFromFc(raw: number | null | undefined): number {
  if (raw == null) return 0;
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
}

/** UF probability in the contested battle band (34–66%). */
export function isBattleTarget(ufPct: number): boolean {
  return ufPct >= 34 && ufPct < 67;
}

export function isDiscoverySeasonFocus(at: Date = new Date()): boolean {
  return !shouldShowPortalWatchlist(getPortalSeasonState(at));
}

export function overlayDiscoverySeasonLabState(
  summary: FutureCastPageSummary,
  metrics: FutureCastHeroMetrics,
  highPriority: HighPriorityPlayer[]
): { summary: FutureCastPageSummary; metrics: FutureCastHeroMetrics } {
  if (!isDiscoverySeasonFocus()) {
    return { summary, metrics };
  }
  const focusYear = primaryRecruitingClassYear();
  const count = highPriority.length;
  const avgUf = count
    ? Math.round(
        highPriority.reduce((acc, p) => acc + ufPctFromFc(p.ufProbability), 0) / count
      )
    : metrics.avgUFProbability;
  return {
    summary: {
      ...summary,
      classYear: focusYear,
      targetCount: count,
      commitCount: 0,
    },
    metrics: {
      ...metrics,
      highPriorityCount: count,
      activePredictions: count,
      avgUFProbability: avgUf,
      visitIntelCount: 0,
      visitRecapCount: 0,
      flipWatchCount: 0,
      movementNarrativesCount: 0,
    },
  };
}

export function underclassmenTargetsForYear(
  players: UnderclassmenPlayer[],
  classYear: number
): UnderclassmenPlayer[] {
  return players.filter((p) => Number(p.classYear) === classYear && p.tier === 'target');
}

/** Map underclassmen board row → high-priority shape for lab fit/SCI panels. */
export function underclassmenToFitLeader(p: UnderclassmenPlayer): HighPriorityPlayer {
  const uf = ufPctFromFc(p.ufConfidence);
  const delta = p.trendDelta7d ?? 0;
  const fit = p.fitScore ?? 0;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    classYear: p.classYear,
    position: p.position,
    school: p.school ?? null,
    htWt: null,
    stars: p.stars ?? null,
    headliner: false,
    committedTo: p.committedTo ?? null,
    compositeScore: p.composite ?? 0,
    nationalRank: p.natlRank ?? null,
    positionRank: p.posRank ?? null,
    stateRank: p.stateRank ?? null,
    rating: p.composite ?? null,
    natlRank: p.natlRank ?? null,
    posRank: p.posRank ?? null,
    movementDelta: delta,
    delta7d: delta,
    fitScore: fit,
    staffConfidence: fit,
    priorityScore: uf,
    ufProbability: uf,
    ufProbabilityLabel: p.ufProbabilityLabel ?? null,
    ufProbabilityLowConfidence: p.ufProbabilityLowConfidence ?? false,
    insiderNotes: null,
    notePreview: null,
    skinny: null,
    visitHistory: [],
    ufOvStatus: null,
    visitStart: null,
    visitEnd: null,
    trendHistory: [],
    predictors: (p.predictors ?? []).map((x) => ({ name: x.name, score: x.score })),
  };
}

export function highPriorityToBoardPlayer(p: HighPriorityPlayer): FutureCastPlayer {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    classYear: p.classYear ?? primaryRecruitingClassYear(),
    position: p.position,
    school: p.school,
    composite: p.compositeScore ?? 0,
    stars: p.stars ?? 0,
    ufConfidence: p.ufProbability,
    ufProbabilityLabel: p.ufProbabilityLabel ?? null,
    ufProbabilityLowConfidence: p.ufProbabilityLowConfidence ?? false,
    fitScore: p.fitScore ?? null,
    trendDelta7d: p.delta7d ?? p.movementDelta ?? null,
    volatility7d: Math.abs(p.delta7d ?? p.movementDelta ?? 0),
    priority: 'high',
    committedTo: p.committedTo,
  };
}

export type DiscoveryVolatilityMetrics = {
  score: number;
  hotPositions: string;
  positionHeatmap: Array<{ position: string; count: number; intensity: number }>;
};

/** Volatility + position heat when 7d UF deltas are flat during early discovery. */
export function computeDiscoveryVolatilityMetrics(
  players: HighPriorityPlayer[]
): DiscoveryVolatilityMetrics {
  if (!players.length) {
    return { score: 0, hotPositions: '—', positionHeatmap: [] };
  }

  const avgDelta =
    players.reduce((acc, p) => acc + Math.abs(p.delta7d ?? p.movementDelta ?? 0), 0) / players.length;

  const byPos = new Map<string, { count: number; vol: number; battles: number }>();
  const ufPcts: number[] = [];

  for (const p of players) {
    const uf = ufPctFromFc(p.ufProbability);
    ufPcts.push(uf);
    const delta = Math.abs(p.delta7d ?? p.movementDelta ?? 0);
    const pos = p.position || '—';
    const cur = byPos.get(pos) ?? { count: 0, vol: 0, battles: 0 };
    cur.count += 1;
    cur.vol += delta > 0 ? delta : (p.fitScore ?? 50) / 10;
    if (isBattleTarget(uf)) cur.battles += 1;
    byPos.set(pos, cur);
  }

  let score: number;
  if (avgDelta > 0) {
    score = Math.min(100, Math.round(avgDelta * 4));
  } else {
    const mean = ufPcts.reduce((a, b) => a + b, 0) / ufPcts.length;
    const ufSpread = Math.sqrt(
      ufPcts.reduce((acc, v) => acc + (v - mean) ** 2, 0) / ufPcts.length
    );
    const battleTotal = [...byPos.values()].reduce((acc, c) => acc + c.battles, 0);
    score = Math.min(100, Math.round(battleTotal * 5 + ufSpread * 0.75));
  }

  const positionHeatmap = [...byPos.entries()]
    .map(([position, { count, vol, battles }]) => ({
      position,
      count,
      intensity:
        avgDelta > 0 ? (count > 0 ? vol / count : 0) : battles * 10 + vol / Math.max(1, count),
    }))
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 6);

  const hotPositions = positionHeatmap
    .slice(0, 2)
    .map((c) => c.position)
    .filter((pos) => pos && pos !== '—')
    .join(', ');

  return {
    score,
    hotPositions: hotPositions || '—',
    positionHeatmap,
  };
}

export type DiscoveryMovementBuckets = {
  risers: FutureCastPlayer[];
  fallers: FutureCastPlayer[];
  highVolatility: FutureCastPlayer[];
  /** False when board-wide deltas look like synchronized filler (e.g. everyone +4). */
  believable: boolean;
};

function rowDelta(p: {
  delta7d?: number | null;
  movementDelta?: number | null;
  trendDelta7d?: number | null;
}): number {
  return Math.round(Number(p.delta7d ?? p.movementDelta ?? p.trendDelta7d) || 0);
}

/**
 * True only when weekly deltas look varied enough to show fans.
 * Uniform bumps (everyone +4 / +6 from bulk backfill) are treated as not ready.
 */
export function movementDeltasAreBelievable(
  players: Array<{
    delta7d?: number | null;
    movementDelta?: number | null;
    trendDelta7d?: number | null;
  }>
): boolean {
  const nonzero = players.map(rowDelta).filter((d) => d !== 0);
  if (nonzero.length < 3) return nonzero.length > 0;

  const byVal = new Map<number, number>();
  for (const d of nonzero) byVal.set(d, (byVal.get(d) || 0) + 1);
  const topShare = Math.max(...byVal.values()) / nonzero.length;
  if (topShare >= 0.7) return false;

  const absVals = nonzero.map((d) => Math.abs(d));
  if (new Set(absVals).size === 1) return false;

  return true;
}

/** Discovery-season movement buckets from 2028 underclassmen targets or high-priority fallback. */
export function discoveryMovementBuckets(
  underclassmen: UnderclassmenPlayer[],
  highPriority: HighPriorityPlayer[]
): DiscoveryMovementBuckets {
  const focusYear = primaryRecruitingClassYear();
  const targets = underclassmenTargetsForYear(underclassmen, focusYear);
  const pool: FutureCastPlayer[] = targets.length
    ? targets
    : highPriority.map(highPriorityToBoardPlayer);

  const believable = movementDeltasAreBelievable(pool);
  if (!believable) {
    return { risers: [], fallers: [], highVolatility: [], believable: false };
  }

  const risers = pool
    .filter((p) => (p.trendDelta7d ?? 0) > 0)
    .sort((a, b) => (b.trendDelta7d ?? 0) - (a.trendDelta7d ?? 0));
  const fallers = pool
    .filter((p) => (p.trendDelta7d ?? 0) < 0)
    .sort((a, b) => (a.trendDelta7d ?? 0) - (b.trendDelta7d ?? 0));
  const highVolatility = [...pool]
    .sort(
      (a, b) =>
        (b.volatility7d ?? Math.abs(b.trendDelta7d ?? 0)) -
        (a.volatility7d ?? Math.abs(a.trendDelta7d ?? 0))
    )
    .filter((p) => (p.volatility7d ?? 0) > 0 || Math.abs(p.trendDelta7d ?? 0) > 0);

  return {
    risers: risers.slice(0, 8),
    fallers: fallers.slice(0, 8),
    highVolatility: highVolatility.slice(0, 8),
    believable: true,
  };
}
