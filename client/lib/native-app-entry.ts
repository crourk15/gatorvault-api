import {
  isBundledNativeShell,
  isNativeApp,
  nativeNavigationOrigin,
  nativeNavigationUrl,
  normalizeNativeRoutePath,
} from '@/lib/api-base';
import { loadSession } from '@/lib/auth-api';

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

export function nativeBootRedirect(): string | null {
  if (!isNativeApp()) return null;
  const path = normalizeNativeRoutePath(window.location.pathname || '/');
  if (!isMarketingPath(path)) return null;
  const session = loadSession();
  const rel =
    session?.email && session?.token
      ? '/vault/'
      : '/join/?mode=signin&next=/vault/';
  return nativeNavigationUrl(rel);
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
            window.location.href = nativeBootRedirect() ?? nativeNavigationUrl('/vault/');
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
          window.location.href = nativeBootRedirect() ?? nativeNavigationUrl('/vault/');
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