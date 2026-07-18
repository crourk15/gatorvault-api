/**
 * Normalize in-app hrefs so native catch-all routing always sees a path.
 */
import { nativeNavigationOrigin } from '@/lib/api-base';

const APP_HOSTS = new Set(['gatorvaultinsider.com', 'www.gatorvaultinsider.com', 'localhost', '127.0.0.1']);

/** Strip same-origin absolute URLs down to pathname+search+hash. Leave external links alone. */
export function toAppRelativeHref(href: string): string {
  if (!href) return href;
  if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return href;
  if (!href.startsWith('http://') && !href.startsWith('https://')) return href;
  try {
    const url = new URL(href);
    const originHost = (() => {
      try {
        return new URL(nativeNavigationOrigin()).hostname;
      } catch {
        return '';
      }
    })();
    if (APP_HOSTS.has(url.hostname) || (originHost && url.hostname === originHost)) {
      return `${url.pathname}${url.search}${url.hash}` || '/';
    }
    return href;
  } catch {
    return href;
  }
}
