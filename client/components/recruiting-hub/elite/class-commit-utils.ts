import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { formatCompositeRating, playerPos, playerRating } from '@/lib/recruiting-board-utils';

export type EnrichedCommitPlayer = RecruitingBoardPlayer & {
  playerComp?: string | null;
  schemeFit?: string | null;
  projection?: string | null;
  jerseyNumber?: string | number | null;
};

export function gatorVaultGrade(player: EnrichedCommitPlayer): string {
  const raw = player.vaultGrade ?? player.displayRating ?? player.rating;
  if (raw == null || !Number.isFinite(Number(raw))) return '—';
  const n = Number(raw);
  const score = n <= 1 ? n * 100 : n;
  if (score >= 95) return 'A';
  if (score >= 88) return 'B+';
  if (score >= 82) return 'B';
  if (score >= 75) return 'C+';
  return 'C';
}

export function estimateNil(player: EnrichedCommitPlayer): string {
  const stars = Number(player.stars) || 0;
  if (stars >= 5) return '$400K–$750K';
  if (stars >= 4) return '$75K–$250K';
  if (stars >= 3) return '$15K–$75K';
  const rating = playerRating(player);
  if (rating >= 90) return '$50K–$150K';
  return 'TBD';
}

export function stabilityScore(player: EnrichedCommitPlayer): number {
  const fit = Number(player.fitScore);
  if (Number.isFinite(fit) && fit > 0) return Math.min(100, Math.round(fit));
  const uf = Number(player.ufProbability);
  if (Number.isFinite(uf) && uf > 0) {
    const pct = uf <= 1 ? uf * 100 : uf;
    return Math.min(100, Math.round(pct));
  }
  return 50;
}

export function ufPercent(player: EnrichedCommitPlayer): number | null {
  const raw = player.ufProbability;
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  const n = Number(raw);
  return Math.round(n <= 1 ? n * 100 : n);
}

export function displayRating(player: EnrichedCommitPlayer): string {
  return formatCompositeRating(player.displayRating ?? player.rating ?? player.vaultGrade) ?? '—';
}

export function positionLabel(player: EnrichedCommitPlayer): string {
  return playerPos(player);
}

export function insiderIntel(player: EnrichedCommitPlayer): string | null {
  const note = player.evaluatorNotes ?? player.notePreview ?? player.skinny ?? player.notes;
  return note && String(note).trim() ? String(note).trim() : null;
}

export function isEnrolledPlayer(player: EnrichedCommitPlayer): boolean {
  const status = String(player.status ?? '').toLowerCase();
  return status.includes('enroll') || status.includes('signed');
}
