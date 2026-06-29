/** UF Premium Team Page — tab ids, metrics, shared types */

export type TeamPremiumTabId =
  | 'overview'
  | 'roster'
  | 'depth-chart'
  | 'coaching-staff'
  | 'team-identity'
  | 'program-history'
  | 'recruiting-pipeline';

export type TeamPremiumTab = {
  id: TeamPremiumTabId;
  label: string;
};

export const TEAM_PREMIUM_TABS: TeamPremiumTab[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'roster', label: 'Roster' },
  { id: 'depth-chart', label: 'Depth Chart' },
  { id: 'coaching-staff', label: 'Coaching Staff' },
  { id: 'team-identity', label: 'Team Identity' },
  { id: 'program-history', label: 'Program History' },
  { id: 'recruiting-pipeline', label: 'Recruiting Pipeline' },
];

export type TeamHeroMetric = {
  id: string;
  label: string;
  value: string;
  hint?: string;
};

export type TeamSnapshotMetric = {
  id: string;
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'flat';
  detail?: string;
};

export type PositionRoomHealth = {
  id: string;
  label: string;
  score: number;
  max?: number;
  status: 'strong' | 'watch' | 'concern';
};

export type PortalSnapshotData = {
  additions: { count: number; nilRange: string };
  losses: { count: number; nilRange: string };
  netImpact: number;
  positionStrength: string;
};

export type PipelinePreviewData = {
  classYear: number;
  topCommits: { name: string; position: string; stars: number; composite?: number }[];
  topTargets: { name: string; position: string; ufProbability: number | null }[];
  avgFitScore: number;
  avgFutureCastProb: number;
  stateCounts: { state: string; count: number }[];
};
