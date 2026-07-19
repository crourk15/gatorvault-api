/**
 * Full mobile verification matrix — every vault route + section that must hydrate.
 * Used by verify-full-mobile-app.js (Playwright, JS enabled).
 */
const BOTTOM_NAV = [
  { id: 'home', path: '/vault/', label: 'Home' },
  { id: 'recruiting', path: '/vault/recruiting/', label: 'Recruiting' },
  { id: 'team', path: '/vault/team/', label: 'Team' },
  { id: 'live', path: '/vault/live/', label: 'Gator Nation Live' },
];

/** Menu overflow + account/media routes (vault shell). */
const MENU_ROUTES = [
  { id: 'futurecast', path: '/vault/futurecast/', label: 'FutureCast' },
  { id: 'schedule', path: '/vault/schedule/', label: 'Schedule' },
  { id: 'film-room', path: '/vault/film-room/', label: 'Film Room' },
  { id: 'game-week', path: '/vault/game-week/', label: 'Game Week' },
  { id: 'live-scores', path: '/vault/live-scores/', label: 'Live Scores' },
  { id: 'articles', path: '/vault/articles/', label: 'Articles' },
  { id: 'community', path: '/vault/community/', label: 'Community' },
  { id: 'game-zone', path: '/vault/game-zone/', label: 'Game Zone' },
  { id: 'nil', path: '/vault/nil/', label: 'NIL' },
  { id: 'podcasts', path: '/vault/live/podcasts/', label: 'Podcasts (GNL)' },
  { id: 'apparel', path: '/vault/apparel/', label: 'Shop & Apparel' },
  { id: 'membership', path: '/vault/membership/', label: 'Membership' },
  { id: 'alerts', path: '/vault/alerts/', label: 'My Alerts' },
  { id: 'tickets', path: '/vault/tickets/', label: 'Schedule (tickets alias)', fallback: '/vault/schedule/' },
];

/** Text that must never persist after settle on any page. */
const GLOBAL_FORBIDDEN = [
  'Waking up GatorVault',
  'Minified React error #423',
  'Application error: a client-side exception has occurred',
];

/** Per-route checks after hydration settle. */
const ROUTE_CHECKS = {
  home: {
    root: '[data-testid="vault-home-premium"], [data-testid="vault-home-mobile"], [data-testid="vault-home"]',
    minBodyText: 400,
    sections: [
      { sel: '[data-testid="home-command-hero"], [data-testid="home-premium-hero"]', label: 'Home hero', minText: 20 },
      { sel: '[data-testid="home-beat-highlights"]', label: 'Beat intel', minText: 40 },
      { sel: '[data-testid="home-gnl-preview"], [data-testid="home-command-strip"], [data-testid="home-live-media"]', label: 'GNL / live strip', minText: 20 },
      { sel: '[data-testid="home-futurecast-preview"], [data-testid="home-futurecast-pulse"]', label: 'FutureCast / movement preview', minText: 15 },
      { sel: '[data-testid="home-gameday-countdown"], [data-testid="home-command-strip"]', label: 'GameDay / command strip', minText: 15 },
    ],
    testMenu: true,
  },
  recruiting: {
    root: '[data-testid="vault-recruiting-hub"]',
    minBodyText: 500,
    sections: [
      { sel: '[data-hydrate="hero"], .gv-rh-elite-hero, [data-testid="rh-elite-hero"]', label: 'Recruiting hero', minText: 20 },
      { sel: '[data-testid="rh-class-cards"]', label: 'Class cards', minText: 40 },
      { sel: '[data-testid^="rh-elite-commit-board"]', label: 'Commit class', minText: 40 },
      { sel: '[data-testid="rh-signing-day-tracker"], [data-testid^="rh-elite-commit-board"]', label: 'NSD / commits', minText: 20 },
      { sel: '[data-testid="rh-elite-movement-feed"]', label: 'Movement feed', minText: 25, noSkeleton: true },
      { sel: '[data-testid="rh-elite-battle-board"]', label: 'Battle board', minText: 20, noSkeleton: true },
      { sel: '[data-testid="rh-elite-footprint"]', label: 'Footprint map', minText: 20, noSkeleton: true },
      { sel: '[data-testid="rh-elite-position-snapshot"]', label: 'Position snapshot', minText: 20, noSkeleton: true },
    ],
    testMenu: true,
  },
  team: {
    root: '[data-testid="vault-team"], .gv-team-page',
    minBodyText: 400,
    forbidden: ['Loading roster…'],
    sections: [
      { sel: '[data-testid="team-mobile-header"], [data-testid="team-premium-hero"]', label: 'Team header', minText: 20 },
      { sel: '[data-section="roster"]', label: 'Roster section', minText: 40 },
      { sel: '[data-section="depth-chart"]', label: 'Depth chart', minText: 20 },
      { sel: '[data-section="coaching-staff"]', label: 'Coaching staff', minText: 20 },
      { sel: '[data-section="recruiting-pipeline"]', label: 'Recruiting pipeline', minText: 15 },
    ],
    testMenu: true,
  },
  live: {
    root: '[data-testid="vault-live-feed"], .gv-live-feed, [data-testid="gnl-page-hero"]',
    minBodyText: 200,
    sections: [
      {
        sel: '[data-testid="gnl-page-hero"], [data-testid="vault-live-feed"], .gv-live-feed',
        label: 'Live feed shell',
        minText: 30,
      },
    ],
    testMenu: true,
  },
  futurecast: {
    root: '[data-testid="fc-lab-page-mobile"], [data-testid="futurecast-home"], [data-testid="fc-page-layout"]',
    minBodyText: 200,
    forbidden: ['[data-testid="fc-elite-loading"][aria-busy="true"]'],
    sections: [
      { sel: '[data-testid="fc-lab-hero"], [data-testid="fc-elite-hero"], [data-testid="fc-page-hero"]', label: 'FutureCast hero', minText: 20 },
      { sel: '[data-testid="fc-lab-live-feed"], [data-testid="futurecast-feed"], [data-testid="fc-master-board"]', label: 'FutureCast content', minText: 30 },
    ],
  },
  schedule: {
    root: '[data-testid="schedule-hero"], [data-testid="vault-schedule"], .gv-schedule-page',
    minBodyText: 150,
    sections: [
      {
        sel: '[data-testid="schedule-hero"], [data-testid="vault-schedule"]:not(.gv-vault-ssr-marker)',
        label: 'Schedule page',
        minText: 40,
      },
    ],
  },
  'film-room': {
    root: '[data-testid="vault-film-room"]:not(.gv-vault-ssr-marker), .gv-film-room:not(.gv-vault-ssr-marker)',
    minBodyText: 150,
    sections: [
      {
        sel: '[data-testid="vault-film-room"]:not(.gv-vault-ssr-marker):not([hidden])',
        label: 'Film Room',
        minText: 30,
      },
    ],
  },
  'game-week': {
    root: '.gv-game-week, [data-testid="vault-game-week"]',
    minBodyText: 100,
    sections: [{ sel: 'body', label: 'Game Week body', minText: 80 }],
  },
  'live-scores': {
    root: '.gv-live-scores, [data-testid="vault-live-scores"]',
    minBodyText: 100,
    sections: [{ sel: 'body', label: 'Live Scores body', minText: 80 }],
  },
  articles: {
    root: '[data-testid="insider-articles-page"], .gv-articles, [data-testid="vault-articles"]',
    minBodyText: 100,
    sections: [{ sel: '[data-testid="insider-articles-page"], body', label: 'Articles body', minText: 80 }],
  },
  community: {
    root: '.gv-community, [data-testid="vault-community"]',
    minBodyText: 100,
    sections: [{ sel: 'body', label: 'Community body', minText: 80 }],
  },
  'game-zone': {
    root: '.gv-game-zone, [data-testid="vault-game-zone"]',
    minBodyText: 100,
    sections: [{ sel: 'body', label: 'Game Zone body', minText: 80 }],
  },
  nil: {
    root: '[data-testid="vault-nil"]',
    minBodyText: 150,
    sections: [{ sel: '[data-testid="vault-nil"]', label: 'NIL page', minText: 50 }],
  },
  podcasts: {
    root: '[data-testid="vault-live-feed"], [data-testid="gnl-page-hero"], [data-testid="gnl-podcast-spotlight"]',
    minBodyText: 150,
    sections: [
      {
        sel: '[data-testid="gnl-podcast-spotlight"], [data-testid="gnl-page-hero"], [data-testid="vault-live-feed"]',
        label: 'Podcasts / GNL',
        minText: 30,
      },
    ],
  },
  apparel: {
    root: '[data-testid="vault-apparel"]',
    minBodyText: 80,
    sections: [{ sel: '[data-testid="vault-apparel"]', label: 'Apparel shop', minText: 30 }],
  },
  membership: {
    redirect: '/join',
    root: 'body',
    minBodyText: 80,
    sections: [{ sel: 'body', label: 'Membership → Join', minText: 40 }],
  },
  alerts: {
    root: '[data-testid="vault-alerts"]',
    minBodyText: 80,
    sections: [{ sel: '[data-testid="vault-alerts"]', label: 'Alerts page', minText: 40 }],
  },
  tickets: {
    root: '[data-testid="schedule-hero"], [data-testid="vault-schedule"], [data-testid="vault-tickets"]',
    minBodyText: 150,
    sections: [
      {
        sel: '[data-testid="schedule-hero"], [data-testid="vault-schedule"]:not(.gv-vault-ssr-marker), [data-testid="vault-tickets"]',
        label: 'Tickets page',
        minText: 40,
      },
    ],
  },
};

const ALL_ROUTES = [...BOTTOM_NAV, ...MENU_ROUTES.filter((r) => !BOTTOM_NAV.some((b) => b.id === r.id))];

module.exports = {
  BOTTOM_NAV,
  MENU_ROUTES,
  ALL_ROUTES,
  ROUTE_CHECKS,
  GLOBAL_FORBIDDEN,
};
