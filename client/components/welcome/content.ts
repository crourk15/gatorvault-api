// client/components/welcome/content.ts — copy source of truth

export const landingContent = {
  hero: {
    headline: 'Built for Gator Nation.',
    subheadline:
      'Verified intel. Real-time updates. Elite recruiting tools for Florida fans who refuse to guess.',
    microcopy: 'Cancel anytime. Instant access.',
    tickerItems: [
      'Portal update coming at 6 PM',
      'UF trending for 2026 WR',
      'Film Room drop tonight',
    ],
  },
  systemOverview: {
    title: 'How GatorVault Works',
    lanes: [
      {
        id: 'recruiting',
        title: 'Recruiting Engine',
        bullets: [
          'Priority board with verified intel',
          'Movement tracking and portal status',
          'FutureCast probabilities for UF targets',
        ],
        icons: [
          { src: '/icons/priority-high.svg' },
          { src: '/icons/trending-up.svg' },
          { src: '/icons/lock.svg' },
        ],
      },
      {
        id: 'game-film',
        title: 'Game + Film',
        bullets: [
          'Film Room breakdowns and highlights',
          'Game Week prep and matchups',
          'Live Scores and Game Zone win probability',
        ],
        icons: [
          { src: '/icons/trending-up.svg' },
          { src: '/icons/priority-medium.svg' },
          { src: '/icons/trending-down.svg' },
        ],
      },
      {
        id: 'insider',
        title: 'Insider Layer',
        bullets: [
          'War Room chat and insider notes',
          'NIL valuations and portal tracker',
          'Insider-only live feed',
        ],
        icons: [
          { src: '/brand/badges/badge-level-3.svg' },
          { src: '/icons/priority-high.svg' },
          { src: '/icons/lock.svg' },
        ],
      },
    ],
  },
  previewStrip: {
    title: 'Inside the Vault',
    subtitle: 'See what you get before you join.',
    futurecastCaption: 'Live UF probability and predictor movement.',
    gnlEpisode: 'Latest episode · Gators Breakdown',
  },
  socialProof: {
    title: 'Trusted by Florida fans everywhere',
    stat1: { number: '24/7', label: 'Real-time updates' },
    stat2: { number: '#1', label: 'Florida recruiting hub' },
    stat3: { number: '1000s', label: 'Gator fans served' },
    chips: [
      { label: 'Verified Intel', variant: 'orange' as const },
      { label: 'FutureCast Engine', variant: 'blue' as const },
      { label: 'Film + Data', variant: 'blue' as const },
    ],
  },
  finalCta: {
    title: 'Ready to enter the Vault?',
    subtitle:
      'Join now and get instant access to recruiting intel, FutureCast, film, and insider tools.',
    primaryLabel: 'Become an Insider',
    secondaryLabel: 'Enter Vault',
  },
} as const;

export const welcomeContent = {
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
    ctas: {
      primary: 'Start Free',
      secondary: 'See Inside',
    },
    previewCards: [
      {
        title: 'FutureCast Elite',
        body: 'Trending, movement intel, staff notes, and confidence metrics.',
      },
      {
        title: 'Recruiting Hub',
        body: 'High priority targets, class rankings, portal tracker, scouting reports.',
      },
      {
        title: 'Film Room',
        body: 'Highlights, cut-ups, and staff-style player evaluations.',
      },
    ],
  },
  sections: {
    futurecast: {
      title: 'FutureCast Elite',
      subtitle: 'The most advanced recruiting engine in college football.',
      body: 'Predictive analytics, movement heatmaps, and insider-verified intel.',
      cards: [
        {
          title: 'Trending Board',
          body: 'See which recruits are heating up, cooling off, or staying steady.',
        },
        {
          title: 'Movement Intel',
          body: 'Heatmaps, movement scores, and daily trend shifts across the allow-list.',
        },
        {
          title: 'Staff Notes',
          body: 'Insider notes and confidence scores from the recruiting office.',
        },
      ],
    },
    hub: {
      title: 'Recruiting Hub',
      subtitle: 'Every recruit. Every update. One place.',
      cards: [
        {
          title: 'High Priority Targets',
          body: 'UF %, Staff %, Fit %, and Priority Score for the top targets.',
        },
        {
          title: 'Class Rankings',
          body: 'Track Florida’s class against the rest of the country in real time.',
        },
        {
          title: 'Portal Tracker',
          body: 'Live portal movement, targets, and staff interest levels.',
        },
        {
          title: 'Scouting Reports',
          body: 'Written evaluations and film-based breakdowns for key recruits.',
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
        },
        {
          title: 'Cut-Ups',
          body: 'Position-specific cut-ups for deeper evaluation.',
        },
        {
          title: 'Player Evaluations',
          body: 'Staff-style notes on fit, upside, and development curve.',
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
      ctas: {
        primary: 'Start Free',
        secondary: 'Become an Insider',
      },
      sticky: 'Start Free · Try 30 days',
    },
  },
} as const;
