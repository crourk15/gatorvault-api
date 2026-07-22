/**
 * Programmatic in-vault navigation that respects Capacitor catch-all shells.
 * Never use raw window.location.href for /vault/.../player/:slug — missing
 * static files fall through to marketing `/` on the native WebView.
 */
import { isNativeApp, nativeNavigationUrl } from '@/lib/api-base';
import { toAppRelativeHref } from '@/lib/app-href';
import { vaultPathFromOpenUrl } from '@/lib/native-deep-link';
import {
  isNativeCatchAllDynamicHref,
  navigateNativeCatchAll,
  shouldUseNativeCatchAllNav,
} from '@/lib/native-spa-nav';
import { isVaultClientNavHref } from '@/lib/vault-nav-utils';

type SoftNavHandler = (href: string) => boolean;

let softNavHandler: SoftNavHandler | null = null;

/** VaultNavigationProvider registers Next router.push for in-shell soft nav. */
export function registerVaultSoftNav(handler: SoftNavHandler): () => void {
  softNavHandler = handler;
  return () => {
    if (softNavHandler === handler) softNavHandler = null;
  };
}

function requestVaultSoftNav(href: string): boolean {
  return softNavHandler?.(href) ?? false;
}

export function navigateVaultHref(href: string): void {
  if (typeof window === 'undefined' || !href) return;
  // Push payloads often send absolute https://gatorvaultinsider.com/vault/...
  const fromOpen = vaultPathFromOpenUrl(href);
  const path = fromOpen || toAppRelativeHref(href);
  if (path.startsWith('http://') || path.startsWith('https://')) {
    window.location.href = path;
    return;
  }
  if (shouldUseNativeCatchAllNav(path) || (isNativeApp() && isNativeCatchAllDynamicHref(path))) {
    navigateNativeCatchAll(path);
    return;
  }
  // Everyday vault boards: soft-nav when the shell router is mounted.
  if (isVaultClientNavHref(path) && requestVaultSoftNav(path)) {
    return;
  }
  window.location.href = isNativeApp() ? nativeNavigationUrl(path) : path;
}
