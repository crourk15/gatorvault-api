import type { FutureCastPlayer } from '@/lib/futurecast-board-types';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import type { UnderclassmenPlayer } from '@/lib/futurecast-underclassmen-api';

/** Normalized target row for FutureCast Lab UI modules. */
export type FcLabTarget = {
  id: string;
  slug: string;
  name: string;
  position: string;
  school: string | null;
  classYear: number;
  ufProbability: number | null;
  ufProbabilityLabel?: string | null;
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
    delta7d: p.trendDelta7d,
    fitScore: p.fitScore,
    modelPct: ufConfidence,
    stars: p.stars ?? null,
    committedTo: committed,
    predictors: (p.predictors ?? []).map((x) => ({ name: x.name, score: x.score })),
    competingSchools: (p.competingSchools ?? []).map((x) => ({ name: x.name, pct: x.pct })),
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
