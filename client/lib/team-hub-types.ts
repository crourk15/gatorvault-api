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

export const TEAM_COPY = {
  hero: {
    title: 'FLORIDA GATORS FOOTBALL',
    subtitle: 'Program history, culture, roster, and depth chart—one hub for Gator Nation.',
    badge: 'Updated June 2026',
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
    title: 'Full Roster',
    subtitle: 'Filter by position, class, and hometown to explore the full Florida roster.',
  },
  depthChart: {
    title: '2026 Depth Chart',
    subtitle: 'Spring projections · Updated June 2026',
    tabs: { offense: 'Offense', defense: 'Defense (3‑3‑5)', specialTeams: 'Special Teams' },
  },
  footer: {
    title: 'Team Resources',
    links: [
      { href: '#program-history', label: 'Program History' },
      { href: '#coaching-staff', label: 'Coaching Staff' },
      { href: '#roster', label: 'Full Roster' },
      { href: '#depth-chart', label: 'Depth Chart' },
    ],
  },
} as const;
