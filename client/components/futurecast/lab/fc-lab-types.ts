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
  predictors: Array<{ name: string; score: number }>;
};

export function futureCastPlayerToLabTarget(p: FutureCastPlayer): FcLabTarget {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    position: p.position,
    school: p.school ?? null,
    classYear: p.classYear,
    ufProbability: p.ufConfidence,
    delta7d: p.trendDelta7d,
    fitScore: p.fitScore,
    modelPct: p.ufConfidence,
    stars: p.stars ?? null,
    predictors: [],
  };
}

export function ufPctFromFc(raw: number | null | undefined): number {
  if (raw == null) return 0;
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
}
