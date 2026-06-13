/**
 * Recruiting board display helpers — composite ratings, ranks, sorting.
 */
import type { RecruitingBoardPlayer } from './recruiting-board-api';

export type BoardSortMode = 'rating' | 'natl' | 'ufProbability' | 'fitScore' | 'stars' | 'name';
export type BoardViewMode = 'all' | 'commits' | 'targets';

export function formatCompositeRating(rating?: number | null): string | null {
  if (rating == null || !Number.isFinite(Number(rating))) return null;
  const n = Number(rating);
  return n <= 1 ? (n * 100).toFixed(2) : n.toFixed(2);
}

export function playerPos(p: RecruitingBoardPlayer): string {
  return p.position || p.pos || '—';
}

export function playerRating(p: RecruitingBoardPlayer): number {
  const raw = p.displayRating ?? p.rating ?? p.vaultGrade;
  if (raw == null || !Number.isFinite(Number(raw))) return 0;
  const n = Number(raw);
  return n <= 1 ? n * 100 : n;
}

export function formatRank(rank?: number | null): string {
  if (rank == null || !Number.isFinite(Number(rank))) return '—';
  return `#${rank}`;
}

export function formatCommitDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function starsDisplay(stars?: number | null): string {
  const n = Math.min(5, Math.max(0, Number(stars) || 0));
  return '★'.repeat(n);
}

export function sortBoardPlayers(
  list: RecruitingBoardPlayer[],
  sort: BoardSortMode
): RecruitingBoardPlayer[] {
  const copy = [...list];
  if (sort === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'stars') {
    return copy.sort((a, b) => (Number(b.stars) || 0) - (Number(a.stars) || 0));
  }
  if (sort === 'natl') {
    return copy.sort((a, b) => {
      const ra = a.natlRank ?? a.natl ?? 9999;
      const rb = b.natlRank ?? b.natl ?? 9999;
      return ra - rb;
    });
  }
  if (sort === 'ufProbability') {
    return copy.sort((a, b) => (Number(b.ufProbability) || 0) - (Number(a.ufProbability) || 0));
  }
  if (sort === 'fitScore') {
    return copy.sort((a, b) => (Number(b.fitScore) || 0) - (Number(a.fitScore) || 0));
  }
  return copy.sort((a, b) => playerRating(b) - playerRating(a));
}

export function selectHeadliner(commits: RecruitingBoardPlayer[]): RecruitingBoardPlayer | null {
  if (!commits.length) return null;
  const flagged = commits.find((p) => p.headliner);
  if (flagged) return flagged;
  return sortBoardPlayers(commits, 'rating')[0] ?? null;
}
