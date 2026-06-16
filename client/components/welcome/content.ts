// client/components/welcome/content.ts — copy source of truth

export const landingContent = {
  heroHeadline: 'Built for Gator Nation.',
  heroSubheadline: 'Verified intel. Real-time updates. Elite recruiting tools.',
  features: {
    recruiting: 'Verified intel, movement tracking, and priority board updates.',
    futurecast: 'UF probability, Fit Score, predictor movement, and trend analysis.',
    gnl: 'Daily shows, headlines, and real-time reactions.',
    filmroom: 'Breakdowns, highlights, and press conferences — all in one place.',
  },
  socialProof: {
    stat1: { number: '24/7', label: 'Real-time updates' },
    stat2: { number: '#1', label: 'Florida recruiting hub' },
    stat3: { number: '1000s', label: 'of Gator fans served' },
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
