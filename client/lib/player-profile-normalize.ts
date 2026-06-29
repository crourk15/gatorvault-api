/**
 * Normalize full-profile API payloads for Player Profile 2.0.
 */
import type { BigBoardPlayer } from './big-board-api';
import type {
  CollegeProfile,
  DiscoverySignal,
  PlayerCore,
  PortalProfile,
  UFSpecificProfile,
} from './player-api';
import {
  computePlayerMetrics,
  fitTier,
  formatSignalValue,
  type FitTier,
  type PlayerMetrics,
} from './player-derived';
import type { FullProfileFuturecastSummary, FullProfilePayload } from './player-full-profile-api';

export function isUfCommit(player: Pick<PlayerCore, 'committedTo' | 'status'>): boolean {
  const to = String(player.committedTo || '').toLowerCase();
  if (!to) return false;
  return /\bflorida\b|\bgators\b|\buf\b/i.test(to);
}

type RawSignal = Record<string, unknown>;

export function normalizeDiscoverySignal(raw: RawSignal): DiscoverySignal {
  const signalValue = (raw.signalValue ?? raw.value ?? {}) as Record<string, unknown>;
  const createdAtRaw = raw.createdAt ?? raw.created_at;
  let createdAt = '';
  if (typeof createdAtRaw === 'string') createdAt = createdAtRaw;
  else if (createdAtRaw instanceof Date && !Number.isNaN(createdAtRaw.getTime())) {
    createdAt = createdAtRaw.toISOString();
  }

  return {
    id: String(raw.id ?? `${raw.signalType ?? raw.signal_type}-${createdAt}`),
    playerId: String(raw.playerId ?? raw.player_id ?? ''),
    signalType: String(raw.signalType ?? raw.signal_type ?? 'OTHER'),
    signalValue,
    createdAt,
  };
}

export function signalTimestamp(iso: string): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Collapse duplicate offer/ranking rows (same type + display value). */
export function dedupeDiscoverySignals(signals: DiscoverySignal[]): DiscoverySignal[] {
  const seen = new Set<string>();
  const out: DiscoverySignal[] = [];
  const sorted = [...signals].sort((a, b) => signalTimestamp(b.createdAt) - signalTimestamp(a.createdAt));
  for (const s of sorted) {
    const key = `${s.signalType}:${formatSignalValue(s)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export function normalizeDiscoverySignals(raw: RawSignal[] | undefined): DiscoverySignal[] {
  return dedupeDiscoverySignals((raw ?? []).map(normalizeDiscoverySignal));
}

export type ProfileMetricsOptions = {
  player: PlayerCore;
  ufSpecificProfile: UFSpecificProfile | null;
  portalProfile: PortalProfile | null;
  collegeProfile: CollegeProfile | null;
  signals: DiscoverySignal[];
  futurecastSummary?: FullProfileFuturecastSummary | null;
  fitIntel?: { ufFitScore?: number; fitTier?: string } | null;
  movementWindow?: { ufProbNow?: number } | null;
};

export function resolveProfileMetrics(opts: ProfileMetricsOptions): PlayerMetrics {
  const deduped = dedupeDiscoverySignals(opts.signals);
  const base = computePlayerMetrics(
    opts.player,
    opts.ufSpecificProfile,
    opts.portalProfile,
    opts.collegeProfile,
    deduped
  );

  const ufCommit = isUfCommit(opts.player);
  const modelPct = opts.futurecastSummary?.ufProbability;
  const movementPct = opts.movementWindow?.ufProbNow;
  const breakdown = opts.player.fitScoreBreakdown;
  const breakdownTotal =
    breakdown != null
      ? Math.round(
          (breakdown.scheme ?? 0) +
            (breakdown.culture ?? 0) +
            (breakdown.staff ?? 0) +
            (breakdown.need ?? 0) +
            (breakdown.geo ?? 0)
        )
      : 0;

  let ufFitScore = base.ufFitScore;
  if (opts.fitIntel?.ufFitScore != null && opts.fitIntel.ufFitScore > 0) {
    ufFitScore = Math.round(opts.fitIntel.ufFitScore);
  } else if (modelPct != null && modelPct > 0) {
    ufFitScore = Math.max(ufFitScore, Math.round(modelPct));
  } else if (movementPct != null && movementPct > 0) {
    ufFitScore = Math.max(ufFitScore, Math.round(movementPct));
  } else if (opts.player.ufFitScore != null && opts.player.ufFitScore > 0) {
    ufFitScore = Math.max(ufFitScore, Math.round(opts.player.ufFitScore));
  } else if (breakdownTotal > 0) {
    ufFitScore = Math.max(ufFitScore, breakdownTotal);
  }

  if (ufCommit) {
    ufFitScore = Math.max(ufFitScore, 100);
  }

  const ufFitTier: FitTier =
    ufCommit && ufFitScore >= 85
      ? 'elite'
      : opts.fitIntel?.fitTier
        ? (opts.fitIntel.fitTier as FitTier)
        : fitTier(ufFitScore);

  const portalHidden =
    opts.player.status === 'HS' && !opts.portalProfile && !opts.collegeProfile;

  return {
    ...base,
    ufFitScore,
    ufFitTier,
    ufFitLabel: ufCommit && ufFitScore >= 80 ? 'Locked In' : undefined,
    portalLikelihoodPct: portalHidden ? null : base.portalLikelihoodPct,
    portalHidden,
    signalCount: deduped.length,
  };
}

export function normalizeFullProfilePayload(payload: FullProfilePayload): FullProfilePayload {
  const signals = normalizeDiscoverySignals(payload.signals as unknown as RawSignal[]);
  return {
    ...payload,
    signals,
    related: payload.related ?? [],
  };
}

export function mapNormalizedProfileBundle(payload: FullProfilePayload) {
  const normalized = normalizeFullProfilePayload(payload);
  return {
    player: normalized.player,
    highSchoolProfile: normalized.highSchoolProfile,
    collegeProfile: normalized.collegeProfile,
    portalProfile: normalized.portalProfile,
    ufSpecificProfile: normalized.ufSpecificProfile,
    signals: normalized.signals,
    related: normalized.related as BigBoardPlayer[],
  };
}
