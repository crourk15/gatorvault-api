/**
 * Vault vs standalone route helpers — final /vault/* pillar map.
 */
import { VAULT_PILLAR_ROUTES, FUTURECAST_SEGMENT_PATHS, type FutureCastSegment } from './vault-route-map';

export type VaultSectionId =
  | 'home'
  | 'recruiting'
  | 'futurecast'
  | 'team'
  | 'live-feed'
  | 'schedule'
  | 'film-room'
  | 'game-week'
  | 'live-scores'
  | 'articles'
  | 'community'
  | 'game-zone'
  | 'nil'
  | 'alerts'
  | 'apparel'
  | 'admin'
  | 'depth-chart'
  | 'players';

/** Core vault pillars — sidebar primary + mobile bottom nav. */
export const VAULT_PILLARS: { id: VaultSectionId; label: string; href: string; icon: string }[] = [
  { id: 'home', label: 'Home', href: VAULT_PILLAR_ROUTES.home, icon: '🏠' },
  { id: 'recruiting', label: 'Recruiting Hub', href: VAULT_PILLAR_ROUTES.recruiting, icon: '🎯' },
  { id: 'futurecast', label: 'FutureCast', href: VAULT_PILLAR_ROUTES.futurecast, icon: '📈' },
  { id: 'team', label: 'Team', href: VAULT_PILLAR_ROUTES.team, icon: '👥' },
  { id: 'live-feed', label: 'GatorNation Live', href: VAULT_PILLAR_ROUTES.liveFeed, icon: '⚡' },
  { id: 'schedule', label: 'Schedule & Tickets', href: VAULT_PILLAR_ROUTES.schedule, icon: '🎟️' },
];

/** Secondary vault links — drawer/sidebar only. */
export const VAULT_SECONDARY: { id: VaultSectionId; label: string; href: string; icon: string }[] = [
  { id: 'film-room', label: 'Film Room', href: '/vault/film-room', icon: '📺' },
  { id: 'game-week', label: 'Game Week', href: '/vault/game-week', icon: '🏈' },
  { id: 'live-scores', label: 'Gators Live', href: '/vault/live-scores', icon: '🏈' },
  { id: 'articles', label: 'Articles', href: '/vault/articles', icon: '📰' },
  { id: 'community', label: 'Community', href: '/vault/community', icon: '💬' },
  { id: 'game-zone', label: 'Game Zone', href: '/vault/game-zone/', icon: '🏆' },
  { id: 'nil', label: 'NIL Tracker', href: '/vault/nil', icon: '💰' },
  { id: 'alerts', label: 'My Alerts', href: '/vault/alerts', icon: '🔔' },
  { id: 'apparel', label: 'Apparel', href: '/vault/apparel', icon: '👕' },
];

/** Full sidebar = pillars + secondary (legacy export name). */
export const VAULT_SIDEBAR = [...VAULT_PILLARS, ...VAULT_SECONDARY];

/** UF Premium mobile bottom nav — Home, Recruiting, Team, GatorNation Live (+ Menu in shell). */
export const VAULT_BOTTOM_NAV: { id: VaultSectionId; label: string; href: string; icon: string }[] = [
  { id: 'home', label: 'Home', href: VAULT_PILLARS[0].href, icon: 'home' },
  { id: 'recruiting', label: 'Recruiting', href: VAULT_PILLARS[1].href, icon: 'recruiting' },
  { id: 'team', label: 'Team', href: VAULT_PILLARS[3].href, icon: 'team' },
  { id: 'live-feed', label: 'GatorNation Live', href: VAULT_PILLARS[4].href, icon: 'live' },
];

export const VAULT_MOBILE_MENU_ITEM = { id: 'menu' as const, label: 'Menu' };

export function isVaultPath(pathname?: string): boolean {
  const p =
    pathname && pathname.length > 0
      ? pathname
      : typeof window !== 'undefined'
        ? window.location.pathname
        : '';
  return p.replace(/\/$/, '').startsWith('/vault');
}

export function vaultPortalBackHref(pathname: string): string {
  if (isVaultPath(pathname)) return '/vault/recruiting/portal';
  return '/vault/recruiting/portal';
}

export function vaultPortalBackLabel(pathname: string): string {
  return isVaultPath(pathname) ? '← Recruiting Hub · Portal' : '← Portal';
}

export function vaultFutureCastBackHref(pathname: string): string {
  return isVaultPath(pathname) ? '/vault/futurecast' : '/vault/futurecast';
}

export function futureCastBase(pathname: string): '/vault/futurecast' {
  return '/vault/futurecast';
}

export function futureCastPath(pathname: string, sub = ''): string {
  const base = futureCastBase(pathname);
  if (!sub || sub === '/') return base;
  const clean = sub.replace(/^\//, '');
  return `${base}/${clean}`;
}

export type FutureCastSubId = 'master' | 'trending' | 'movement' | 'staff' | 'stock' | 'snapshots' | 'alerts';

export const FUTURECAST_SUB_PATHS: Record<FutureCastSubId, string> = {
  master: '',
  trending: 'trending',
  movement: 'movement',
  staff: 'staff',
  stock: 'stock',
  snapshots: 'snapshots',
  alerts: 'alerts',
};

export function futureCastSubHref(pathname: string, id: FutureCastSubId): string {
  if (id === 'master') return futureCastBase(pathname);
  if (id === 'trending' || id === 'movement' || id === 'staff') {
    return FUTURECAST_SEGMENT_PATHS[id];
  }
  return futureCastPath(pathname, FUTURECAST_SUB_PATHS[id]);
}

export type PlayerLifecycleApi = 'HIGH_SCHOOL' | 'PORTAL' | 'ROSTER';
