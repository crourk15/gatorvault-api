/**
 * Fan-facing scheme-match copy for FutureCast Lab.
 * Prefer English bands + chase context over raw Fit/UF number walls.
 */

import type { HighPriorityPlayer } from './futurecast-high-priority-api';
import type { NeedTier } from './fc-position-need-board';
import { normalizeNeedBoardRoom, needTierLabel } from './fc-position-need-board';

function ufPctFromFc(raw: number | null | undefined): number {
  if (raw == null || Number.isNaN(Number(raw))) return 0;
  const n = Number(raw);
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

export type FitBand = 'elite' | 'strong' | 'solid' | 'stretch' | 'unknown';

export type SchemeMatchRow = {
  slug: string;
  name: string;
  position: string;
  school: string | null;
  fitScore: number;
  fitBand: FitBand;
  fitLabel: string;
  ufPct: number;
  chaseLabel: string;
  why: string;
  needTier: NeedTier | null;
};

export function fitBandFromScore(fit: number | null | undefined): FitBand {
  const n = Math.round(Number(fit) || 0);
  if (n <= 0) return 'unknown';
  if (n >= 80) return 'elite';
  if (n >= 65) return 'strong';
  if (n >= 50) return 'solid';
  return 'stretch';
}

export function fitBandLabel(band: FitBand): string {
  switch (band) {
    case 'elite':
      return 'Elite scheme match';
    case 'strong':
      return 'Strong scheme match';
    case 'solid':
      return 'Solid scheme match';
    case 'stretch':
      return 'Stretch scheme fit';
    default:
      return 'Scheme fit pending';
  }
}

/** Florida chase reality in plain language. */
export function chaseLabelFromUf(ufPct: number): string {
  if (ufPct >= 67) return `Florida leaning in (${ufPct}%)`;
  if (ufPct >= 34) return `Still a battle for Florida (${ufPct}%)`;
  if (ufPct > 0) return `UF still early in the chase (${ufPct}%)`;
  return 'Florida odds still forming';
}

export function schemeMatchWhy(input: {
  position: string;
  fitBand: FitBand;
  ufPct: number;
  needTier?: NeedTier | null;
}): string {
  const pos =
    input.position && input.position !== 'TBD' ? input.position : 'this position';
  const fit = fitBandLabel(input.fitBand);
  const chase = chaseLabelFromUf(input.ufPct);
  const tier = input.needTier ?? null;
  if (tier === 'critical' || tier === 'high') {
    return `${fit} at ${pos}. ${needTierLabel(tier)} — ${chase}.`;
  }
  if (tier === 'watch') {
    return `${fit} at ${pos}. Depth watch at the spot — ${chase}.`;
  }
  return `${fit} at ${pos}. ${chase}.`;
}

/** Top scheme matches for the locked board — fan strip, not a metric dump. */
export function buildSchemeMatchLeaders(
  players: HighPriorityPlayer[],
  needTierByPos: Record<string, NeedTier> = {},
  limit = 5
): SchemeMatchRow[] {
  return [...players]
    .filter((p) => Number(p.fitScore) > 0)
    .sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0))
    .slice(0, limit)
    .map((p) => {
      const fitScore = Math.round(Number(p.fitScore) || 0);
      const fitBand = fitBandFromScore(fitScore);
      const ufPct = ufPctFromFc(p.ufProbability);
      const room = normalizeNeedBoardRoom(p.position);
      const needTier = room ? needTierByPos[room] ?? null : null;
      return {
        slug: p.slug,
        name: p.name,
        position: p.position || 'TBD',
        school: p.school ?? null,
        fitScore,
        fitBand,
        fitLabel: fitBandLabel(fitBand),
        ufPct,
        chaseLabel: chaseLabelFromUf(ufPct),
        needTier,
        why: schemeMatchWhy({
          position: p.position || 'TBD',
          fitBand,
          ufPct,
          needTier,
        }),
      };
    });
}