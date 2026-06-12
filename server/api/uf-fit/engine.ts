/**
 * UF Fit Intelligence Engine — composite score, tier, delta, volatility, history.
 * @see FutureCast Phase 7 spec
 */
import type { SignalType } from '../../shared/enums';
import { SIGNAL_TYPE_WEIGHTS } from '../big-board/utils';
import type { UfFitSignalDetail } from '../../models/uf-fit-intel-types';

export type { UfFitSignalDetail };

export interface UfFitIntelInput {
  id: string;
  uf_fit_score_stored: number | null;
  scheme_score: number | null;
  character_score: number | null;
  athletic_score: number | null;
  timeline_score: number | null;
  uf_status: string | null;
  evaluation_notes: string | null;
  score_computed_at: string | null;
  metadata: Record<string, unknown>;
  signals: UfFitSignalDetail[];
}

export interface UfFitComponents {
  schemeFit: number;
  cultureFit: number;
  positionalNeed: number;
  staffInterest: number;
}

export interface UfFitHistoryPoint {
  date: string;
  score: number;
}

export type FitTier = 'elite' | 'strong' | 'moderate' | 'low';

export const UF_FIT_TIER_THRESHOLDS = {
  elite: 85,
  strong: 70,
  moderate: 50,
} as const;

export const UF_STATUS_INTEREST: Record<string, number> = {
  TARGET: 5,
  PRIORITY: 8,
  EVAL: 3,
  COMMITTED: 10,
  NOT_INTERESTED: 0,
};

const COMPONENT_MAX = {
  scheme: 40,
  culture: 30,
  positionalNeed: 20,
  staffInterest: 10,
} as const;

const UF_FIT_SIGNAL_TYPES: SignalType[] = [
  'EVALUATION_NOTE',
  'STAFF_FLAG',
  'OFFER',
  'CAMP_PERFORMANCE',
  'RANKING_JUMP',
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp100(value: number): number {
  return clamp(Math.round(value), 0, 100);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Component breakdown (scheme 0–40, culture 0–30, need 0–20, staff 0–10). */
export function computeUfFitComponents(input: UfFitIntelInput): UfFitComponents {
  const schemeFit = ((input.scheme_score ?? 0) / 100) * COMPONENT_MAX.scheme;
  const cultureFit = ((input.character_score ?? 0) / 100) * COMPONENT_MAX.culture;
  const positionalNeed =
    ((input.athletic_score ?? input.timeline_score ?? 0) / 100) * COMPONENT_MAX.positionalNeed;
  const staffInterest =
    ((UF_STATUS_INTEREST[input.uf_status ?? ''] ?? 0) / 10) * COMPONENT_MAX.staffInterest;

  return {
    schemeFit: round1(schemeFit),
    cultureFit: round1(cultureFit),
    positionalNeed: round1(positionalNeed),
    staffInterest: round1(staffInterest),
  };
}

/** UF Fit Score (0–100) = sum of components, clamped. */
export function computeUfFitScore(input: UfFitIntelInput): number {
  const c = computeUfFitComponents(input);
  const total = c.schemeFit + c.cultureFit + c.positionalNeed + c.staffInterest;
  if (total <= 0 && input.uf_fit_score_stored != null) {
    return clamp100(input.uf_fit_score_stored);
  }
  return clamp100(total);
}

/** Fit tier — Elite ≥85, Strong 70–84, Moderate 50–69, Low <50. */
export function computeFitTier(score: number): FitTier {
  if (score >= UF_FIT_TIER_THRESHOLDS.elite) return 'elite';
  if (score >= UF_FIT_TIER_THRESHOLDS.strong) return 'strong';
  if (score >= UF_FIT_TIER_THRESHOLDS.moderate) return 'moderate';
  return 'low';
}

function evaluationVolatilityBoost(notes: string | null): number {
  if (!notes) return 0;
  const len = notes.length;
  if (len > 200) return 8;
  if (len > 80) return 4;
  return 0;
}

/** Build score history from signals + score_computed_at anchor. */
export function buildUfFitHistory(input: UfFitIntelInput, currentScore: number): UfFitHistoryPoint[] {
  const metaHistory = input.metadata?.uf_fit_history ?? input.metadata?.fitHistory;
  if (Array.isArray(metaHistory) && metaHistory.length) {
    return metaHistory
      .map((p) => {
        const row = p as Record<string, unknown>;
        return {
          date: String(row.date ?? row.created_at ?? '').slice(0, 10),
          score: clamp100(Number(row.score ?? row.uf_fit_score ?? 0)),
        };
      })
      .filter((p) => p.date)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  const ufSignals = input.signals
    .filter((s) => UF_FIT_SIGNAL_TYPES.includes(s.signal_type))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (!ufSignals.length && !input.score_computed_at) {
    const today = new Date().toISOString().slice(0, 10);
    return [{ date: today, score: currentScore }];
  }

  const points: UfFitHistoryPoint[] = [];
  let running = Math.max(30, Math.round(currentScore * 0.55));

  for (const sig of ufSignals) {
    const weight = SIGNAL_TYPE_WEIGHTS[sig.signal_type] ?? 5;
    running = clamp100(running + Math.round(weight * 0.35));
    points.push({
      date: sig.created_at.slice(0, 10),
      score: running,
    });
  }

  if (input.score_computed_at) {
    points.push({
      date: input.score_computed_at.slice(0, 10),
      score: currentScore,
    });
  } else if (points.length) {
    points[points.length - 1] = {
      date: points[points.length - 1].date,
      score: currentScore,
    };
  } else {
    points.push({ date: new Date().toISOString().slice(0, 10), score: currentScore });
  }

  const deduped = new Map<string, number>();
  for (const p of points) {
    deduped.set(p.date, p.score);
  }
  return [...deduped.entries()]
    .map(([date, score]) => ({ date, score }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function averageScoreInWindow(history: UfFitHistoryPoint[], days: number): number | null {
  if (!history.length) return null;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const inWindow = history.filter((p) => new Date(p.date).getTime() >= cutoff);
  const pool = inWindow.length ? inWindow : history;
  const sum = pool.reduce((acc, p) => acc + p.score, 0);
  return sum / pool.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** fitDelta = current − 30-day average. */
export function computeFitDelta(currentScore: number, history: UfFitHistoryPoint[]): number {
  const avg = averageScoreInWindow(history, 30);
  if (avg == null) return 0;
  return Math.round(currentScore - avg);
}

/** fitVolatility = stdev of last N scores, normalized 0–100. */
export function computeFitVolatility(
  history: UfFitHistoryPoint[],
  evaluationNotes: string | null,
  n = 10
): number {
  const scores = history.slice(-n).map((p) => p.score);
  if (scores.length < 2) {
    return clamp100(evaluationVolatilityBoost(evaluationNotes));
  }
  const sd = stdDev(scores);
  const normalized = clamp100(sd * 2.5 + evaluationVolatilityBoost(evaluationNotes));
  return normalized;
}

export interface UfFitIntelResult {
  ufFitScore: number;
  fitTier: FitTier;
  schemeFit: number;
  cultureFit: number;
  positionalNeed: number;
  staffInterest: number;
  fitDelta: number;
  fitVolatility: number;
  history: UfFitHistoryPoint[];
}

export function computeUfFitIntel(input: UfFitIntelInput): UfFitIntelResult {
  const components = computeUfFitComponents(input);
  const ufFitScore = computeUfFitScore(input);
  const history = buildUfFitHistory(input, ufFitScore);
  return {
    ufFitScore,
    fitTier: computeFitTier(ufFitScore),
    schemeFit: components.schemeFit,
    cultureFit: components.cultureFit,
    positionalNeed: components.positionalNeed,
    staffInterest: components.staffInterest,
    fitDelta: computeFitDelta(ufFitScore, history),
    fitVolatility: computeFitVolatility(history, input.evaluation_notes),
    history,
  };
}

/** Map Big Board row to minimal UF Fit input. */
export function ufFitIntelFromBigBoardRow(
  row: {
    id: string;
    uf_fit_score: number | null;
    scheme_score: number | null;
    character_score: number | null;
    athletic_score: number | null;
    timeline_score: number | null;
    uf_status: string | null;
  },
  extras: Partial<UfFitIntelInput> = {}
): UfFitIntelInput {
  return {
    id: row.id,
    uf_fit_score_stored: row.uf_fit_score,
    scheme_score: row.scheme_score,
    character_score: row.character_score,
    athletic_score: row.athletic_score,
    timeline_score: row.timeline_score,
    uf_status: row.uf_status,
    evaluation_notes: extras.evaluation_notes ?? null,
    score_computed_at: extras.score_computed_at ?? null,
    metadata: extras.metadata ?? {},
    signals: extras.signals ?? [],
  };
}
