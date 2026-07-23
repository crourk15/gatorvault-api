/** Team hub — dev-ready prop types and copy. */

export type Era = {
  id: string;
  label: string;
  title: string;
  description?: string;
  highlights?: string[];
};

export type Achievement = {
  id: string;
  label: string;
  value: string;
};

export type IdentityBlock = {
  id: string;
  title: string;
  description: string;
};

export type Coach = {
  id: string;
  initials: string;
  name: string;
  title: string;
  group: 'coaching' | 'support';
  bio?: string;
  highlights?: string[];
  headshotUrl?: string;
  recruitingRegions?: string[];
  keyRecruits?: string[];
  tenure?: string;
  specialty?: string;
};

export type TeamPlayer = {
  id: string;
  name: string;
  position: string;
  positionGroup?: string | null;
  classYear: string;
  hometown?: string;
  state?: string;
  tags?: string[];
  slug?: string;
};

export type DepthChartStatus = 'Locked' | 'Battle' | 'Watch';

export type DepthChartPosition = {
  id: string;
  label: string;
  status: DepthChartStatus;
  players: {
    name: string;
    classYear: string;
    notes?: string;
  }[];
  analysis?: string;
};

export type DepthChart = {
  offense: DepthChartPosition[];
  defense: DepthChartPosition[];
  specialTeams: DepthChartPosition[];
};

export type DepthChartTab = 'offense' | 'defense' | 'specialTeams';

export type TeamCommandStats = {
  rosterCount: number;
  startersLocked: number;
  positionBattles: number;
  offenseCount?: number;
  defenseCount?: number;
  updatedLabel: string;
};

export const TEAM_COPY = {
  hero: {
    title: 'FLORIDA GATORS FOOTBALL',
    subtitle: 'Program history, culture, roster, and depth chart—one hub for Gator Nation.',
    badge: 'Updated June 2026',
  },
  commandCard: {
    eyebrow: 'GatorVault Insider',
    title: 'Florida Gators Football',
    subtitle: 'Program history, culture, roster, and depth chart—one hub for Gator Nation.',
    statusPrefix: 'Season: 2026 · Updated',
  },
  programHistory: { title: 'Program History' },
  achievements: { title: 'Program Achievements' },
  identity: { title: 'Team Identity' },
  coachingStaff: {
    title: 'Coaching Staff',
    subtitle: '2026 Sumrall staff · coordinators · position coaches',
    supportTitle: 'Support Staff',
  },
  roster: {
    title: 'Roster Rooms',
    subtitle: 'Starters first · position rooms · tap into a player card',
  },
  depthChart: {
    title: '2026 Depth Chart',
    subtitle: 'Fall camp board · Locked · Battle · Watch',
    tabs: { offense: 'Offense', defense: 'Defense (3‑3‑5)', specialTeams: 'Special Teams' },
  },
  footer: {
    title: 'Team Resources',
    links: [
      { href: '#depth-chart', label: 'Depth Chart' },
      { href: '#roster', label: 'Full Roster' },
      { href: '/vault/team/staff/', label: 'Coaching Staff' },
      { href: '/vault/team/history/', label: 'Program History' },
    ],
  },
} as const;

export const TEAM_QUICK_ACTIONS = [
  { href: '#depth-chart', icon: '📋', label: 'Depth Chart' },
  { href: '#roster', icon: '👥', label: 'Full Roster' },
  { href: '/vault/team/staff/', icon: '🏈', label: 'Coaching Staff' },
  { href: '/vault/team/history/', icon: '📜', label: 'Program History' },
] as const;

export type TeamTab = 'depth-chart' | 'roster' | 'recruiting-pipeline';

export const TEAM_TABS: { id: TeamTab; label: string }[] = [
  { id: 'depth-chart', label: 'Depth Chart' },
  { id: 'roster', label: 'Roster' },
  { id: 'recruiting-pipeline', label: 'Recruiting Pipeline' },
];
