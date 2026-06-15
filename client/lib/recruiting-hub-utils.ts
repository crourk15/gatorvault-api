import type { RecruitingBoardPlayer } from './recruiting-board-api';
import type { ClassicRecruitCardPlayer } from '@/components/vault/ClassicRecruitCard';

export type PlayerCardStatus = 'commit' | 'target' | 'portal' | 'highPriority';

export function isElitePlayer(player: ClassicRecruitCardPlayer & { tier?: string }): boolean {
  const stars = Number(player.stars) || 0;
  const natl = player.natlRank ?? player.natl ?? 9999;
  return (
    stars >= 5 ||
    natl <= 100 ||
    Boolean(player.headliner) ||
    player.tier === 'TOP'
  );
}

export function playerStatusLabel(
  player: ClassicRecruitCardPlayer & { tier?: string; lifecycle?: string },
  variant?: 'commit' | 'target'
): string {
  if (variant === 'commit' || player.isCommittedToUF) return 'Commit';
  if (player.lifecycle === 'PORTAL') return 'Portal';
  if (player.tier === 'TOP') return 'High Priority';
  return 'Target';
}

export function schoolLogoInitials(name?: string | null): string {
  if (!name) return '?';
  const cleaned = name.replace(/^the\s+/i, '');
  return cleaned
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

export function findPlayerInPool(
  slug: string | undefined,
  name: string,
  pool: RecruitingBoardPlayer[]
): RecruitingBoardPlayer | undefined {
  if (slug) {
    const bySlug = pool.find((p) => p.slug === slug);
    if (bySlug) return bySlug;
  }
  return pool.find((p) => p.name.toLowerCase() === name.toLowerCase());
}

export function momentumTrend(
  pct: number,
  priorPct?: number
): 'up' | 'down' | 'neutral' {
  if (priorPct != null) {
    if (pct > priorPct + 2) return 'up';
    if (pct < priorPct - 2) return 'down';
  }
  if (pct >= 65) return 'up';
  if (pct <= 45) return 'down';
  return 'neutral';
}
