import type { DepthChart, TeamCommandStats, TeamPlayer } from '@/lib/team-hub-types';

export function computeTeamCommandStats(
  roster: TeamPlayer[],
  depthChart: DepthChart,
  meta?: { playerCount?: number; updatedAt?: string | null } | null
): TeamCommandStats {
  const positions = [
    ...depthChart.offense,
    ...depthChart.defense,
    ...depthChart.specialTeams,
  ];

  let updatedLabel = 'June 2026';
  if (meta?.updatedAt) {
    const d = new Date(meta.updatedAt);
    if (!Number.isNaN(d.getTime())) {
      updatedLabel = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  }

  return {
    rosterCount: meta?.playerCount ?? roster.length,
    startersLocked: positions.filter((p) => p.status === 'Locked').length,
    positionBattles: positions.filter((p) => p.status === 'Battle').length,
    updatedLabel,
  };
}
