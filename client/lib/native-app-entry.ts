import { isNativeApp } from '@/lib/api-base';
import { loadSession } from '@/lib/auth-api';

export function normalizeStaticExportHref(href: string): string {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return href;
  }
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  try {
    const url = new URL(href, 'https://gatorvaultinsider.com');
    let path = url.pathname || '/';
    const last = path.split('/').filter(Boolean).pop() ?? '';
    if (!last.includes('.') && !path.endsWith('/')) path = `${path}/`;
    return `${path}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}

export function nativeBootRedirect(): string | null {
  if (!isNativeApp()) return null;
  const path = (window.location.pathname || '/').replace(/\/$/, '') || '/';
  if (path !== '/' && path !== '/welcome') return null;
  const session = loadSession();
  if (session?.email && session?.token) return '/vault/';
  return '/join/?mode=signin&next=/vault/';
}

export function runNativeAppEntry(): void {
  if (!isNativeApp()) return;
  const boot = nativeBootRedirect();
  if (boot) {
    const here = `${window.location.pathname}${window.location.search}`;
    if (here !== boot) {
      window.location.replace(boot);
      return;
    }
  }
  document.addEventListener(
    'click',
    (event) => {
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!anchor) return;
      const raw = anchor.getAttribute('href');
      if (!raw) return;
      const normalized = normalizeStaticExportHref(raw);
      if (normalized !== raw) {
        event.preventDefault();
        window.location.href = normalized;
      }
    },
    true
  );
}
