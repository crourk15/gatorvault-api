/** Program history eras (condensed from gv-team-mobile.js). */

export type TeamEra = {
  id: string;
  label: string;
  title: string;
  summary: string;
  highlights: string[];
};

export const TEAM_ERAS: TeamEra[] = [
  {
    id: 'era-70s80s',
    label: '1970–1989',
    title: 'Building The Swamp Standard',
    summary: 'Dickey and Pell transformed Florida into an SEC contender. The foundation for The Swamp mystique was laid across two decades.',
    highlights: ['Emmitt Smith era peak', 'First sustained SEC winning culture', 'Wilber Marshall defensive identity'],
  },
  {
    id: 'era-90s',
    label: '1990–2001',
    title: 'The Steve Spurrier Era',
    summary: 'Fun & Gun revolution — first national championship in 1996, four SEC titles in six years.',
    highlights: ['1996 National Championship', 'Danny Wuerffel Heisman (1996)', 'Fun & Gun legacy'],
  },
  {
    id: 'era-2000s',
    label: '2002–2009',
    title: 'Meyer Dynasty',
    summary: 'Urban Meyer built a two-time national champion with the spread-option and Tim Tebow.',
    highlights: ['2006 & 2008 National Championships', 'Tim Tebow Heisman (2007)', 'Spread-option evolution'],
  },
  {
    id: 'era-2010s',
    label: '2010–2019',
    title: 'SEC East Dominance & Transition',
    summary: 'Muschamp, McElwain, and Mullen — elite defenses, Kyle Pitts TE revolution, SEC East titles.',
    highlights: ['2015–16 SEC East titles', 'Kyle Pitts unanimous All-American', '11-win 2019 under Mullen'],
  },
  {
    id: 'era-2020s',
    label: '2020–Present',
    title: 'Portal Era & Sumrall Reset',
    summary: 'Jon Sumrall culture-first reset with Brad White 3-3-5 and portal-powered roster construction.',
    highlights: ['2026 portal-powered roster reset', 'Brad White 3-3-5 install', 'Jayden Woods JACK centerpiece'],
  },
];
