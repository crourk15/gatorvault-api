import { isNativeApp } from '@/lib/api-base';
import { loadSession } from '@/lib/auth-api';

const SITE = 'https://gatorvaultinsider.com';

export function normalizeStaticExportHref(href: string): string {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return href;
  }
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  try {
    const url = new URL(href, SITE);
    let path = url.pathname || '/';
    const last = path.split('/').filter(Boolean).pop() ?? '';
    if (!last.includes('.') && !path.endsWith('/')) path = `${path}/`;
    return `${path}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}

function toAbsolute(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return new URL(path, SITE).href;
}

function isMarketingPath(pathname: string): boolean {
  const p = pathname.replace(/\/$/, '') || '/';
  return p === '/' || p === '/welcome' || p === '/insider';
}

export function nativeBootRedirect(): string | null {
  if (!isNativeApp()) return null;
  const path = (window.location.pathname || '/').replace(/\/$/, '') || '/';
  if (!isMarketingPath(path)) return null;
  const session = loadSession();
  const rel =
    session?.email && session?.token
      ? '/vault/'
      : '/join/?mode=signin&next=/vault/';
  return toAbsolute(rel);
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

      try {
        const url = new URL(raw, SITE);
        const p = url.pathname.replace(/\/$/, '') || '/';
        if (isMarketingPath(p)) {
          event.preventDefault();
          window.location.href = nativeBootRedirect() ?? toAbsolute('/vault/');
          return;
        }
      } catch {
        /* ignore malformed href */
      }

      const normalized = normalizeStaticExportHref(raw);
      if (normalized !== raw) {
        event.preventDefault();
        window.location.href = toAbsolute(normalized);
      }
    },
    true
  );
}