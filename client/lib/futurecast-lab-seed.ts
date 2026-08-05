import seedJson from './futurecast-lab-seed.json';
import type { FutureCastLabDataMap } from './futurecast-lab-data';
import type { HighPriorityPlayer } from './futurecast-high-priority-api';

export type FutureCastLabSeed = FutureCastLabDataMap & {
  generatedAt: string;
  source: string;
};

export const FUTURECAST_LAB_SEED = seedJson as unknown as FutureCastLabSeed;

/**
 * Seed HP rows historically stored ufConfidence (allowlist-board shape).
 * Lab hero + hasUsableUfProbability require ufProbability — normalize both ways.
 */
export function normalizeSeedHighPriorityPlayer(
  raw: Record<string, unknown> | HighPriorityPlayer
): HighPriorityPlayer {
  const p = raw as Record<string, unknown>;
  const ufRaw = p.ufProbability ?? p.ufConfidence;
  const uf =
    ufRaw != null && Number.isFinite(Number(ufRaw)) && Number(ufRaw) > 0
      ? Math.round(Number(ufRaw))
      : null;
  const deltaRaw = p.delta7d ?? p.movementDelta ?? p.trendDelta7d;
  const delta =
    deltaRaw != null && Number.isFinite(Number(deltaRaw)) ? Number(deltaRaw) : 0;
  return {
    ...(p as unknown as HighPriorityPlayer),
    ufProbability: uf ?? 0,
    ufProbabilityLabel:
      (p.ufProbabilityLabel as string | null | undefined) ?? (uf != null ? 'GV' : null),
    ufProbabilityLowConfidence: Boolean(p.ufProbabilityLowConfidence),
    ufRpmPct:
      p.ufRpmPct != null && Number(p.ufRpmPct) > 0 ? Math.round(Number(p.ufRpmPct)) : null,
    priorityScore:
      p.priorityScore != null && Number.isFinite(Number(p.priorityScore))
        ? Number(p.priorityScore)
        : p.hotScore != null && Number.isFinite(Number(p.hotScore))
          ? Number(p.hotScore)
          : 0,
    delta7d: delta,
    movementDelta: delta,
    fitScore: p.fitScore != null ? Number(p.fitScore) : 0,
    staffConfidence: p.staffConfidence != null ? Number(p.staffConfidence) : 0,
    compositeScore: Number(p.compositeScore ?? p.composite ?? 0),
    nationalRank: (p.nationalRank ?? p.natlRank ?? null) as number | null,
    positionRank: (p.positionRank ?? p.posRank ?? null) as number | null,
    stateRank: (p.stateRank as number | null) ?? null,
    rating: (p.rating ?? p.composite ?? null) as number | null,
    natlRank: (p.natlRank ?? p.nationalRank ?? null) as number | null,
    posRank: (p.posRank ?? p.positionRank ?? null) as number | null,
    stars: p.stars != null ? Number(p.stars) : null,
    headliner: Boolean(p.headliner),
    committedTo: (p.committedTo as string | null) ?? null,
    htWt: (p.htWt as string | null) ?? null,
    school: (p.school as string | null) ?? null,
    insiderNotes: (p.insiderNotes as string | null) ?? null,
    notePreview: (p.notePreview as string | null) ?? null,
    skinny: (p.skinny as string | null) ?? null,
    visitHistory: Array.isArray(p.visitHistory) ? (p.visitHistory as HighPriorityPlayer['visitHistory']) : [],
    ufOvStatus: (p.ufOvStatus as string | null) ?? null,
    visitStart: (p.visitStart as string | null) ?? null,
    visitEnd: (p.visitEnd as string | null) ?? null,
    trendHistory: Array.isArray(p.trendHistory)
      ? (p.trendHistory as HighPriorityPlayer['trendHistory'])
      : [],
    predictors: Array.isArray(p.predictors)
      ? (p.predictors as HighPriorityPlayer['predictors'])
      : [],
  };
}

/** Static first-paint FutureCast Lab map — replaced by live refresh after hydrate. */
export function buildSeedFutureCastLabData(): FutureCastLabDataMap {
  const { generatedAt: _generatedAt, source: _source, ...lab } = FUTURECAST_LAB_SEED;
  const highPriority = (lab.highPriority || []).map((p) =>
    normalizeSeedHighPriorityPlayer(p as unknown as Record<string, unknown>)
  );
  const highPriorityClosing = (lab.highPriorityClosing || []).map((p) =>
    normalizeSeedHighPriorityPlayer(p as unknown as Record<string, unknown>)
  );
  const hpWithOdds = highPriority.filter(
    (p) => p.ufProbability != null && Number.isFinite(Number(p.ufProbability)) && Number(p.ufProbability) > 0
  );
  const avgUFProbability = hpWithOdds.length
    ? Math.round(
        hpWithOdds.reduce((acc, p) => acc + Number(p.ufProbability), 0) / hpWithOdds.length
      )
    : Math.round(lab.metrics?.avgUFProbability || lab.masterBoard?.ufConfidenceAverage || 0);

  return {
    ...lab,
    highPriority,
    highPriorityClosing,
    metrics: {
      ...lab.metrics,
      avgUFProbability,
      highPriorityCount: highPriority.length || lab.metrics?.highPriorityCount || 0,
    },
  };
}
