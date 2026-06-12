/**
 * Portal Intelligence Engine — likelihood, risk, volatility, transfer predictions.
 * @see FutureCast Phase 6 spec
 */
import type { SignalType } from '../../shared/enums';
import {
  clamp01,
  clamp100,
  extractDepthChartRank,
  extractSnapPercent,
  hasSignalType,
  SIGNAL_TYPE_WEIGHTS,
} from '../big-board/utils';

import type { PortalSignalDetail } from '../../models/portal-intel-types';

export type { PortalSignalDetail };

export interface PortalIntelInput {
  id: string;
  lifecycle: string;
  portal_likelihood_stored: number | null;
  signal_types: SignalType[];
  signals: PortalSignalDetail[];
  depth_history: unknown[] | null;
  college_stats: Record<string, unknown> | null;
  college_snaps: Record<string, unknown> | null;
  stars: number | null;
  composite_rating: number | null;
  hometown: string | null;
  state: string | null;
  college: string | null;
  previous_school: string | null;
  uf_fit_score: number | null;
  scheme_score: number | null;
  uf_status: string | null;
  hs_offers: unknown[];
}

export interface PortalIntelScores {
  portalLikelihood: number;
  depthChartRisk: number;
  snapShare: number | null;
  snapShareScore: number;
  volatility: number;
}

export interface TransferPrediction {
  school: string;
  score: number;
}

const FL_SCHOOLS = ['Florida', 'UCF', 'FSU', 'Miami', 'USF', 'FAU'];

function depthRank(input: PortalIntelInput): number | null {
  return extractDepthChartRank(input.depth_history, input.college_stats);
}

function snapPct(input: PortalIntelInput): number | null {
  return extractSnapPercent(input.college_snaps);
}

function isHighTalent(input: PortalIntelInput): boolean {
  if (input.stars != null && input.stars >= 4) return true;
  if (input.composite_rating != null && input.composite_rating >= 0.88) return true;
  return false;
}

function depthChartDelta(input: PortalIntelInput): number {
  const history = input.depth_history;
  if (!history?.length || history.length < 2) return 0;
  const ranks: number[] = [];
  for (const entry of history) {
    if (entry && typeof entry === 'object') {
      const r = (entry as Record<string, unknown>).rank ?? (entry as Record<string, unknown>).depth;
      if (r != null && Number.isFinite(Number(r))) ranks.push(Number(r));
    }
  }
  if (ranks.length < 2) return 0;
  return Math.abs(ranks[ranks.length - 1] - ranks[0]) * 12;
}

function snapShareDelta(input: PortalIntelInput): number {
  const snaps = input.college_snaps;
  if (!snaps) return 0;
  const trend = snaps.snap_trend ?? snaps.snapTrend ?? snaps.usage_trend;
  if (Array.isArray(trend) && trend.length >= 2) {
    const a = normalizeSnapValue(trend[0]);
    const b = normalizeSnapValue(trend[trend.length - 1]);
    if (a != null && b != null) return Math.abs(b - a) * 100;
  }
  const pct = snapPct(input);
  if (pct != null && pct < 0.15) return 25;
  if (pct != null && pct < 0.25) return 12;
  return 0;
}

function normalizeSnapValue(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n > 1 ? n / 100 : n;
}

function competitionPenalty(input: PortalIntelInput): number {
  const stats = input.college_stats ?? {};
  if (stats.competition_high === true || stats.competitionLevel === 'high') return 20;
  const depthCount = input.depth_history?.length ?? 0;
  if (depthCount >= 4) return 20;
  if (depthCount >= 2) return 10;
  return 0;
}

function signalVolatilityWeight(input: PortalIntelInput): number {
  let weight = Math.min(50, input.signals.length * 4);
  for (const sig of input.signals) {
    weight += (SIGNAL_TYPE_WEIGHTS[sig.signal_type] ?? 5) * 0.15;
  }
  return clamp100(weight);
}

/** Portal Likelihood (0–1) — refined Phase 6 model. */
export function computePortalLikelihood(input: PortalIntelInput): number {
  if (input.lifecycle === 'PORTAL') return 1;
  if (input.lifecycle === 'HS') return 0;

  let score = 0.05;

  if (hasSignalType(input.signal_types, 'PORTAL_ACTIVITY')) score += 0.25;
  if (hasSignalType(input.signal_types, 'SOCIAL_MOMENTUM')) score += 0.15;
  if (hasSignalType(input.signal_types, 'STAFF_FLAG')) score += 0.1;
  if (hasSignalType(input.signal_types, 'EVALUATION_NOTE')) score += 0.05;

  const rank = depthRank(input);
  if (rank != null) {
    if (rank >= 4) score += 0.25;
    else if (rank >= 3) score += 0.15;
  }

  const snap = snapPct(input);
  if (snap != null) {
    if (snap < 0.1) score += 0.25;
    else if (snap < 0.2) score += 0.15;
  }

  if (isHighTalent(input) && snap != null && snap < 0.3) {
    score += 0.1;
  }

  return clamp01(Math.round(score * 1000) / 1000);
}

/** Depth Chart Risk Score (0–100). */
export function computeDepthChartRisk(input: PortalIntelInput): number {
  let risk = 0;
  const rank = depthRank(input);
  if (rank != null) {
    if (rank >= 4) risk += 40;
    else if (rank >= 3) risk += 28;
    else if (rank >= 2) risk += 12;
  }

  const snap = snapPct(input);
  if (snap != null) {
    if (snap < 0.1) risk += 30;
    else if (snap < 0.2) risk += 15;
  }

  risk += competitionPenalty(input);
  return clamp100(Math.round(risk));
}

/** Snap Share Score (0–100). */
export function computeSnapShareScore(input: PortalIntelInput): number {
  const snap = snapPct(input);
  if (snap == null) return 0;
  return clamp100(Math.round(snap * 100));
}

/** Portal Volatility Index (0–100). */
export function computeVolatility(input: PortalIntelInput): number {
  const signalWeight = signalVolatilityWeight(input);
  const depthDelta = depthChartDelta(input);
  const snapDelta = snapShareDelta(input);
  const volatility = signalWeight * 0.5 + depthDelta * 0.3 + snapDelta * 0.2;
  return clamp100(Math.round(volatility));
}

export function computePortalIntelScores(input: PortalIntelInput): PortalIntelScores {
  const snapShare = snapPct(input);
  return {
    portalLikelihood: computePortalLikelihood(input),
    depthChartRisk: computeDepthChartRisk(input),
    snapShare: snapShare != null ? Math.round(snapShare * 1000) / 1000 : null,
    snapShareScore: computeSnapShareScore(input),
    volatility: computeVolatility(input),
  };
}

function schoolsFromOffers(offers: unknown[]): string[] {
  const out: string[] = [];
  for (const offer of offers) {
    if (offer && typeof offer === 'object' && 'school' in offer) {
      const school = String((offer as { school?: string }).school || '').trim();
      if (school) out.push(school);
    }
  }
  return out;
}

function schoolsFromSignals(signals: PortalSignalDetail[]): string[] {
  const out: string[] = [];
  for (const sig of signals) {
    const school = sig.signal_value?.school;
    if (typeof school === 'string' && school.trim()) out.push(school.trim());
  }
  return out;
}

/** Transfer destination predictions — top 5 schools (0–1 scores). */
export function computeTransferPredictions(
  input: PortalIntelInput,
  peerDestinations: string[] = []
): TransferPrediction[] {
  const scores = new Map<string, number>();

  function add(school: string, weight: number) {
    if (!school) return;
    scores.set(school, (scores.get(school) ?? 0) + weight);
  }

  const ufFit = input.uf_fit_score ?? 0;
  if (ufFit >= 60) add('Florida', (ufFit / 100) * 0.35);
  if (input.uf_status === 'TARGET' || input.uf_status === 'PRIORITY') add('Florida', 0.15);
  if (input.uf_status === 'COMMITTED') add('Florida', 0.25);

  if (input.state === 'FL' || input.hometown?.includes('FL')) {
    for (const s of FL_SCHOOLS) add(s, 0.08);
  }

  for (const school of schoolsFromOffers(input.hs_offers)) {
    add(school, 0.12);
  }

  for (const school of schoolsFromSignals(input.signals)) {
    add(school, 0.1);
  }

  if (hasSignalType(input.signal_types, 'STAFF_FLAG')) add('Florida', 0.1);

  const scheme = input.scheme_score ?? 0;
  if (scheme >= 70) add('Florida', 0.08);

  for (const dest of peerDestinations) {
    add(dest, 0.06);
  }

  if (input.previous_school) {
    add(input.previous_school, 0.04);
  }

  const max = Math.max(...scores.values(), 0.01);
  const sorted = [...scores.entries()]
    .map(([school, score]) => ({
      school,
      score: Math.round(clamp01(score / max) * 1000) / 1000,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return sorted;
}

export interface LikelihoodTrendPoint {
  date: string;
  likelihood: number;
}

/** Portal likelihood trend over the last N days (signal-aware). */
export function computePortalLikelihoodTrend(
  input: PortalIntelInput,
  days = 30
): LikelihoodTrendPoint[] {
  if (input.lifecycle === 'HS') return [];
  if (input.lifecycle === 'PORTAL') {
    return [{ date: new Date().toISOString().slice(0, 10), likelihood: 1 }];
  }

  const now = Date.now();
  const points: LikelihoodTrendPoint[] = [];
  const dayMs = 24 * 60 * 60 * 1000;

  for (let d = days; d >= 0; d -= Math.max(1, Math.floor(days / 10))) {
    const cutoff = new Date(now - d * dayMs);
    const dateStr = cutoff.toISOString().slice(0, 10);
    const signalsUpTo = input.signals.filter((s) => new Date(s.created_at).getTime() <= cutoff.getTime());
    const types = signalsUpTo.map((s) => s.signal_type);
    const partial: PortalIntelInput = {
      ...input,
      signal_types: types,
      signals: signalsUpTo,
    };
    points.push({
      date: dateStr,
      likelihood: computePortalLikelihood(partial),
    });
  }

  return points;
}

/** Map Big Board row shape to portal intel input. */
export function portalIntelFromBigBoardRow(
  row: {
    id: string;
    lifecycle: string;
    portal_likelihood_stored: number | null;
    signal_types: SignalType[];
    depth_history: unknown[] | null;
    college_stats: Record<string, unknown> | null;
    college_snaps: Record<string, unknown> | null;
  },
  extras: Partial<PortalIntelInput> = {}
): PortalIntelInput {
  return {
    id: row.id,
    lifecycle: row.lifecycle,
    portal_likelihood_stored: row.portal_likelihood_stored,
    signal_types: row.signal_types,
    signals: extras.signals ?? [],
    depth_history: row.depth_history,
    college_stats: row.college_stats,
    college_snaps: row.college_snaps,
    stars: extras.stars ?? null,
    composite_rating: extras.composite_rating ?? null,
    hometown: extras.hometown ?? null,
    state: extras.state ?? null,
    college: extras.college ?? null,
    previous_school: extras.previous_school ?? null,
    uf_fit_score: extras.uf_fit_score ?? null,
    scheme_score: extras.scheme_score ?? null,
    uf_status: extras.uf_status ?? null,
    hs_offers: extras.hs_offers ?? [],
  };
}
