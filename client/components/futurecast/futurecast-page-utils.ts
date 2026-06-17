import type { FeedPrediction } from '@/lib/predictions-api';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';

export function ufPct(raw: number | null | undefined): number {
  if (raw == null) return 0;
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
}

export function movementArrow(delta: number): string {
  if (delta > 0) return '↑';
  if (delta < 0) return '↓';
  return '→';
}

export function movementClass(delta: number): string {
  if (delta > 0) return 'fc-table__move--up';
  if (delta < 0) return 'fc-table__move--down';
  return 'fc-table__move--flat';
}

export function shortIntel(text: string | null | undefined, max = 90): string {
  const t = text?.trim() || 'Tracking active';
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function competingSchoolsFromPrediction(p: FeedPrediction): string {
  if (p.committedTo) return p.committedTo;
  if (p.school) return p.school;
  return '—';
}

export function competingSchoolsFromHighPriority(p: HighPriorityPlayer): string {
  if (p.predictors?.length) return p.predictors.slice(0, 3).map((x) => x.name).join(' · ');
  if (p.committedTo) return p.committedTo;
  return '—';
}

export function fitScoreDisplay(p: { fitScore?: number | null; ufFitScore?: number | null }): string {
  const raw = p.fitScore ?? p.ufFitScore;
  if (raw == null) return '—';
  return String(Math.round(raw <= 1 ? raw * 100 : raw));
}
