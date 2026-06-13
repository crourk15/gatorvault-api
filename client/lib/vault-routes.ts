/**
 * Vault vs standalone route helpers.
 * Inside Vault → /vault/* ; public FutureCast → /futurecast/*
 */
export type VaultSectionId =
  | 'dashboard'
  | 'depth-chart'
  | 'recruiting'
  | 'futurecast'
  | 'portal'
  | 'film-room'
  | 'game-week'
  | 'live-feed'
  | 'live-scores'
  | 'players'
  | 'recruiting-board'
  | 'scouting'
  | 'articles'
  | 'community'
  | 'game-zone'
  | 'nil'
  | 'alerts'
  | 'tickets'
  | 'apparel'
  | 'staff';

export const VAULT_SIDEBAR: { id: VaultSectionId; label: string; href: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/vault', icon: '🏠' },
  { id: 'depth-chart', label: 'Depth Chart', href: '/vault/depth-chart', icon: '📋' },
  { id: 'recruiting', label: 'Recruiting', href: '/vault/recruiting', icon: '🎯' },
  { id: 'futurecast', label: 'FutureCast', href: '/vault/futurecast', icon: '📈' },
  { id: 'portal', label: 'Portal', href: '/vault/portal', icon: '🔄' },
  { id: 'film-room', label: 'Film Room', href: '/vault/film-room', icon: '📺' },
  { id: 'game-week', label: 'Game Week', href: '/vault/game-week', icon: '🏈' },
  { id: 'live-feed', label: 'Live Feed', href: '/vault/live-feed', icon: '⚡' },
  { id: 'live-scores', label: 'Live Scores', href: '/vault/live-scores', icon: '📊' },
  { id: 'articles', label: 'Articles', href: '/vault/articles', icon: '📰' },
  { id: 'community', label: 'Community', href: '/vault/community', icon: '💬' },
  { id: 'game-zone', label: 'Game Zone', href: '/vault/game-zone', icon: '🏆' },
  { id: 'nil', label: 'NIL Tracker', href: '/vault/nil', icon: '💰' },
  { id: 'players', label: 'Players', href: '/vault/players', icon: '👤' },
  { id: 'scouting', label: 'War Room', href: '/vault/scouting', icon: '🔭' },
  { id: 'recruiting-board', label: 'Recruiting Board', href: '/vault/recruiting-board', icon: '📊' },
  { id: 'alerts', label: 'My Alerts', href: '/vault/alerts', icon: '🔔' },
  { id: 'tickets', label: 'Tickets', href: '/vault/tickets', icon: '🎟️' },
  { id: 'apparel', label: 'Apparel', href: '/vault/apparel', icon: '👕' },
  { id: 'staff', label: 'Movement Intel', href: '/vault/futurecast/staff', icon: '📡' },
];

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
  if (isVaultPath(pathname)) return '/vault/portal';
  return '/portal';
}

export function vaultPortalBackLabel(pathname: string): string {
  return isVaultPath(pathname) ? '← Portal Directory' : '← Portal';
}

export function vaultFutureCastBackHref(pathname: string): string {
  return isVaultPath(pathname) ? '/vault/futurecast' : '/futurecast';
}

export function futureCastBase(pathname: string): '/futurecast' | '/vault/futurecast' {
  return isVaultPath(pathname) ? '/vault/futurecast' : '/futurecast';
}

export function futureCastPath(pathname: string, sub = ''): string {
  const base = futureCastBase(pathname);
  if (!sub || sub === '/') return base;
  const clean = sub.replace(/^\//, '');
  return `${base}/${clean}`;
}

export type FutureCastSubId = 'home' | 'stock' | 'snapshots' | 'alerts' | 'staff';

export const FUTURECAST_SUB_PATHS: Record<FutureCastSubId, string> = {
  home: '',
  stock: 'stock',
  snapshots: 'snapshots',
  alerts: 'alerts',
  staff: 'staff',
};

export function futureCastSubHref(pathname: string, id: FutureCastSubId): string {
  const sub = FUTURECAST_SUB_PATHS[id];
  return sub ? futureCastPath(pathname, sub) : futureCastBase(pathname);
}

export type PlayerLifecycleApi = 'HIGH_SCHOOL' | 'PORTAL' | 'ROSTER';
