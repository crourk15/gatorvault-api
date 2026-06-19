import type { NilProgramRow } from '@/lib/nil-api';

export type NilTrendTone = 'up' | 'down' | 'flat';

export function nilTrendTone(trend?: string | null): NilTrendTone {
  if (trend === 'up') return 'up';
  if (trend === 'down') return 'down';
  return 'flat';
}

export function nilTrendArrow(trend?: string | null): string {
  const tone = nilTrendTone(trend);
  if (tone === 'up') return '↑';
  if (tone === 'down') return '↓';
  return '→';
}

export function formatNilPool(poolM?: number | null): string {
  if (poolM == null || !Number.isFinite(poolM)) return '—';
  return `$${poolM.toFixed(1)}M`;
}

export function collectiveStrength(row: NilProgramRow): number {
  return row.ranking?.score ?? 0;
}

export function portalCompetitiveness(row: NilProgramRow): number {
  const pct = row.metrics?.trendPct ?? 0;
  return Math.min(100, Math.round(pct * 4 + 40));
}

export function blueChipRetention(row: NilProgramRow): number {
  const pct = row.metrics?.trendPct ?? 0;
  const rank = row.ranking?.secRank ?? row.ranking?.nationalRank ?? 16;
  const base = rank <= 8 ? 62 : rank <= 16 ? 58 : 52;
  return Math.min(100, Math.round(base + pct));
}

export function strengthBarPct(value: number): number {
  return Math.max(4, Math.min(100, Math.round(value)));
}

export function programDisplayName(row: NilProgramRow): string {
  return row.name || row.school || row.id;
}

export function isUfProgram(row: NilProgramRow, ufId = 'uf'): boolean {
  return row.id === ufId || /florida gators/i.test(programDisplayName(row));
}
