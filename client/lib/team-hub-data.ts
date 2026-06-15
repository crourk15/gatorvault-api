import type { Achievement, Coach, Era, IdentityBlock } from './team-hub-types';
import {
  DEPTH_CHART_DEF,
  DEPTH_CHART_OFF,
  DEPTH_CHART_ST,
  type DepthChartRow,
  type DepthChartStatus as RowStatus,
} from './depth-chart-data';
import type { DepthChart, DepthChartPosition, DepthChartStatus } from './team-hub-types';

export const TEAM_ERAS: Era[] = [
  {
    id: 'era-70s80s',
    label: '1970–1989',
    title: 'Building The Swamp Standard',
    description:
      'Dickey and Pell transformed Florida into an SEC contender. The foundation for The Swamp mystique was laid across two decades.',
    highlights: ['Emmitt Smith era peak', 'First sustained SEC winning culture', 'Wilber Marshall defensive identity'],
  },
  {
    id: 'era-90s',
    label: '1990–2001',
    title: 'The Steve Spurrier Era',
    description:
      'Fun & Gun revolution — first national championship in 1996, four SEC titles in six years.',
    highlights: ['1996 National Championship', 'Danny Wuerffel Heisman (1996)', 'Fun & Gun legacy'],
  },
  {
    id: 'era-2000s',
    label: '2002–2009',
    title: 'Zook Transition & Meyer Dynasty',
    description:
      'Ron Zook bridged the Spurrier exit before Urban Meyer built a two-time national champion with the spread-option.',
    highlights: ['2006 & 2008 National Championships', 'Tim Tebow Heisman (2007)', 'Spread-option evolution'],
  },
  {
    id: 'era-2010s',
    label: '2010–2019',
    title: 'SEC East Dominance & Transition',
    description:
      'Muschamp, McElwain, and Mullen — elite defenses, Kyle Pitts TE revolution, SEC East titles.',
    highlights: ['2015–16 SEC East titles', 'Kyle Pitts unanimous All-American', '11-win 2019 under Mullen'],
  },
  {
    id: 'era-2020s',
    label: '2020–Present',
    title: 'Portal Era',
    description:
      'Jon Sumrall culture-first reset with Brad White 3-3-5 and portal-powered roster construction.',
    highlights: ['2026 portal-powered roster reset', 'Brad White 3-3-5 install', 'Jayden Woods JACK centerpiece'],
  },
];

export const TEAM_ACHIEVEMENTS: Achievement[] = [
  { id: 'nc', label: 'National Championships', value: '3' },
  { id: 'sec', label: 'SEC Championships', value: '8' },
  { id: 'heisman', label: 'Heisman Winners', value: '3' },
  { id: 'aam', label: 'All-Americans', value: '100+' },
  { id: 'nfl', label: 'NFL Draft Picks', value: '500+' },
  { id: 'bowl', label: 'Major Bowl Wins', value: '50+' },
  { id: 'streak', label: 'Win Streak Record', value: '20' },
  { id: 'rivalry', label: 'Rivalry Dynasties', value: '2' },
];

export const TEAM_IDENTITY: IdentityBlock[] = [
  {
    id: 'swamp',
    title: 'The Swamp',
    description:
      'One of college football’s most hostile environments—where opponents’ dreams go to die.',
  },
  {
    id: 'culture',
    title: 'Culture',
    description:
      'Relentless effort, discipline, and brotherhood—built on toughness and accountability.',
  },
  {
    id: 'traditions',
    title: 'Traditions',
    description:
      'Two Bits, Gator Walk, the Chomp, and a fan base that lives for Saturdays in the Swamp.',
  },
];

/** Fallback staff when API unavailable — matches 2026 Sumrall staff spec */
export const FALLBACK_COACHES: Omit<Coach, 'bio' | 'highlights'>[] = [
  { id: 'sumrall', initials: 'JS', name: 'Jon Sumrall', title: 'Head Coach', group: 'coaching' },
  { id: 'faulkner', initials: 'BF', name: 'Buster Faulkner', title: 'Offensive Coordinator', group: 'coaching' },
  { id: 'white', initials: 'BW', name: 'Brad White', title: 'Defensive Coordinator', group: 'coaching' },
  { id: 'chatman', initials: 'GC', name: 'Gerald Chatman', title: 'Assistant Head Coach / Defensive Line', group: 'coaching' },
  { id: 'craddock', initials: 'JC', name: 'Joe Craddock', title: 'Quarterbacks Coach', group: 'coaching' },
  { id: 'foster', initials: 'CF', name: 'Chris Foster', title: 'Running Backs Coach', group: 'coaching' },
  { id: 'mcknight', initials: 'TM', name: 'Trent McKnight', title: 'Passing Game Coordinator / Inside Wide Receivers', group: 'coaching' },
  { id: 'davis', initials: 'MD', name: 'Marcus Davis', title: 'Outside Wide Receivers Coach', group: 'coaching' },
  { id: 'mckissack', initials: 'EM', name: 'Evan McKissack', title: 'Tight Ends Coach', group: 'coaching' },
  { id: 'trautwein', initials: 'PT', name: 'Phil Trautwein', title: 'Offensive Line Coach', group: 'coaching' },
  { id: 'gasparato', initials: 'GG', name: 'Greg Gasparato', title: 'Linebackers Coach', group: 'coaching' },
  { id: 'hardmon', initials: 'BH', name: 'Bam Hardmon', title: 'Outside Linebackers Coach', group: 'coaching' },
  { id: 'harris', initials: 'BH', name: 'Brandon Harris', title: 'Cornerbacks Coach', group: 'coaching' },
  { id: 'collins', initials: 'CC', name: 'Chris Collins', title: 'Safeties Coach', group: 'coaching' },
  { id: 'galante', initials: 'JG', name: 'Johnathan Galante', title: 'Special Teams Coordinator', group: 'coaching' },
  { id: 'whitt', initials: 'RW', name: 'Rusty Whitt', title: 'Head Strength & Conditioning', group: 'coaching' },
  { id: 'donovan', initials: 'JD', name: 'John Donovan', title: 'Senior Offensive Analyst', group: 'coaching' },
  { id: 'moorer', initials: 'JM', name: 'Jared Moorer', title: 'Defensive Analyst', group: 'coaching' },
  { id: 'thompson', initials: 'JT', name: 'Joshua Thompson', title: 'Director of Football Operations', group: 'support' },
  { id: 'joaquin', initials: 'RJ', name: 'Reuel Joaquin', title: 'Video & Quality Control', group: 'support' },
  { id: 'mcgrew', initials: 'JM', name: 'Jeff McGrew', title: 'Equipment & Logistics', group: 'support' },
];

export const ROSTER_FILTER_OPTIONS = ['All', 'QB', 'RB', 'WR', 'OL', 'DL', 'LB', 'DB', 'ST'] as const;

export type RosterFilter = (typeof ROSTER_FILTER_OPTIONS)[number];

const POS_GROUPS: Record<string, string[]> = {
  QB: ['QB'],
  RB: ['RB', 'FB'],
  WR: ['WR', 'TE'],
  OL: ['OL', 'OT', 'OG', 'C', 'IOL', 'LT', 'LG', 'RG', 'RT'],
  DL: ['DL', 'DT', 'DE', 'EDGE', 'NT', 'END', 'NOSE'],
  LB: ['LB', 'MIKE', 'WILL', 'SAM', 'JACK', 'OLB', 'ILB'],
  DB: ['DB', 'CB', 'S', 'SS', 'FS', 'NB', 'STAR'],
  ST: ['K', 'P', 'LS', 'KR', 'PR'],
};

export function rosterMatchesFilter(position: string, filter: RosterFilter): boolean {
  if (filter === 'All') return true;
  const pos = position.toUpperCase();
  const group = POS_GROUPS[filter];
  return group?.some((g) => pos === g || pos.startsWith(g)) ?? false;
}

export function coachInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function mapRowStatus(s: RowStatus): DepthChartStatus {
  if (s === 'battle') return 'Battle';
  if (s === 'watch') return 'Watch';
  return 'Locked';
}

function rowToPosition(row: DepthChartRow, index: number): DepthChartPosition {
  const players: DepthChartPosition['players'] = [];
  if (row.s) {
    row.s.split('/').forEach((name, i) => {
      const yr = row.si.split('/')[i]?.trim() ?? row.si;
      players.push({ name: name.trim(), classYear: yr.trim() });
    });
  }
  if (row.b) {
    players.push({ name: row.b.trim(), classYear: row.bi.trim(), notes: 'Backup' });
  }
  if (row.third) {
    row.third.split('/').forEach((entry) => {
      const m = entry.trim().match(/^(.+?)\s*\((.+)\)$/);
      if (m) players.push({ name: m[1].trim(), classYear: m[2].trim(), notes: 'Depth' });
    });
  }
  return {
    id: `${row.pos}-${index}`,
    label: row.pos,
    status: mapRowStatus(row.status),
    players,
    analysis: row.analysis,
  };
}

export function buildDepthChart(): DepthChart {
  return {
    offense: DEPTH_CHART_OFF.map(rowToPosition),
    defense: DEPTH_CHART_DEF.map(rowToPosition),
    specialTeams: DEPTH_CHART_ST.map(rowToPosition),
  };
}

export const TEAM_DEPTH_CHART = buildDepthChart();
