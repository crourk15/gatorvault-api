import {
  isBundledNativeShell,
  isNativeApp,
  nativeNavigationOrigin,
  nativeNavigationUrl,
  normalizeNativeRoutePath,
} from '@/lib/api-base';
import { loadSession } from '@/lib/auth-api';

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

  const boot = nativeBootRedirect();
  if (boot && window.location.href !== boot) {
    window.location.replace(boot);
    return;
  }

  document.addEventListener(
    'click',
    (event) => {
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!anchor) return;
      const raw = anchor.getAttribute('href');
      if (!raw) return;
      if (raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) return;
      if (raw.startsWith('http://') || raw.startsWith('https://')) return;

      if (isBundledNativeShell()) {
        event.preventDefault();
        event.stopPropagation();
        try {
          const url = new URL(raw, nativeNavigationOrigin());
          if (isMarketingPath(url.pathname)) {
            window.location.href = nativeEntryDestination();
            return;
          }
        } catch {
          /* ignore malformed href */
        }
        window.location.href = nativeNavigationUrl(normalizeStaticExportHref(raw));
        return;
      }

      try {
        const url = new URL(raw, nativeNavigationOrigin());
        const p = url.pathname.replace(/\/$/, '') || '/';
        if (isMarketingPath(p)) {
          event.preventDefault();
          window.location.href = nativeEntryDestination();
          return;
        }
      } catch {
        /* ignore malformed href */
      }

      const normalized = normalizeStaticExportHref(raw);
      if (normalized !== raw) {
        event.preventDefault();
        window.location.href = nativeNavigationUrl(normalized);
      }
    },
    true
  );
}
