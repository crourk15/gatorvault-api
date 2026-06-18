import type { RecruitingIntelItem } from '@/api/recruiting';
import { HIGH_PRIORITY_YEAR, type HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import type {
  AnalystSignal,
  HighPriorityIntelItem,
  HighPriorityIntelType,
} from '@/components/recruiting-hub/HighPriorityIntel/types';
import type { IntelCardProps, IntelHeatStatus, IntelType } from '@/components/recruiting-hub/types/intel';

function normalizeUfPct(raw: number | null | undefined): number {
  if (raw == null || Number.isNaN(raw)) return 0;
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
}

function normalizeScore(raw: number | null | undefined): number {
  if (raw == null || Number.isNaN(raw)) return 0;
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
}

function inferHeatStatus(player: HighPriorityPlayer | undefined, ufPct: number): IntelHeatStatus {
  const delta = player?.movementDelta ?? 0;
  if (delta >= 3) return 'trending-up';
  if (delta <= -3) return 'cooling';
  if (player?.committedTo && player.committedTo !== 'Florida') return 'battle';
  if (ufPct >= 55 && ufPct <= 72) return 'battle';
  if (delta > 0) return 'trending-up';
  if (delta < 0) return 'cooling';
  return 'battle';
}

function inferIntelType(player: HighPriorityPlayer | undefined): IntelType {
  if (player?.ufOvStatus || (player?.visitHistory?.length ?? 0) > 0 || player?.visitStart) {
    return 'Visit Intel';
  }
  if (player?.committedTo && player.committedTo !== 'Florida') return 'Flip Watch';
  if (player?.predictors?.length) return 'RPM Movement';
  if (player?.insiderNotes?.toLowerCase().includes('offer')) return 'Offer + Trend';
  return 'RPM Movement';
}

function intelTextFor(player: HighPriorityPlayer | undefined, fallback: string): string {
  return (
    player?.notePreview?.trim() ||
    player?.insiderNotes?.trim() ||
    player?.skinny?.trim() ||
    fallback
  );
}

function resolveDelta7d(player: HighPriorityPlayer | undefined): number {
  if (player?.delta7d != null && !Number.isNaN(player.delta7d)) {
    return Math.round(player.delta7d);
  }
  if (player?.movementDelta != null && !Number.isNaN(player.movementDelta)) {
    return Math.round(player.movementDelta);
  }
  return 0;
}

function resolveClassYear(player: HighPriorityPlayer | undefined, fallback = HIGH_PRIORITY_YEAR): number {
  const raw = player?.classYear;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof fallback === 'number' && Number.isFinite(fallback)) return fallback;
  return HIGH_PRIORITY_YEAR;
}

function resolveIntelType(
  player: HighPriorityPlayer | undefined,
  heatStatus: IntelHeatStatus,
  legacyType: IntelType
): { intelType: HighPriorityIntelType; intelLabel: string } {
  if (legacyType === 'Visit Intel') {
    return { intelType: 'VISIT', intelLabel: 'Visit Intel' };
  }
  if (legacyType === 'Flip Watch') {
    return { intelType: 'BATTLE', intelLabel: 'Battle' };
  }
  if (legacyType === 'Portal Intel') {
    return { intelType: 'NIL', intelLabel: 'NIL' };
  }
  if (legacyType === 'Offer + Trend' || heatStatus === 'trending-up') {
    return { intelType: 'HEAT', intelLabel: 'Heat' };
  }
  if (heatStatus === 'battle') {
    return { intelType: 'BATTLE', intelLabel: 'Battle' };
  }
  if (heatStatus === 'cooling') {
    return { intelType: 'RPM', intelLabel: 'RPM Movement' };
  }
  return { intelType: 'RPM', intelLabel: 'RPM Movement' };
}

function mapAnalystSignals(
  player: HighPriorityPlayer | undefined,
  ufProb: number,
  timestamp: string
): AnalystSignal[] {
  if (!player?.predictors?.length) return [];

  return player.predictors.slice(0, 3).map((predictor, index) => ({
    id: `${player.slug || player.id}-signal-${index}`,
    analyst: predictor.name,
    outlet: 'RPM',
    confidencePct: ufProb,
    rpmPct: normalizeScore(predictor.score),
    timestamp,
  }));
}

export function mapToHighPriorityIntelItem(
  intel: RecruitingIntelItem,
  player: HighPriorityPlayer | undefined,
  classYear = 2027
): HighPriorityIntelItem {
  const ufProb = normalizeUfPct(intel.ufProbability ?? player?.ufProbability);
  const heatStatus = inferHeatStatus(player, ufProb);
  const legacyType = inferIntelType(player);
  const { intelType, intelLabel } = resolveIntelType(player, heatStatus, legacyType);
  const timestamp = intel.timestamp || player?.visitStart || new Date().toISOString();
  const slug = intel.playerId || player?.slug || '';

  return {
    id: intel.id || `${slug}-${timestamp}`,
    slug,
    name: player?.name ?? intel.playerId,
    position: player?.position ?? '—',
    school: player?.school ?? undefined,
    classYear: resolveClassYear(player, classYear),
    ufProb,
    delta7d: resolveDelta7d(player),
    intelType,
    intelLabel,
    intelSummary: intelTextFor(player, intel.text),
    analystSignals: mapAnalystSignals(player, ufProb, timestamp),
    lastUpdated: timestamp,
  };
}

export function mapPlayerToHighPriorityIntelItem(
  player: HighPriorityPlayer,
  index: number
): HighPriorityIntelItem {
  const ufProb = normalizeUfPct(player.ufProbability);
  const heatStatus = inferHeatStatus(player, ufProb);
  const legacyType = inferIntelType(player);
  const { intelType, intelLabel } = resolveIntelType(player, heatStatus, legacyType);
  const timestamp = player.visitStart ?? new Date().toISOString();

  return {
    id: player.id || `${player.slug}-${index}`,
    slug: player.slug || `hp-${index}`,
    name: player.name,
    position: player.position,
    school: player.school ?? undefined,
    classYear: resolveClassYear(player),
    ufProb,
    delta7d: resolveDelta7d(player),
    intelType,
    intelLabel,
    intelSummary: intelTextFor(player, 'Insider tracking active.'),
    analystSignals: mapAnalystSignals(player, ufProb, timestamp),
    lastUpdated: timestamp,
  };
}

export function mapToIntelCard(
  intel: RecruitingIntelItem,
  player: HighPriorityPlayer | undefined,
  classYear = '2027'
): IntelCardProps {
  const ufProbability = normalizeUfPct(intel.ufProbability ?? player?.ufProbability);
  return {
    name: player?.name ?? intel.playerId,
    position: player?.position ?? '—',
    classYear,
    ufProbability,
    heatStatus: inferHeatStatus(player, ufProbability),
    intelType: inferIntelType(player),
    intelText: intelTextFor(player, intel.text),
    timestamp: intel.timestamp || player?.visitStart || new Date().toISOString(),
    playerId: intel.playerId || player?.slug || '',
  };
}

export function mapPlayerToIntelCard(player: HighPriorityPlayer, index: number): IntelCardProps {
  const ufProbability = normalizeUfPct(player.ufProbability);
  return {
    name: player.name,
    position: player.position,
    classYear: '2027',
    ufProbability,
    heatStatus: inferHeatStatus(player, ufProbability),
    intelType: inferIntelType(player),
    intelText: intelTextFor(player, 'Insider tracking active.'),
    timestamp: player.visitStart ?? new Date().toISOString(),
    playerId: player.slug || `hp-${index}`,
  };
}
