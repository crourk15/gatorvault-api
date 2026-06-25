/**
 * Final React vault route map — canonical paths under /vault/*
 * Used by routes.js, hub pages, player routing, and QA crawler config.
 */

export type RecruitingHubTab =
  | 'priority'
  | 'commits-2026'
  | 'heat-check'
  | 'commits-2027'
  | 'targets-2027'
  | 'targets-2028'
  | 'intel'
  | 'scouting'
  | 'portal'
  | 'rankings';

/** @deprecated — 2026 cycle removed from hub; redirects to 2027 */
export type LegacyRecruitingTab = 'commits-2026' | 'targets-2026' | 'heat';

export type LiveFeedTab = 'headlines' | 'beat' | 'podcasts';

export type FilmRoomSegment = 'scheme' | 'breakdowns' | 'press' | 'highlights';

export type FutureCastSegment = 'master' | 'trending' | 'movement' | 'staff';

export type ScheduleSport = 'football' | 'basketball' | 'baseball';

export type PlayerProfileContext = 'recruiting' | 'futurecast' | 'roster';

/** Six vault pillars + home */
export const VAULT_PILLAR_ROUTES = {
  home: '/vault/',
  recruiting: '/vault/recruiting',
  futurecast: '/vault/futurecast',
  team: '/vault/team',
  depthChart: '/vault/depth-chart',
  liveFeed: '/vault/live',
  filmRoom: '/vault/film-room',
  schedule: '/vault/schedule',
  nil: '/vault/nil',
  articles: '/vault/articles',
  community: '/vault/community',
} as const;

/** Recruiting Hub — path ↔ tab */
export const RECRUITING_TAB_PATHS: Record<RecruitingHubTab, string> = {
  priority: '/vault/recruiting/priority',
  'commits-2026': '/vault/recruiting/2026/commits',
  'heat-check': '/vault/recruiting/heat-check',
  'commits-2027': '/vault/recruiting/2027/commits',
  'targets-2027': '/vault/recruiting/2027/targets',
  'targets-2028': '/vault/recruiting/2028/targets',
  intel: '/vault/recruiting/movement',
  scouting: '/vault/recruiting/scouting',
  portal: '/vault/recruiting/portal',
  rankings: '/vault/recruiting/rankings',
};

/** Alternate hub base (same tabs, different URL prefix) */
export const RECRUITING_HUB_BASE = '/recruiting-hub';

/** Legacy paths → current tab (2026 cycle retired → 2027) */
export const RECRUITING_LEGACY_PATH_ALIASES: Record<string, RecruitingHubTab> = {
  '/vault/recruiting': 'commits-2027',
  '/vault/recruiting/2026/commits': 'commits-2026',
  '/vault/recruiting/2026/targets': 'targets-2027',
  '/vault/recruiting/heat-check': 'intel',
  [RECRUITING_HUB_BASE]: 'commits-2027',
  [`${RECRUITING_HUB_BASE}/2026/commits`]: 'commits-2026',
  [`${RECRUITING_HUB_BASE}/2026/targets`]: 'targets-2027',
  [`${RECRUITING_HUB_BASE}/heat-check`]: 'intel',
};

/** Map deprecated tab ids to active hub tabs. */
export function normalizeRecruitingTab(tab: RecruitingHubTab): RecruitingHubTab {
  if (tab === 'heat-check') return 'intel';
  return tab;
}

/** Live Feed tabs */
export const LIVE_FEED_TAB_PATHS: Record<LiveFeedTab, string> = {
  headlines: '/vault/live/headlines',
  beat: '/vault/live/beat',
  podcasts: '/vault/live/podcasts',
};

/** Film Room segments → hub category label */
export const FILM_ROOM_SEGMENT_HUB: Record<FilmRoomSegment, string> = {
  scheme: 'Offensive Scheme',
  breakdowns: 'Film Breakdown',
  press: 'UF Press Conferences',
  highlights: 'Highlights',
};

export const FILM_ROOM_SEGMENT_PATHS: Record<FilmRoomSegment, string> = {
  scheme: '/vault/film-room/scheme',
  breakdowns: '/vault/film-room/breakdowns',
  press: '/vault/film-room/press',
  highlights: '/vault/film-room/highlights',
};

/** Canonical FutureCast Lab section anchor IDs on /vault/futurecast */
export const FUTURECAST_LAB_ANCHORS = {
  overview: 'overview',
  masterBoard: 'master-board',
  visits: 'visits',
  trending: 'trending',
  signals: 'signals',
  movement: 'movement',
  positions: 'positions',
  portal: 'portal',
  feed: 'feed',
} as const;

export type FutureCastLabAnchor = (typeof FUTURECAST_LAB_ANCHORS)[keyof typeof FUTURECAST_LAB_ANCHORS];

/** Deep-link helper: `/vault/futurecast#<anchor>` */
export function futureCastLabHref(anchor: FutureCastLabAnchor): string {
  return `/vault/futurecast#${anchor}`;
}

/** FutureCast sub-routes (single page + hash sections) */
export const FUTURECAST_SEGMENT_PATHS: Record<FutureCastSegment, string> = {
  master: futureCastLabHref(FUTURECAST_LAB_ANCHORS.masterBoard),
  trending: futureCastLabHref(FUTURECAST_LAB_ANCHORS.trending),
  movement: futureCastLabHref(FUTURECAST_LAB_ANCHORS.movement),
  staff: futureCastLabHref(FUTURECAST_LAB_ANCHORS.signals),
};

/** Jump links for unified FutureCast Lab command center */
export const FUTURECAST_LAB_SECTIONS = [
  { id: FUTURECAST_LAB_ANCHORS.overview, href: futureCastLabHref(FUTURECAST_LAB_ANCHORS.overview), shortLabel: 'Overview' },
  { id: FUTURECAST_LAB_ANCHORS.masterBoard, href: futureCastLabHref(FUTURECAST_LAB_ANCHORS.masterBoard), shortLabel: 'Targets' },
  { id: FUTURECAST_LAB_ANCHORS.visits, href: futureCastLabHref(FUTURECAST_LAB_ANCHORS.visits), shortLabel: 'Visits' },
  { id: FUTURECAST_LAB_ANCHORS.trending, href: futureCastLabHref(FUTURECAST_LAB_ANCHORS.trending), shortLabel: 'Battles' },
  { id: FUTURECAST_LAB_ANCHORS.signals, href: futureCastLabHref(FUTURECAST_LAB_ANCHORS.signals), shortLabel: 'Signals' },
  { id: FUTURECAST_LAB_ANCHORS.movement, href: futureCastLabHref(FUTURECAST_LAB_ANCHORS.movement), shortLabel: 'Movement' },
  { id: FUTURECAST_LAB_ANCHORS.positions, href: futureCastLabHref(FUTURECAST_LAB_ANCHORS.positions), shortLabel: 'Positions' },
  { id: FUTURECAST_LAB_ANCHORS.portal, href: futureCastLabHref(FUTURECAST_LAB_ANCHORS.portal), shortLabel: 'Portal' },
  { id: FUTURECAST_LAB_ANCHORS.feed, href: futureCastLabHref(FUTURECAST_LAB_ANCHORS.feed), shortLabel: 'Feed' },
] as const;

/** Legacy fc-* hash aliases → segment (backward compatible deep links) */
const FUTURECAST_HASH_SEGMENT: Record<string, FutureCastSegment> = {
  [FUTURECAST_LAB_ANCHORS.overview]: 'master',
  [FUTURECAST_LAB_ANCHORS.masterBoard]: 'master',
  [FUTURECAST_LAB_ANCHORS.trending]: 'trending',
  [FUTURECAST_LAB_ANCHORS.movement]: 'movement',
  [FUTURECAST_LAB_ANCHORS.signals]: 'staff',
  'fc-hero': 'master',
  'fc-master': 'master',
  'fc-trending': 'trending',
  'fc-movement': 'movement',
  'fc-signals': 'staff',
};

/** Legacy board path → trending */
export const FUTURECAST_LEGACY_PATH_ALIASES: Record<string, FutureCastSegment> = {
  '/vault/futurecast/board': 'master',
  '/vault/futurecast/heat-check': 'movement',
};

export function parseFutureCastSegmentFromPath(pathname?: string, hash?: string): FutureCastSegment {
  const p = normPath(pathname ?? (typeof window !== 'undefined' ? window.location.pathname : ''));
  const h = (hash ?? (typeof window !== 'undefined' ? window.location.hash.slice(1) : '')).replace(/^#/, '');

  if (h && FUTURECAST_HASH_SEGMENT[h]) {
    return FUTURECAST_HASH_SEGMENT[h];
  }

  if (p in FUTURECAST_LEGACY_PATH_ALIASES) {
    return FUTURECAST_LEGACY_PATH_ALIASES[p];
  }
  if (p.includes('/futurecast/trending') || p.includes('/trending-board')) return 'trending';
  if (p.includes('/futurecast/movement') || p.includes('/movement-intel')) return 'movement';
  if (p.includes('/futurecast/staff') || p.includes('/staff-notes')) return 'staff';
  if (p.includes('/master-board')) return 'master';
  return 'master';
}

/** Schedule & tickets */
export const SCHEDULE_SPORT_PATHS: Record<ScheduleSport, string> = {
  football: '/vault/schedule/football',
  basketball: '/vault/schedule/basketball',
  baseball: '/vault/schedule/baseball',
};

/** Global player profile routes */
export function playerProfileRoute(slug: string, context: PlayerProfileContext): string {
  const safe = encodeURIComponent(slug);
  switch (context) {
    case 'roster':
      return `/vault/players/${safe}`;
    case 'recruiting':
      return `/vault/recruiting/player/${safe}`;
    case 'futurecast':
    default:
      return `/vault/futurecast/player/${safe}`;
  }
}

/** Legacy routes → 301 targets */
export const LEGACY_ROUTE_REDIRECTS: { from: string; to: string }[] = [
  { from: '/futurecast', to: '/vault/futurecast' },
  { from: '/futurecast/', to: '/vault/futurecast' },
  { from: '/vault/recruiting-hub', to: '/vault/recruiting' },
  { from: '/vault/recruiting-hub/', to: '/vault/recruiting' },
  { from: '/vault/recruiting-hub/*', to: '/vault/recruiting/:splat' },
  { from: '/team.html', to: '/vault/team' },
  { from: '/recruiting.html', to: '/vault/recruiting' },
  { from: '/recruiting-hub.html', to: '/recruiting-hub' },
  { from: '/film-room.html', to: '/vault/film-room' },
  { from: '/latest-updates.html', to: '/vault/live' },
  { from: '/portal.html', to: '/vault/recruiting/portal' },
  { from: '/vault/tickets', to: '/vault/schedule' },
  { from: '/vault/tickets/', to: '/vault/schedule' },
  { from: '/vault/tickets/*', to: '/vault/schedule' },
  { from: '/vault/portal', to: '/vault/recruiting/portal' },
  { from: '/vault/portal/', to: '/vault/recruiting/portal' },
  { from: '/vault/portal/*', to: '/vault/recruiting/portal' },
  { from: '/vault/scouting', to: '/vault/recruiting/scouting' },
  { from: '/vault/scouting/', to: '/vault/recruiting/scouting' },
  { from: '/vault/scouting/*', to: '/vault/recruiting/scouting' },
  { from: '/vault/recruiting-board', to: '/vault/recruiting/board' },
  { from: '/vault/recruiting-board/*', to: '/vault/recruiting/board' },
  { from: '/vault/portal/player/*', to: '/vault/recruiting/player/:splat' },
  { from: '/vault/live-feed', to: '/vault/live' },
  { from: '/vault/live-feed/', to: '/vault/live' },
  { from: '/vault/live-feed/*', to: '/vault/live' },
  { from: '/vault/depth-chart', to: '/vault/team' },
  { from: '/vault/depth-chart/', to: '/vault/team' },
  { from: '/vault/depth-chart/*', to: '/vault/team' },
];

function normPath(pathname: string): string {
  return pathname.replace(/\/$/, '') || '/';
}

export function parseRecruitingTabFromPath(pathname?: string): RecruitingHubTab | null {
  const p = normPath(pathname ?? (typeof window !== 'undefined' ? window.location.pathname : ''));
  if (p in RECRUITING_LEGACY_PATH_ALIASES) {
    return RECRUITING_LEGACY_PATH_ALIASES[p];
  }
  for (const [tab, path] of Object.entries(RECRUITING_TAB_PATHS) as [RecruitingHubTab, string][]) {
    const altPath = path.replace('/vault/recruiting', RECRUITING_HUB_BASE);
    if (p === path || p.startsWith(`${path}/`) || p === altPath || p.startsWith(`${altPath}/`)) {
      return tab;
    }
  }
  if (p.startsWith('/vault/recruiting/player/') || p.startsWith(`${RECRUITING_HUB_BASE}/player/`)) {
    return 'commits-2027';
  }
  return null;
}

export function parseRecruitingTabFromSearch(): RecruitingHubTab | null {
  if (typeof window === 'undefined') return null;
  const t = new URLSearchParams(window.location.search).get('tab');
  if (t && t in RECRUITING_TAB_PATHS) return t as RecruitingHubTab;
  return null;
}

export function resolveRecruitingTab(pathname?: string): RecruitingHubTab {
  const p = normPath(pathname ?? (typeof window !== 'undefined' ? window.location.pathname : ''));
  const fromSearch = parseRecruitingTabFromSearch();
  const fromPath = parseRecruitingTabFromPath(pathname);
  if ((p === '/vault/recruiting' || p === RECRUITING_HUB_BASE) && fromSearch) {
    return normalizeRecruitingTab(fromSearch);
  }
  const resolved = fromPath ?? fromSearch ?? 'commits-2027';
  return normalizeRecruitingTab(resolved);
}

export function recruitingTabPath(tab: RecruitingHubTab, pathname?: string): string {
  const vaultPath = RECRUITING_TAB_PATHS[tab] ?? VAULT_PILLAR_ROUTES.recruiting;
  const p = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  if (normPath(p).startsWith(RECRUITING_HUB_BASE)) {
    return vaultPath.replace('/vault/recruiting', RECRUITING_HUB_BASE);
  }
  return vaultPath;
}

export function parseLiveFeedTabFromPath(pathname?: string): LiveFeedTab | null {
  const p = normPath(pathname ?? (typeof window !== 'undefined' ? window.location.pathname : ''));
  if (p.includes('/live/beat') || p.includes('/live-feed/beat')) return 'beat';
  if (p.includes('/live/podcasts') || p.includes('/live-feed/podcasts')) return 'podcasts';
  if (
    p.includes('/live/headlines') ||
    p === '/vault/live' ||
    p.includes('/live-feed/headlines') ||
    p === '/vault/live-feed'
  ) {
    return 'headlines';
  }
  return null;
}

export function liveFeedTabPath(tab: LiveFeedTab): string {
  return LIVE_FEED_TAB_PATHS[tab];
}

export function parseFilmRoomSegmentFromPath(pathname?: string): FilmRoomSegment | null {
  const p = normPath(pathname ?? (typeof window !== 'undefined' ? window.location.pathname : ''));
  if (p.includes('/film-room/breakdowns')) return 'breakdowns';
  if (p.includes('/film-room/press')) return 'press';
  if (p.includes('/film-room/highlights')) return 'highlights';
  if (p.includes('/film-room/scheme')) return 'scheme';
  return null;
}

export function filmRoomHubFromSegment(seg: FilmRoomSegment): string {
  return FILM_ROOM_SEGMENT_HUB[seg];
}

/** Static exports required after client build + merge */
export const REQUIRED_VAULT_EXPORTS = [
  'index.html',
  'vault/index.html',
  'vault/recruiting/index.html',
  'vault/futurecast/index.html',
  'vault/futurecast/player/index.html',
  'vault/recruiting/player/index.html',
  'vault/team/index.html',
  'vault/players/index.html',
  'vault/live/index.html',
  'vault/live-feed/index.html',
  'vault/film-room/index.html',
  'vault/schedule/index.html',
  'vault/admin/index.html',
];
