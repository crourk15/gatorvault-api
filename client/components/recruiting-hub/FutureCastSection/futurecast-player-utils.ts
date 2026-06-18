import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';

export function ufPct(p: HighPriorityPlayer): number {
  const raw = p.ufProbability;
  if (raw == null) return 0;
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
}

export function movementDelta(player: HighPriorityPlayer): number {
  return Math.round(player.delta7d ?? player.movementDelta ?? 0);
}

export function lastIntel(p: HighPriorityPlayer): string {
  const text = p.notePreview?.trim() || p.insiderNotes?.trim() || p.skinny?.trim() || 'Tracking active';
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

export function competingSchools(p: HighPriorityPlayer): string {
  if (p.predictors?.length) return p.predictors.slice(0, 3).map((x) => x.name).join(' · ');
  if (p.committedTo) return p.committedTo;
  return '—';
}

export function analystConfidence(p: HighPriorityPlayer): number | null {
  if (!p.predictors?.length) return null;
  const top = p.predictors[0];
  if (top.score == null) return null;
  return top.score <= 1 ? Math.round(top.score * 100) : Math.round(top.score);
}
