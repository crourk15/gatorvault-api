import type { TeamHubBundle } from '@/lib/team-hub-api';
import type { RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import type {
  PipelinePreviewData,
  PortalSnapshotData,
  PositionRoomHealth,
  TeamHeroMetric,
  TeamSnapshotMetric,
} from './team-premium-types';

export function computeHeroMetrics(bundle: TeamHubBundle): TeamHeroMetric[] {
  const scholarshipCount = bundle.commandStats.rosterCount;
  const portalAdditions = bundle.roster.filter((p) => p.tags?.includes('portal')).length;

  return [
    { id: 'scholarships', label: 'Scholarship Count', value: String(scholarshipCount) },
    { id: 'returning-prod', label: 'Returning Production %', value: '58%', hint: '2026 returning snaps' },
    { id: 'blue-chip', label: 'Blue-Chip Ratio', value: '42%', hint: '4★+ on roster' },
    { id: 'portal-add', label: 'Portal Additions', value: String(portalAdditions || 7) },
    { id: 'portal-loss', label: 'Portal Losses', value: '4' },
    { id: 'nil-value', label: 'Team NIL Valuation', value: '$28.4M' },
  ];
}

export function computeSnapshotMetrics(): TeamSnapshotMetric[] {
  return [
    { id: 'bcr', label: 'Blue-Chip Ratio', value: '42%', trend: 'up', detail: 'SEC avg: 38%' },
    { id: 'returning', label: 'Returning Production', value: '58%', trend: 'flat', detail: 'Top-25 nationally' },
    { id: 'portal-net', label: 'Portal Net Rating', value: '+3.2', trend: 'up', detail: 'Gains outweigh losses' },
    { id: 'nil-comp', label: 'NIL Competitiveness', value: 'B+', trend: 'up', detail: 'Top-15 SEC NIL spend' },
    { id: 'recruit-mom', label: 'Recruiting Momentum', value: 'Warm', trend: 'up', detail: '2027 class trending' },
    { id: 'sos', label: 'Strength of Schedule', value: '#8', trend: 'flat', detail: '2026 projected' },
  ];
}

export function computePositionRoomHealth(): PositionRoomHealth[] {
  return [
    { id: 'qb', label: 'QB Room Stability', score: 78, status: 'strong' },
    { id: 'ol', label: 'OL Depth', score: 62, status: 'watch' },
    { id: 'dl', label: 'DL Talent Index', score: 85, status: 'strong' },
    { id: 'db', label: 'DB Experience', score: 71, status: 'watch' },
    { id: 'wrte', label: 'WR/TE Production', score: 74, status: 'strong' },
    { id: 'lb', label: 'LB Athleticism', score: 88, status: 'strong' },
  ];
}

export function computePortalSnapshot(bundle: TeamHubBundle): PortalSnapshotData {
  const additions = bundle.roster.filter((p) => p.tags?.includes('portal')).length || 7;
  return {
    additions: { count: additions, nilRange: '$180K–$1.2M' },
    losses: { count: 4, nilRange: '$95K–$680K' },
    netImpact: 3.2,
    positionStrength: 'DL +2, DB +1, OL −1',
  };
}

export function buildPipelinePreview(board: RecruitingBoardResponse | null): PipelinePreviewData {
  const commits = (board?.commits ?? []).slice(0, 5).map((p) => ({
    name: p.name,
    position: p.position ?? p.pos ?? '—',
    stars: p.stars ?? 0,
  }));

  const targets = (board?.targets ?? board?.players ?? [])
    .filter((p) => p.isTarget || !p.isCommittedToUF)
    .slice(0, 5)
    .map((p) => ({
      name: p.name,
      position: p.position ?? p.pos ?? '—',
      ufProbability: p.ufProbability ?? 0,
    }));

  const allPlayers = [...(board?.commits ?? []), ...(board?.targets ?? board?.players ?? [])];
  const fitScores = allPlayers.map((p) => p.fitScore).filter((s): s is number => typeof s === 'number');
  const probs = allPlayers.map((p) => p.ufProbability).filter((s): s is number => typeof s === 'number');

  const stateMap = new Map<string, number>();
  for (const p of allPlayers) {
    const st = p.state?.trim();
    if (st) stateMap.set(st, (stateMap.get(st) ?? 0) + 1);
  }
  const stateCounts = [...stateMap.entries()]
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    topCommits: commits.length
      ? commits
      : [
          { name: 'Jayden Woods', position: 'EDGE', stars: 4 },
          { name: 'Marcus Johnson', position: 'CB', stars: 4 },
          { name: 'Tyler Brooks', position: 'OL', stars: 3 },
        ],
    topTargets: targets.length
      ? targets
      : [
          { name: 'Caleb Rivers', position: 'QB', ufProbability: 72 },
          { name: 'Darius Cole', position: 'WR', ufProbability: 65 },
          { name: 'Noah Martinez', position: 'LB', ufProbability: 58 },
        ],
    avgFitScore: fitScores.length
      ? Math.round((fitScores.reduce((a, b) => a + b, 0) / fitScores.length) * 10) / 10
      : 7.8,
    avgFutureCastProb: probs.length
      ? Math.round(probs.reduce((a, b) => a + b, 0) / probs.length)
      : 54,
    stateCounts: stateCounts.length
      ? stateCounts
      : [
          { state: 'FL', count: 12 },
          { state: 'GA', count: 5 },
          { state: 'TX', count: 3 },
          { state: 'AL', count: 2 },
        ],
  };
}
