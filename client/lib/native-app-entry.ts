import {
  isBundledNativeShell,
  isNativeApp,
  nativeNavigationOrigin,
  nativeNavigationUrl,
  normalizeNativeRoutePath,
} from '@/lib/api-base';
import { ensureSessionHydrated, loadSession } from '@/lib/auth-api';
import { toAppRelativeHref } from '@/lib/app-href';
import {
  consumeNativeSpaPendingPath,
  isNativeCatchAllDynamicHref,
  navigateNativeCatchAll,
} from '@/lib/native-spa-nav';
import { isVaultClientNavHref } from '@/lib/vault-nav-utils';

const NATIVE_COLD_START_KEY = 'gv_native_cold_done';

export function normalizeStaticExportHref(href: string): string {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return href;
  }
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  try {
    const url = new URL(href, nativeNavigationOrigin());
    let path = url.pathname || '/';
    const last = path.split('/').filter(Boolean).pop() ?? '';
    if (!last.includes('.') && !path.endsWith('/')) path = `${path}/`;
    return `${path}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}

function isMarketingPath(pathname: string): boolean {
  const p = normalizeNativeRoutePath(pathname);
  return p === '/' || p === '/welcome' || p === '/insider';
}

/** Logged-out → sign-in; logged-in → vault home. */
export function nativeEntryDestination(): string {
  const session = loadSession();
  const rel =
    session?.email && session?.token
      ? '/vault/'
      : '/join/?mode=signin&next=/vault/';
  return nativeNavigationUrl(rel);
}

/** True once per WebView process (cleared when iOS kills the app). */
export function takeNativeColdStart(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(NATIVE_COLD_START_KEY)) return false;
    sessionStorage.setItem(NATIVE_COLD_START_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Cold start: always sign-in or /vault/ home (do not restore Recruiting).
 * Later navigations: only bounce marketing paths.
 */
export function nativeBootRedirect(): string | null {
  if (!isNativeApp()) return null;
  const path = normalizeNativeRoutePath(window.location.pathname || '/');
  const cold = takeNativeColdStart();
  if (!cold && !isMarketingPath(path)) return null;
  return nativeEntryDestination();
}

export function runNativeAppEntry(): void {
  if (!isNativeApp()) return;

  void ensureSessionHydrated().then(() => {
    const boot = nativeBootRedirect();
    if (boot && window.location.href !== boot) {
      window.location.replace(boot);
      return;
    }
    if (isBundledNativeShell()) {
      consumeNativeSpaPendingPath();
    }
  });

  document.addEventListener(
    'click',
    (event) => {
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!anchor) return;
      const attr = anchor.getAttribute('href');
      if (!attr) return;
      if (attr.startsWith('#') || attr.startsWith('mailto:') || attr.startsWith('tel:')) return;

      // Same-origin absolute URLs must still hit catch-all player routing.
      const raw = toAppRelativeHref(attr);
      if (raw.startsWith('http://') || raw.startsWith('https://')) return;

      if (isBundledNativeShell()) {
        try {
          const url = new URL(raw, nativeNavigationOrigin());
          if (isMarketingPath(url.pathname)) {
            event.preventDefault();
            event.stopPropagation();
            void ensureSessionHydrated().then(() => {
              window.location.href = nativeEntryDestination();
            });
            return;
          }
        } catch {
          /* ignore malformed href */
        }
        // Deep catch-all routes have no per-slug index.html — every player slug.
        if (isNativeCatchAllDynamicHref(raw)) {
          event.preventDefault();
          event.stopPropagation();
          navigateNativeCatchAll(raw);
          return;
        }
        // Other vault SPA boards — let VaultNavigationProvider / Next Link soft-nav.
        if (isVaultClientNavHref(raw)) return;
        event.preventDefault();
        event.stopPropagation();
        window.location.href = nativeNavigationUrl(normalizeStaticExportHref(raw));
        return;
      }

      try {
        const url = new URL(raw, nativeNavigationOrigin());
        const p = url.pathname.replace(/\/$/, '') || '/';
        if (isMarketingPath(p)) {
          event.preventDefault();
          void ensureSessionHydrated().then(() => {
            window.location.href = nativeEntryDestination();
          });
          return;
        }
      } catch {
        /* ignore malformed href */
      }

      const normalized = normalizeStaticExportHref(raw);
      if (normalized !== raw || attr !== raw) {
        event.preventDefault();
        window.location.href = nativeNavigationUrl(normalized);
      }
    },
    true
  );
}
