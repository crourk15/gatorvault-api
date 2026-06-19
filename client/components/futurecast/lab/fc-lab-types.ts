import type { FutureCastPlayer } from '@/lib/futurecast-board-types';

/** Normalized target row for FutureCast Lab UI modules. */
export type FcLabTarget = {
  id: string;
  slug: string;
  name: string;
  position: string;
  school: string | null;
  classYear: number;
  ufProbability: number;
  delta7d: number;
  fitScore: number;
  modelPct: number;
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
