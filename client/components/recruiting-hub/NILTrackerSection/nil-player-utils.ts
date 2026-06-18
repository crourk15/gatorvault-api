import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';

export function estimateNilValuation(p: HighPriorityPlayer): string {
  const stars = p.stars ?? 4;
  const rank = p.nationalRank ?? p.natlRank ?? 200;
  const base = Math.max(35, 220 - rank / 2) * (stars >= 5 ? 1.4 : stars >= 4 ? 1 : 0.7);
  return `$${Math.round(base)}K`;
}

export function ufNilFitLabel(p: HighPriorityPlayer): string {
  const fit = p.fitScore ?? p.staffConfidence ?? 55;
  if (fit >= 70) return 'High';
  if (fit >= 50) return 'Medium';
  return 'Low';
}

export function marketTrend(p: HighPriorityPlayer): string {
  const d = p.movementDelta ?? 0;
  if (d > 0) return '↑ Rising';
  if (d < 0) return '↓ Cooling';
  return '→ Stable';
}

export function positionBand(p: HighPriorityPlayer): string {
  const pos = (p.position || 'ATH').toUpperCase();
  const premium = ['WR', 'EDGE', 'CB', 'QB'];
  return premium.some((x) => pos.startsWith(x)) ? `${pos} — high band` : `${pos} — medium band`;
}

export function comfortZone(p: HighPriorityPlayer): { label: string; level: 'in' | 'stretch' | 'out' } {
  const fit = p.fitScore ?? 55;
  if (fit >= 70) return { label: 'In UF NIL Comfort Zone', level: 'in' };
  if (fit >= 50) return { label: 'Stretch — competitive offer needed', level: 'stretch' };
  return { label: 'Above typical UF range', level: 'out' };
}
