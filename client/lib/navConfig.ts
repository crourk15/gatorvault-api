/** Main site navigation — single source for labels and default hrefs. */
export type MainNavId = 'home' | 'futurecast' | 'recruiting' | 'filmRoom' | 'insider';

export type MainNavItem = {
  id: MainNavId;
  label: string;
  /** Logged-in default destination (and Insider tier). */
  href: string;
  /** Welcome page anchor for logged-out visitors. */
  previewAnchor?: string;
};

export const mainNav: MainNavItem[] = [
  { id: 'home', label: 'Home', href: '/welcome' },
  { id: 'futurecast', label: 'FutureCast', href: '/vault/futurecast', previewAnchor: 'futurecast-preview' },
  { id: 'recruiting', label: 'Recruiting', href: '/vault/recruiting', previewAnchor: 'recruiting-preview' },
  { id: 'filmRoom', label: 'Film Room', href: '/vault/film-room', previewAnchor: 'film-preview' },
  { id: 'insider', label: 'Insider', href: '/insider' },
];

/** Vault pillar paths keyed for NavBar getHref-style routing. */
export const vaultNavPaths = {
  futurecast: { href: '/vault/futurecast', preview: 'futurecast-preview' },
  recruiting: { href: '/vault/recruiting', preview: 'recruiting-preview' },
  filmRoom: { href: '/vault/film-room', preview: 'film-preview' },
} as const;

export type VaultNavKey = keyof typeof vaultNavPaths;

/** Logged-out → welcome preview; logged-in (free or Insider) → vault route. */
export function getVaultNavHref(key: VaultNavKey, loggedIn: boolean): string {
  const item = vaultNavPaths[key];
  if (!loggedIn) return `/welcome#${item.preview}`;
  return item.href;
}

/** Resolve nav href based on auth — logged-out users land on welcome previews. */
export function getNavHref(item: MainNavItem, loggedIn: boolean): string {
  if (item.id === 'home' || item.id === 'insider') return item.href;
  if (!loggedIn && item.previewAnchor) return `/welcome#${item.previewAnchor}`;
  return item.href;
}

/** Client-side equivalent of middleware vault gate (static export has no middleware). */
export function vaultGateRedirect(pathname: string, loggedIn: boolean): string | null {
  if (loggedIn) return null;
  const p = pathname.replace(/\/$/, '') || '/';
  if (p.startsWith('/vault/futurecast')) return '/welcome#futurecast-preview';
  if (p.startsWith('/vault/recruiting')) return '/welcome#recruiting-preview';
  if (p.startsWith('/vault/film-room')) return '/welcome#film-preview';
  return null;
}

export function navActiveId(pathname: string): MainNavId | null {
  const p = pathname.replace(/\/$/, '') || '/';
  if (p === '/welcome' || p === '/') return 'home';
  if (p === '/insider' || p.startsWith('/join')) return 'insider';
  if (p.startsWith('/vault/futurecast') || p.startsWith('/futurecast')) return 'futurecast';
  if (p.startsWith('/vault/recruiting') || p.startsWith('/recruiting')) return 'recruiting';
  if (p.startsWith('/vault/film-room')) return 'filmRoom';
  if (p.startsWith('/vault')) return 'futurecast';
  return null;
}
