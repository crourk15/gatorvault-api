/**
 * Canonical flat sitemap — top-level product routes + nav + breadcrumbs.
 */
import {
  playerProfileRoute as vaultPlayerProfileRoute,
  type PlayerProfileContext as VaultPlayerProfileContext,
} from './vault-route-map';

export type SiteSectionId =
  | 'dashboard'
  | 'recruiting'
  | 'futurecast'
  | 'team'
  | 'gatorNationLive'
  | 'schedule'
  | 'filmRoom'
  | 'gameWeek'
  | 'liveScores'
  | 'articles'
  | 'community'
  | 'gameZone'
  | 'nil';

export const SITE_ROUTES: Record<SiteSectionId, string> = {
  dashboard: '/',
  recruiting: '/recruiting',
  futurecast: '/futurecast',
  team: '/team',
  gatorNationLive: '/gator-nation-live',
  schedule: '/schedule',
  filmRoom: '/film-room',
  gameWeek: '/game-week',
  liveScores: '/live-scores',
  articles: '/articles',
  community: '/community',
  gameZone: '/game-zone',
  nil: '/nil',
};

export type TopNavItem = {
  id: SiteSectionId;
  label: string;
  href: string;
};

/** Full top navigation — all product pillars. */
export const TOP_NAV_ITEMS: TopNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: SITE_ROUTES.dashboard },
  { id: 'recruiting', label: 'Recruiting', href: SITE_ROUTES.recruiting },
  { id: 'futurecast', label: 'FutureCast', href: SITE_ROUTES.futurecast },
  { id: 'team', label: 'Team', href: SITE_ROUTES.team },
  { id: 'gatorNationLive', label: 'Gator Nation Live', href: SITE_ROUTES.gatorNationLive },
  { id: 'schedule', label: 'Schedule', href: SITE_ROUTES.schedule },
  { id: 'filmRoom', label: 'Film Room', href: SITE_ROUTES.filmRoom },
  { id: 'gameWeek', label: 'Game Week', href: SITE_ROUTES.gameWeek },
  { id: 'liveScores', label: 'Gators Live', href: SITE_ROUTES.liveScores },
  { id: 'articles', label: 'Articles', href: SITE_ROUTES.articles },
  { id: 'community', label: 'Community', href: SITE_ROUTES.community },
  { id: 'gameZone', label: 'Game Zone', href: SITE_ROUTES.gameZone },
  { id: 'nil', label: 'NIL', href: SITE_ROUTES.nil },
];

/** UF Premium mobile bottom nav — five primary flows (Menu opens app drawer). */
export const MOBILE_BOTTOM_NAV: TopNavItem[] = [
  { id: 'dashboard', label: 'Home', href: SITE_ROUTES.dashboard },
  { id: 'recruiting', label: 'Recruiting', href: SITE_ROUTES.recruiting },
  { id: 'team', label: 'Team', href: SITE_ROUTES.team },
  { id: 'gatorNationLive', label: 'GatorNation Live', href: SITE_ROUTES.gatorNationLive },
];

export const MOBILE_MENU_ITEM = { id: 'menu' as const, label: 'Menu' };

export type PlayerProfileContext = 'recruiting' | 'futurecast' | 'team';

/** Canonical vault player profile paths (recruiting hub + FutureCast live under /vault/*). */
export function playerProfileRoute(slug: string, context: PlayerProfileContext): string {
  const vaultContext: VaultPlayerProfileContext =
    context === 'team' ? 'roster' : context;
  return vaultPlayerProfileRoute(slug, vaultContext);
}

export function scheduleSeasonRoute(season: string): string {
  return `${SITE_ROUTES.schedule}/${encodeURIComponent(season)}`;
}

export function gameWeekRoute(gameId: string): string {
  return `${SITE_ROUTES.gameWeek}/${encodeURIComponent(gameId)}`;
}

export function articleRoute(articleId: string): string {
  return `${SITE_ROUTES.articles}/${encodeURIComponent(articleId)}`;
}

export function communityThreadRoute(threadId: string): string {
  // Vault hub is the member-facing surface; keep /community/thread for app aliases.
  return `/vault/community/thread/${encodeURIComponent(threadId)}`;
}

export function gameZoneRoute(gameId: string): string {
  return `${SITE_ROUTES.gameZone}/${encodeURIComponent(gameId)}`;
}

export function nilPlayerRoute(slug: string): string {
  return `${SITE_ROUTES.nil}?player=${encodeURIComponent(slug)}`;
}

function normPath(pathname: string): string {
  return pathname.replace(/\/$/, '') || '/';
}

/** Active top-nav section from pathname. */
export function siteNavActiveId(pathname: string): SiteSectionId | null {
  const p = normPath(pathname);
  if (p === '/') return 'dashboard';
  for (const item of TOP_NAV_ITEMS) {
    if (item.id === 'dashboard') continue;
    const base = item.href.replace(/\/$/, '');
    if (p === base || p.startsWith(`${base}/`)) return item.id;
  }
  return null;
}

export type BreadcrumbItem = { label: string; href?: string };

const SECTION_LABELS: Record<SiteSectionId, string> = {
  dashboard: 'Dashboard',
  recruiting: 'Recruiting',
  futurecast: 'FutureCast',
  team: 'Team',
  gatorNationLive: 'Gator Nation Live',
  schedule: 'Schedule',
  filmRoom: 'Film Room',
  gameWeek: 'Game Week',
  liveScores: 'Gators Live',
  articles: 'Articles',
  community: 'Community',
  gameZone: 'Game Zone',
  nil: 'NIL Tracker',
};

/** Breadcrumb trail for deep pages. */
export function breadcrumbTrail(pathname: string): BreadcrumbItem[] {
  const p = normPath(pathname);
  const trail: BreadcrumbItem[] = [{ label: 'Dashboard', href: SITE_ROUTES.dashboard }];

  const section = siteNavActiveId(p);
  if (!section || section === 'dashboard') return trail;

  trail.push({ label: SECTION_LABELS[section], href: SITE_ROUTES[section] });

  const playerMatch = p.match(/\/player\/([^/]+)$/);
  if (playerMatch) {
    trail.push({ label: decodeURIComponent(playerMatch[1]).replace(/-/g, ' ') });
    return trail;
  }

  const seasonMatch = p.match(/^\/schedule\/([^/]+)$/);
  if (seasonMatch) {
    trail.push({ label: `${seasonMatch[1]} Season` });
    return trail;
  }

  const gameWeekMatch = p.match(/^\/game-week\/([^/]+)$/);
  if (gameWeekMatch) {
    trail.push({ label: 'Game Detail' });
    return trail;
  }

  const articleMatch = p.match(/^\/articles\/([^/]+)$/);
  if (articleMatch) {
    trail.push({ label: 'Article' });
    return trail;
  }

  const threadMatch = p.match(/^\/community\/thread\/([^/]+)$/);
  if (threadMatch) {
    trail.push({ label: 'Thread' });
    return trail;
  }

  const gameZoneMatch = p.match(/^\/game-zone\/([^/]+)$/);
  if (gameZoneMatch) {
    trail.push({ label: 'Live Game' });
    return trail;
  }

  return trail;
}

/** Paths that require auth (mirrors vault gate). */
export function siteGateRedirect(pathname: string, loggedIn: boolean): string | null {
  if (loggedIn) return null;
  const p = normPath(pathname);
  const gated = [
    SITE_ROUTES.futurecast,
    SITE_ROUTES.recruiting,
    SITE_ROUTES.filmRoom,
  ];
  for (const base of gated) {
    if (p === base || p.startsWith(`${base}/`)) {
      const params = new URLSearchParams({ mode: 'signin', next: p });
      return `/join/?${params.toString()}`;
    }
  }
  return null;
}

/** Legacy /vault/* → flat site paths (301 targets). */
export const VAULT_TO_SITE_REDIRECTS: { from: string; to: string }[] = [
  { from: '/vault', to: '/' },
  { from: '/vault/', to: '/' },
  { from: '/vault/recruiting', to: '/recruiting' },
  { from: '/vault/recruiting/*', to: '/recruiting/:splat' },
  { from: '/vault/futurecast', to: '/futurecast' },
  { from: '/vault/futurecast/*', to: '/futurecast/:splat' },
  { from: '/vault/team', to: '/team' },
  { from: '/vault/team/*', to: '/team/:splat' },
  { from: '/vault/live', to: '/gator-nation-live' },
  { from: '/vault/live/*', to: '/gator-nation-live/:splat' },
  { from: '/vault/live-feed', to: '/gator-nation-live' },
  { from: '/vault/live-feed/*', to: '/gator-nation-live/:splat' },
  { from: '/vault/schedule', to: '/schedule' },
  { from: '/vault/schedule/*', to: '/schedule/:splat' },
  { from: '/vault/film-room', to: '/film-room' },
  { from: '/vault/film-room/*', to: '/film-room/:splat' },
  { from: '/vault/game-week', to: '/game-week' },
  { from: '/vault/game-week/*', to: '/game-week/:splat' },
  { from: '/vault/live-scores', to: '/live-scores' },
  { from: '/vault/live-scores/*', to: '/live-scores/:splat' },
  { from: '/vault/articles', to: '/articles' },
  { from: '/vault/articles/*', to: '/articles/:splat' },
  { from: '/vault/community', to: '/community' },
  { from: '/vault/community/*', to: '/community/:splat' },
  { from: '/vault/game-zone', to: '/game-zone' },
  { from: '/vault/game-zone/*', to: '/game-zone/:splat' },
  { from: '/vault/nil', to: '/nil' },
  { from: '/vault/nil/*', to: '/nil/:splat' },
  { from: '/vault/players/*', to: '/team/player/:splat' },
  { from: '/gatornation-live', to: '/gator-nation-live' },
  { from: '/gatornation-live/*', to: '/gator-nation-live/:splat' },
  { from: '/recruiting-hub', to: '/recruiting' },
  { from: '/recruiting-hub/*', to: '/recruiting/:splat' },
];
