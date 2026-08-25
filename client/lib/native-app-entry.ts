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

/** Logged-out → Sign in (App Review demo login); logged-in → vault. Create account remains on the join screen. */
export function nativeEntryDestination(): string {
  const session = loadSession();
  let rel = '/vault/';
  if (!(session?.email && session?.token)) {
    // Always Sign in on native cold start. Prior signup-default mismatched ASC notes and
    // caused App Review to paste demo creds into Create account → "unable to log in".
    rel = '/join/?mode=signin&next=/vault/';
  }
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

function isDeepVaultPath(pathname: string): boolean {
  const p = normalizeNativeRoutePath(pathname);
  if (!p.startsWith('/vault')) return false;
  // Bare /vault/ is the default home — cold start may still send sign-in vs home.
  return p !== '/vault' && p !== '/vault/';
}

/** Password setup / reset emails — never bounce these to Sign in (wipes token). */
export function isPasswordResetDeepLink(pathname?: string, search?: string): boolean {
  const path = normalizeNativeRoutePath(
    pathname || (typeof window !== 'undefined' ? window.location.pathname : '/')
  );
  const q = new URLSearchParams(
    search ?? (typeof window !== 'undefined' ? window.location.search : '')
  );
  if (path === '/reset' || path.startsWith('/reset/')) return true;
  if (path !== '/join') return false;
  const mode = q.get('mode');
  return mode === 'reset' || (mode === 'forgot' && Boolean(q.get('email') || q.get('token')));
}

/**
 * Cold start: sign-in or /vault/ home — unless a deep vault URL / universal link
 * already landed us on a real destination (film-room, recruiting, etc.).
 * Later navigations: only bounce marketing paths.
 */
export function nativeBootRedirect(): string | null {
  if (!isNativeApp()) return null;
  const path = normalizeNativeRoutePath(window.location.pathname || '/');
  const cold = takeNativeColdStart();
  if (!cold) {
    if (!isMarketingPath(path)) return null;
    return nativeEntryDestination();
  }
  // Preserve universal-link / push deep links on first paint.
  if (isDeepVaultPath(path)) return null;
  if (isPasswordResetDeepLink(path, window.location.search)) return null;
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

  // Bundled App Store shell: native-boot-script already owns capture-phase clicks.
  if (isBundledNativeShell()) return;

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

      if (isNativeCatchAllDynamicHref(raw)) {
        event.preventDefault();
        event.stopPropagation();
        navigateNativeCatchAll(raw);
        return;
      }
      if (isVaultClientNavHref(raw)) return;

      const normalized = normalizeStaticExportHref(raw);
      if (normalized !== raw || attr !== raw) {
        event.preventDefault();
        window.location.href = nativeNavigationUrl(normalized);
      }
    },
    true
  );
}
