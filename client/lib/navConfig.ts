import { loadSession, type PaymentTierId } from './auth-api';

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
  { id: 'home', label: 'Home', href: '/' },
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

/** Logged-out → welcome preview; logged-in → vault route. Sign-in preserves return path. */
export function joinHref(nextPath?: string, mode: 'signin' | 'signup' = 'signup'): string {
  const params = new URLSearchParams();
  if (mode === 'signin') params.set('mode', 'signin');
  if (nextPath && nextPath.startsWith('/')) params.set('next', nextPath);
  const q = params.toString();
  return q ? `/join/?${q}` : '/join/';
}

/**
 * Paywall unlock CTA — logged-in users go to Membership (IAP), not signup/sign-in.
 */
export function insiderUnlockHref(opts?: {
  tier?: PaymentTierId;
  returnPath?: string;
}): string {
  const tier = opts?.tier || 'film';
  let returnPath = opts?.returnPath || '/vault/';
  if (typeof window !== 'undefined' && !opts?.returnPath) {
    returnPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  }
  const session = typeof window !== 'undefined' ? loadSession() : null;
  const loggedIn = !!(session?.email?.trim() && session?.token?.trim());
  if (loggedIn) {
    const params = new URLSearchParams({ upgrade: tier });
    if (returnPath.startsWith('/')) params.set('next', returnPath);
    return `/vault/membership/?${params.toString()}`;
  }
  const params = new URLSearchParams({ tier });
  if (returnPath.startsWith('/')) params.set('next', returnPath);
  return `/join/?${params.toString()}`;
}

function joinModeForGuest(): 'signin' | 'signup' {
  if (typeof window === 'undefined') return 'signup';
  try {
    if (String(localStorage.getItem('gv_last_email') || '').trim()) return 'signin';
  } catch {
    /* ignore */
  }
  // First-time guests should Create account, not Sign in.
  return 'signup';
}

/** Logged-out → join with return path; logged-in → vault route. */
export function getVaultNavHref(key: VaultNavKey, loggedIn: boolean): string {
  const item = vaultNavPaths[key];
  if (!loggedIn) return joinHref(item.href, joinModeForGuest());
  return item.href;
}

/** Resolve nav href based on auth — logged-out users land on welcome previews. */
export function getNavHref(item: MainNavItem, loggedIn: boolean): string {
  if (item.id === 'home' || item.id === 'insider') return item.href;
  if (!loggedIn && item.previewAnchor) {
    return joinHref(item.href, joinModeForGuest());
  }
  return item.href;
}

/** Client-side equivalent of middleware vault gate (static export has no middleware). */
export function vaultGateRedirect(pathname: string, loggedIn: boolean): string | null {
  if (loggedIn) return null;
  const p = pathname.replace(/\/$/, '') || '/';
  const mode = joinModeForGuest();
  if (p.startsWith('/vault/futurecast')) return joinHref('/vault/futurecast', mode);
  if (p.startsWith('/vault/game-week')) return joinHref('/vault/game-week', mode);
  if (p.startsWith('/vault/recruiting')) return joinHref(p, mode);
  if (p.startsWith('/vault/film-room')) return joinHref('/vault/film-room', mode);
  return null;
}

export function navActiveId(pathname: string): MainNavId | null {
  const p = pathname.replace(/\/$/, '') || '/';
  if (p === '/welcome' || p === '/') return 'home';
  if (p === '/insider' || p.startsWith('/join')) return 'insider';
  if (p.startsWith('/vault/futurecast') || p.startsWith('/futurecast')) return 'futurecast';
  if (p.startsWith('/vault/game-week')) return 'filmRoom';
  if (p.startsWith('/vault/recruiting') || p.startsWith('/recruiting')) return 'recruiting';
  if (p.startsWith('/vault/film-room')) return 'filmRoom';
  if (p.startsWith('/vault')) return 'futurecast';
  return null;
}
