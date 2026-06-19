import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import type { MasterBoardResponse } from '@/lib/futurecast-board-types';
import { ufPctFromFc } from '@/components/futurecast/lab/fc-lab-types';

/** Normalize UF probability that may be stored as 0–1 or 0–100. */
export function ufPctFromRaw(raw: number | null | undefined): number | null {
  if (raw == null || Number.isNaN(Number(raw))) return null;
  const n = Number(raw);
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

export function buildFutureCastSlugMap(
  board: MasterBoardResponse | null | undefined
): Map<string, { ufConfidence: number | null; fitScore: number | null }> {
  const map = new Map<string, { ufConfidence: number | null; fitScore: number | null }>();
  for (const p of board?.players ?? []) {
    if (p.slug) {
      map.set(p.slug.toLowerCase(), { ufConfidence: p.ufConfidence, fitScore: p.fitScore });
    }
  }
  return map;
}

/** Prefer recruiting-board value, then FutureCast; never coerce null/undefined to 0. */
export function resolveUfProbabilityPct(
  player: Pick<RecruitingBoardPlayer, 'ufProbability' | 'slug'>,
  fcBySlug: Map<string, { ufConfidence: number | null; fitScore: number | null }>
): number | null {
  const fromBoard = ufPctFromRaw(player.ufProbability);
  if (fromBoard != null) return fromBoard;

  const slug = player.slug?.toLowerCase();
  if (!slug) return null;
  const fc = fcBySlug.get(slug);
  if (fc == null || fc.ufConfidence == null || Number.isNaN(fc.ufConfidence)) return null;

  const pct = ufPctFromFc(fc.ufConfidence);
  return pct > 0 ? pct : null;
}

export function formatPipelineUfPct(pct: number | null | undefined): string {
  if (pct == null) return '—';
  return `${pct}%`;
}

export function commitCompositeRating(player: RecruitingBoardPlayer): number {
  const raw = player.displayRating ?? player.rating ?? player.vaultGrade;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export type PipelineStateTier = 'strong' | 'hot' | 'neutral' | 'weak';

export function pipelineStateTier(count: number, maxCount: number): PipelineStateTier {
  if (maxCount <= 0 || count <= 0) return 'weak';
  const ratio = count / maxCount;
  if (ratio >= 0.75) return 'strong';
  if (ratio >= 0.5) return 'hot';
  if (ratio >= 0.25) return 'neutral';
  return 'weak';
}
