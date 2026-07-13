/** UF Premium Team Page — tab ids, metrics, shared types */

export type TeamPremiumTabId =
  | 'depth-chart'
  | 'roster'
  | 'coaching-staff'
  | 'team-identity'
  | 'program-history'
  | 'recruiting-pipeline';

export type TeamPremiumTab = {
  id: TeamPremiumTabId;
  label: string;
};

/** Fan-first order: depth chart is the main event. */
export const TEAM_PREMIUM_TABS: TeamPremiumTab[] = [
  { id: 'depth-chart', label: 'Depth Chart' },
  { id: 'roster', label: 'Roster' },
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

/** @deprecated Overview analytics removed — kept for unused module compile. */
export type TeamSnapshotMetric = {
  id: string;
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'flat';
  detail?: string;
};

/** @deprecated */
export type PositionRoomHealth = {
  id: string;
  label: string;
  score: number;
  max?: number;
  status: 'strong' | 'watch' | 'concern';
};

/** @deprecated */
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
