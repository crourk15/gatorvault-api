/**
 * Final React vault route map — canonical paths under /vault/*
 * Used by routes.js, hub pages, player routing, and QA crawler config.
 */

export type RecruitingHubTab =
  | 'commits-2026'
  | 'commits-2027'
  | 'targets-2026'
  | 'targets-2027'
  | 'heat'
  | 'scouting'
  | 'portal'
  | 'intel'
  | 'rankings';

export type LiveFeedTab = 'headlines' | 'beat' | 'podcasts';

export type FilmRoomSegment = 'scheme' | 'breakdowns' | 'press' | 'highlights';

export type FutureCastSegment = 'board' | 'movement' | 'staff';

export type ScheduleSport = 'football' | 'basketball' | 'baseball';

export type PlayerProfileContext = 'recruiting' | 'futurecast' | 'roster';

/** Six vault pillars + dashboard */
export const VAULT_PILLAR_ROUTES = {
  dashboard: '/vault',
  recruiting: '/vault/recruiting',
  futurecast: '/vault/futurecast',
  team: '/vault/team',
  depthChart: '/vault/depth-chart',
  liveFeed: '/vault/live-feed',
  filmRoom: '/vault/film-room',
  schedule: '/vault/schedule',
} as const;

/** Recruiting Hub — path ↔ tab */
export const RECRUITING_TAB_PATHS: Record<RecruitingHubTab, string> = {
  'commits-2026': '/vault/recruiting/2026/commits',
  'commits-2027': '/vault/recruiting/2027/commits',
  'targets-2026': '/vault/recruiting/2026/targets',
  'targets-2027': '/vault/recruiting/2027/targets',
  heat: '/vault/recruiting/heat-check',
  scouting: '/vault/recruiting/scouting',
  portal: '/vault/recruiting/portal',
  intel: '/vault/recruiting/movement',
  rankings: '/vault/recruiting',
};

/** Live Feed tabs */
export const LIVE_FEED_TAB_PATHS: Record<LiveFeedTab, string> = {
  headlines: '/vault/live-feed/headlines',
  beat: '/vault/live-feed/beat',
  podcasts: '/vault/live-feed/podcasts',
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

/** FutureCast sub-routes */
export const FUTURECAST_SEGMENT_PATHS: Record<FutureCastSegment, string> = {
  board: '/vault/futurecast/board',
  movement: '/vault/futurecast/movement',
  staff: '/vault/futurecast/staff',
};

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
  { from: '/futurecast/*', to: '/vault/futurecast' },
  { from: '/team.html', to: '/vault/team' },
  { from: '/recruiting.html', to: '/vault/recruiting' },
  { from: '/film-room.html', to: '/vault/film-room' },
  { from: '/latest-updates.html', to: '/vault/live-feed' },
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
  { from: '/vault/recruiting-board', to: '/vault/recruiting' },
  { from: '/vault/recruiting-board/*', to: '/vault/recruiting' },
  { from: '/vault/portal/player/*', to: '/vault/recruiting/player/:splat' },
  { from: '/vault/depth-chart', to: '/vault/team' },
  { from: '/vault/depth-chart/', to: '/vault/team' },
  { from: '/vault/depth-chart/*', to: '/vault/team' },
];

function normPath(pathname: string): string {
  return pathname.replace(/\/$/, '') || '/';
}

export function parseRecruitingTabFromPath(pathname?: string): RecruitingHubTab | null {
  const p = normPath(pathname ?? (typeof window !== 'undefined' ? window.location.pathname : ''));
  for (const [tab, path] of Object.entries(RECRUITING_TAB_PATHS) as [RecruitingHubTab, string][]) {
    if (p === path || p.startsWith(`${path}/`)) return tab;
  }
  if (p === '/vault/recruiting' || p.startsWith('/vault/recruiting/player/')) {
    return 'commits-2026';
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
  return parseRecruitingTabFromPath(pathname) ?? parseRecruitingTabFromSearch() ?? 'commits-2026';
}

export function recruitingTabPath(tab: RecruitingHubTab): string {
  return RECRUITING_TAB_PATHS[tab] ?? VAULT_PILLAR_ROUTES.recruiting;
}

export function parseLiveFeedTabFromPath(pathname?: string): LiveFeedTab | null {
  const p = normPath(pathname ?? (typeof window !== 'undefined' ? window.location.pathname : ''));
  if (p.includes('/live-feed/beat')) return 'beat';
  if (p.includes('/live-feed/podcasts')) return 'podcasts';
  if (p.includes('/live-feed/headlines') || p === '/vault/live-feed') return 'headlines';
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
  if (p.includes('/film-room/scheme') || p === '/vault/film-room') return 'scheme';
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
  'vault/live-feed/index.html',
  'vault/film-room/index.html',
  'vault/schedule/index.html',
];
