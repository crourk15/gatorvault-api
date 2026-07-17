/**
 * Capacitor static export has no Netlify SPA rewrites.
 * Catch-all shells (one index.html per family) need pushState or
 * stash-path → load shell index.html → replaceState.
 */
import {
  isBundledNativeShell,
  nativeNavigationUrl,
  normalizeNativeRoutePath,
} from '@/lib/api-base';
import { notifyVaultNavigation } from '@/lib/vault-navigation';

export const NATIVE_SPA_PENDING_KEY = 'gv_native_spa_path';

/** Shell base path (with trailing slash) for catch-all families. */
const CATCH_ALL_SHELL_RES: RegExp[] = [
  /^(\/vault\/recruiting\/player)(?:\/[^/]+)?$/,
  /^(\/vault\/futurecast\/player)(?:\/[^/]+)?$/,
  /^(\/vault\/portal\/player)(?:\/[^/]+)?$/,
  /^(\/vault\/players)(?:\/[^/]+)?$/,
  /^(\/vault\/articles)(?:\/[^/]+)?$/,
  /^(\/player)(?:\/[^/]+)?$/,
  /^(\/recruiting\/player)(?:\/[^/]+)?$/,
  /^(\/futurecast\/player)(?:\/[^/]+)?$/,
  /^(\/team\/player)(?:\/[^/]+)?$/,
];

function stripPath(pathname: string): string {
  return normalizeNativeRoutePath(pathname);
}

/** Map public `/articles/{id}` into the vault catch-all reader. */
export function resolveNativeSpaHref(href: string): string {
  try {
    const url = new URL(href, 'https://gatorvaultinsider.com');
    const path = stripPath(url.pathname);
    const art = path.match(/^\/articles\/([^/]+)$/);
    if (art?.[1] && art[1] !== 'detail') {
      const base = `/vault/articles/${encodeURIComponent(art[1])}/`;
      return `${base}${url.search}${url.hash}`;
    }
    const withSlash = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
    return `${withSlash}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}

export function nativeCatchAllShellPath(pathname: string): string | null {
  const path = stripPath(pathname);
  const art = path.match(/^\/articles\/([^/]+)$/);
  if (art?.[1] && art[1] !== 'detail') return '/vault/articles/';

  for (const re of CATCH_ALL_SHELL_RES) {
    const match = path.match(re);
    if (match?.[1]) return `${match[1]}/`;
  }
  return null;
}

/** True when href targets a dynamic segment under a catch-all shell (not the shell root). */
export function isNativeCatchAllDynamicHref(href: string): boolean {
  try {
    const resolved = resolveNativeSpaHref(href);
    const url = new URL(resolved, 'https://gatorvaultinsider.com');
    const shell = nativeCatchAllShellPath(url.pathname);
    if (!shell) return false;
    return stripPath(url.pathname) !== stripPath(shell);
  } catch {
    return false;
  }
}

export function shouldUseNativeCatchAllNav(href: string): boolean {
  return isBundledNativeShell() && isNativeCatchAllDynamicHref(href);
}

export function navigateNativeCatchAll(href: string): void {
  if (typeof window === 'undefined') return;
  const target = resolveNativeSpaHref(href);
  const shell = nativeCatchAllShellPath(target);
  if (!shell) {
    window.location.href = nativeNavigationUrl(target);
    return;
  }

  const currentShell = nativeCatchAllShellPath(window.location.pathname);
  if (currentShell && stripPath(currentShell) === stripPath(shell)) {
    window.history.pushState(null, '', target);
    notifyVaultNavigation();
    window.scrollTo(0, 0);
    return;
  }

  try {
    sessionStorage.setItem(NATIVE_SPA_PENDING_KEY, target);
  } catch {
    /* ignore quota */
  }
  window.location.href = nativeNavigationUrl(shell);
}

/** After shell index.html loads, restore the stashed deep link. */
export function consumeNativeSpaPendingPath(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const pending = sessionStorage.getItem(NATIVE_SPA_PENDING_KEY);
    if (!pending) return null;
    sessionStorage.removeItem(NATIVE_SPA_PENDING_KEY);

    const pendingShell = nativeCatchAllShellPath(pending);
    const currentShell = nativeCatchAllShellPath(window.location.pathname);
    if (pendingShell && currentShell && stripPath(pendingShell) === stripPath(currentShell)) {
      window.history.replaceState(null, '', pending);
      return pending;
    }
    if (pendingShell) {
      sessionStorage.setItem(NATIVE_SPA_PENDING_KEY, pending);
      window.location.replace(nativeNavigationUrl(pendingShell));
    }
    return null;
  } catch {
    return null;
  }
}
