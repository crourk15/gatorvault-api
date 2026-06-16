import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import type { RecruitingHubTab } from '@/lib/vault-route-map';
import { selectHeadliner } from '@/lib/recruiting-board-utils';

export function rankCommits(list: RecruitingBoardPlayer[]): RecruitingBoardPlayer[] {
  return [...list].sort((a, b) => {
    const ra = a.natlRank ?? a.natl ?? 9999;
    const rb = b.natlRank ?? b.natl ?? 9999;
    if (ra !== rb) return ra - rb;
    return (Number(b.stars) || 0) - (Number(a.stars) || 0);
  });
}

export function rankTargets(list: RecruitingBoardPlayer[]): RecruitingBoardPlayer[] {
  return [...list].sort((a, b) => {
    const uf = (Number(b.ufProbability) || 0) - (Number(a.ufProbability) || 0);
    if (uf !== 0) return uf;
    const na = a.natlRank ?? a.natl ?? 9999;
    const nb = b.natlRank ?? b.natl ?? 9999;
    if (na !== nb) return na - nb;
    return (Number(b.fitScore) || 0) - (Number(a.fitScore) || 0);
  });
}

export function filterCommitsWithoutHeadliner(
  commits: RecruitingBoardPlayer[],
  headliner: RecruitingBoardPlayer | null
): RecruitingBoardPlayer[] {
  if (!headliner) return commits;
  return commits.filter((p) => p.slug !== headliner.slug && p.name !== headliner.name);
}

export function pickHeadliner(commits: RecruitingBoardPlayer[]): RecruitingBoardPlayer | null {
  return selectHeadliner(commits);
}

export function gridConfigForTab(
  tab: RecruitingHubTab,
  b26: { commits: RecruitingBoardPlayer[] },
  b27: { commits: RecruitingBoardPlayer[]; targets: RecruitingBoardPlayer[] },
  b28: { targets: RecruitingBoardPlayer[] },
  commitsWithoutHeadliner: RecruitingBoardPlayer[]
): { players: RecruitingBoardPlayer[]; title: string; emptyMessage: string } {
  switch (tab) {
    case 'commits-2026':
      return {
        players: rankCommits(b26.commits),
        title: '2026 Commits',
        emptyMessage: 'No 2026 commits yet.',
      };
    case 'targets-2027':
      return {
        players: b27.targets,
        title: '2027 Targets',
        emptyMessage: 'No 2027 targets.',
      };
    case 'targets-2028':
      return {
        players: b28.targets,
        title: '2028 Targets',
        emptyMessage: 'No 2028 targets yet — early discovery board coming soon.',
      };
    case 'commits-2027':
    default:
      return {
        players: commitsWithoutHeadliner,
        title: '2027 Commits',
        emptyMessage: 'No 2027 commits yet.',
      };
  }
}
