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
  | 'recruiting-board'
  | 'staff';

/** Monolith vault overlay tabs (index.html). */
export const VAULT_MONOLITH_PATHS: Record<string, string> = {
  '/vault': 'start',
  '/vault/depth-chart': 'team',
  '/vault/recruiting': 'recruit',
  '/vault/portal': 'portal',
  '/vault/film-room': 'highlights',
  '/vault/game-week': 'gameweek',
  '/vault/live-feed': 'live',
  '/vault/staff': 'analytics',
};

export const VAULT_SIDEBAR: { id: VaultSectionId; label: string; href: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/vault', icon: '🏠' },
  { id: 'depth-chart', label: 'Depth Chart', href: '/vault/depth-chart', icon: '📋' },
  { id: 'recruiting', label: 'Recruiting', href: '/vault/recruiting', icon: '🎯' },
  { id: 'futurecast', label: 'FutureCast', href: '/vault/futurecast', icon: '📈' },
  { id: 'portal', label: 'Portal', href: '/vault/portal', icon: '🔄' },
  { id: 'film-room', label: 'Film Room', href: '/vault/film-room', icon: '📺' },
  { id: 'game-week', label: 'Game Week', href: '/vault/game-week', icon: '🏈' },
  { id: 'live-feed', label: 'Live Feed', href: '/vault/live-feed', icon: '⚡' },
  { id: 'recruiting-board', label: 'Recruiting Board', href: '/vault/recruiting-board', icon: '📊' },
  { id: 'staff', label: 'Staff', href: '/vault/staff', icon: '⚙️' },
];

export function isVaultPath(pathname: string): boolean {
  return pathname.replace(/\/$/, '').startsWith('/vault');
}

export function vaultPortalBackHref(pathname: string): string {
  if (isVaultPath(pathname)) return '/vault/portal';
  if (pathname.replace(/\/$/, '').startsWith('/portal')) return '/vault/portal';
  return '/vault/portal';
}

export function vaultPortalBackLabel(pathname: string): string {
  return '← Portal Directory';
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
