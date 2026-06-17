import type { RecruitingIntelItem } from '@/api/recruiting';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import type { IntelCardProps, IntelHeatStatus, IntelType } from '@/components/recruiting-hub/types/intel';

function normalizeUfPct(raw: number | null | undefined): number {
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
