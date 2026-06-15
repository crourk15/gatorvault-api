/**
 * Welcome Page (Elite) — copy source of truth
 */
export const WELCOME_COPY = {
  hero: {
    badge: 'Elite of the Elite',
    title: 'Florida Recruiting. Reimagined.',
    subtitle:
      'Real-time intel, predictive analytics, and insider access — built for the most dedicated Gator fans.',
    stats: [
      '+1,200 recruits tracked',
      'Real-time FutureCast engine',
      'Daily insider notes',
      'Portal intel & movement',
    ],
    ctaPrimary: 'Start Free',
    ctaSecondary: 'See Inside',
    preview: [
      {
        title: 'FutureCast Elite',
        body: 'Trending, movement intel, staff notes, and confidence metrics.',
        href: '/vault/futurecast',
      },
      {
        title: 'Recruiting Hub',
        body: 'High priority targets, class rankings, portal tracker, scouting reports.',
        href: '/recruiting-hub',
      },
      {
        title: 'Film Room',
        body: 'Highlights, cut-ups, and staff-style player evaluations.',
        href: '/vault/film-room',
      },
    ],
  },
  futurecast: {
    title: 'FutureCast Elite',
    subtitle: 'The most advanced recruiting engine in college football.',
    body: 'Predictive analytics, movement heatmaps, and insider-verified intel.',
    cards: [
      {
        title: 'Trending Board',
        body: 'See which recruits are heating up, cooling off, or staying steady.',
        href: '/vault/futurecast/trending',
      },
      {
        title: 'Movement Intel',
        body: 'Heatmaps, movement scores, and daily trend shifts across the allow-list.',
        href: '/vault/futurecast/movement',
      },
      {
        title: 'Staff Notes',
        body: 'Insider notes and confidence scores from the recruiting office.',
        href: '/vault/futurecast/staff',
      },
    ],
  },
  recruiting: {
    title: 'Recruiting Hub',
    subtitle: 'Every recruit. Every update. One place.',
    cards: [
      {
        title: 'High Priority Targets',
        body: 'UF %, Staff %, Fit %, and Priority Score for the top targets.',
        href: '/recruiting-hub',
      },
      {
        title: 'Class Rankings',
        body: 'Track Florida’s class against the rest of the country in real time.',
        href: '/recruiting-hub/rankings',
      },
      {
        title: 'Portal Tracker',
        body: 'Live portal movement, targets, and staff interest levels.',
        href: '/recruiting-hub/portal',
      },
      {
        title: 'Scouting Reports',
        body: 'Written evaluations and film-based breakdowns for key recruits.',
        href: '/recruiting-hub/scouting',
      },
    ],
  },
  filmRoom: {
    title: 'Film Room',
    subtitle: 'See what the staff sees.',
    body: 'Film-based evaluations for every major target.',
    cards: [
      {
        title: 'Highlights',
        body: 'Curated clips that showcase each recruit’s strengths.',
        href: '/vault/film-room',
      },
      {
        title: 'Cut-Ups',
        body: 'Position-specific cut-ups for deeper evaluation.',
        href: '/vault/film-room',
      },
      {
        title: 'Player Evaluations',
        body: 'Staff-style notes on fit, upside, and development curve.',
        href: '/vault/film-room',
      },
    ],
  },
  insider: {
    title: 'Become an Insider',
    subtitle: 'Unlock the full GatorVault experience.',
    body: 'Become an Insider. Unlock everything.',
    cards: [
      {
        title: 'FutureCast Elite',
        body: 'Full access to trending, movement intel, and confidence metrics.',
      },
      {
        title: 'Staff Notes',
        body: 'Insider notes, confidence scores, and recruiting feel.',
      },
      {
        title: 'Portal Intel',
        body: 'Live portal targets, movement, and staff interest.',
      },
      {
        title: 'Game Week & Live',
        body: 'Game-week analytics, live updates, and in-season recruiting context.',
      },
    ],
  },
  footer: {
    title: 'Ready to see inside?',
    subtitle:
      'Join GatorVault and get the most advanced Florida recruiting intel on the internet.',
    ctaPrimary: 'Start Free',
    ctaSecondary: 'Become an Insider',
  },
  sticky: 'Start Free · Try 30 days',
} as const;

export const WELCOME_LINKS = {
  join: '/join',
  vault: '/vault',
  futurecast: '/vault/futurecast',
} as const;
