/**
 * Programmatic in-vault navigation that respects Capacitor catch-all shells.
 * Never use raw window.location.href for /vault/.../player/:slug — missing
 * static files fall through to marketing `/` on the native WebView.
 */
import { isNativeApp, nativeNavigationUrl } from '@/lib/api-base';
import { navigateNativeCatchAll, shouldUseNativeCatchAllNav } from '@/lib/native-spa-nav';

export function navigateVaultHref(href: string): void {
  if (typeof window === 'undefined' || !href) return;
  if (shouldUseNativeCatchAllNav(href)) {
    navigateNativeCatchAll(href);
    return;
  }
  window.location.href = isNativeApp() ? nativeNavigationUrl(href) : href;
}
