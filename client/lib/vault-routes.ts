/**
 * Vault vs standalone route helpers.
 * Inside Vault → /vault/* ; public FutureCast → /futurecast/*
 */
export type VaultSectionId =
  | 'dashboard'
  | 'recruiting'
  | 'futurecast'
  | 'team'
  | 'live-feed'
  | 'tickets'
  | 'film-room'
  | 'game-week'
  | 'live-scores'
  | 'articles'
  | 'community'
  | 'game-zone'
  | 'nil'
  | 'alerts'
  | 'apparel'
  | 'depth-chart'
  | 'portal'
  | 'players'
  | 'recruiting-board'
  | 'scouting'
  | 'staff';

/** Core vault pillars — sidebar primary + mobile bottom nav. */
export const VAULT_PILLARS: { id: VaultSectionId; label: string; href: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/vault', icon: '🏠' },
  { id: 'recruiting', label: 'Recruiting Hub', href: '/vault/recruiting', icon: '🎯' },
  { id: 'futurecast', label: 'FutureCast', href: '/vault/futurecast', icon: '📈' },
  { id: 'team', label: 'Team', href: '/vault/team', icon: '👥' },
  { id: 'live-feed', label: 'Live Feed', href: '/vault/live-feed', icon: '⚡' },
  { id: 'tickets', label: 'Schedule & Tickets', href: '/vault/tickets', icon: '🎟️' },
];

/** Secondary vault links — drawer/sidebar only. */
export const VAULT_SECONDARY: { id: VaultSectionId; label: string; href: string; icon: string }[] = [
  { id: 'film-room', label: 'Film Room', href: '/vault/film-room', icon: '📺' },
  { id: 'game-week', label: 'Game Week', href: '/vault/game-week', icon: '🏈' },
  { id: 'live-scores', label: 'Live Scores', href: '/vault/live-scores', icon: '📊' },
  { id: 'articles', label: 'Articles', href: '/vault/articles', icon: '📰' },
  { id: 'community', label: 'Community', href: '/vault/community', icon: '💬' },
  { id: 'game-zone', label: 'Game Zone', href: '/vault/game-zone', icon: '🏆' },
  { id: 'nil', label: 'NIL Tracker', href: '/vault/nil', icon: '💰' },
  { id: 'alerts', label: 'My Alerts', href: '/vault/alerts', icon: '🔔' },
  { id: 'apparel', label: 'Apparel', href: '/vault/apparel', icon: '👕' },
];

/** Full sidebar = pillars + secondary (legacy export name). */
export const VAULT_SIDEBAR = [...VAULT_PILLARS, ...VAULT_SECONDARY];

/** Mobile bottom nav — core pillars only (no dashboard to keep 5 slots). */
export const VAULT_BOTTOM_NAV = VAULT_PILLARS.filter((item) => item.id !== 'dashboard');

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
  if (isVaultPath(pathname)) return '/vault/recruiting?tab=portal';
  return '/portal';
}

export function vaultPortalBackLabel(pathname: string): string {
  return isVaultPath(pathname) ? '← Recruiting Hub · Portal' : '← Portal';
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
