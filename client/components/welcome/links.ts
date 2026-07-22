/** Navigation targets for Welcome Page CTAs and preview cards. */
export const WELCOME_LINKS = {
  join: '/join',
  signIn: '/join?mode=signin',
  insider: '/insider',
  vault: '/vault/',
  futurecast: '/vault/futurecast/',
  recruiting: '/vault/recruiting/',
  recruitingHub: '/vault/recruiting/',
  filmRoom: '/vault/film-room/',
  gatorNationLive: '/vault/live/',
} as const;

export const WELCOME_CARD_HREFS: Record<string, string> = {
  'FutureCast Elite': WELCOME_LINKS.futurecast,
  'Recruiting Hub': WELCOME_LINKS.recruitingHub,
  'Film Room': WELCOME_LINKS.filmRoom,
  'Trending Board': '/vault/futurecast#trending',
  'Movement Intel': '/vault/futurecast#movement',
  'Staff Notes': '/vault/futurecast#signals',
  'High Priority Targets': WELCOME_LINKS.recruitingHub,
  'Class Rankings': '/vault/recruiting/?tab=rankings',
  'Portal Tracker': '/vault/recruiting/?tab=portal',
  'Scouting Reports': '/vault/recruiting/?tab=scouting',
  Highlights: WELCOME_LINKS.filmRoom,
  'Cut-Ups': WELCOME_LINKS.filmRoom,
  'Player Evaluations': WELCOME_LINKS.filmRoom,
};

export function welcomeCardHref(title: string): string | undefined {
  return WELCOME_CARD_HREFS[title];
}
