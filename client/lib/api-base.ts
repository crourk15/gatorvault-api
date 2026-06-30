const PRODUCTION_SITE = 'https://gatorvaultinsider.com';

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

/** Bundled Capacitor shell (cap sync) — not Next dev server on :3000. */
export function isBundledNativeShell(): boolean {
  if (typeof window === 'undefined') return false;
  const { protocol, hostname, port } = window.location;
  if (protocol.startsWith('capacitor:')) return true;
  if ((hostname === 'localhost' || hostname === '127.0.0.1') && port !== '3000') return true;
  return false;
}

/** True in Capacitor WebView — reads injected runtime, no @capacitor/core import. */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.Capacitor?.isNativePlatform?.() === true) return true;
  return isBundledNativeShell();
}

/** Origin for in-app navigation — bundled shell stays on capacitor://localhost paths. */
export function nativeNavigationOrigin(): string {
  if (typeof window === 'undefined') return PRODUCTION_SITE;
  const host = window.location.hostname;
  if (host === 'gatorvaultinsider.com' || host === 'www.gatorvaultinsider.com') {
    return window.location.origin;
  }
  if (isBundledNativeShell() || isNativeApp()) return window.location.origin;
  return PRODUCTION_SITE;
}

export function nativeNavigationUrl(path: string): string {
  if (!path) return `${nativeNavigationOrigin()}/`;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return new URL(path, nativeNavigationOrigin()).href;
}

/** API / site origin — native WebView on gatorvaultinsider.com uses same-origin /api proxy. */
export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'gatorvaultinsider.com' || host === 'www.gatorvaultinsider.com') {
      return '';
    }
    if (isNativeApp()) {
      // Always proxy through gatorvaultinsider.com — same as web (avoids cold Render + CORS in WebView).
      return PRODUCTION_SITE.replace(/\/$/, '');
    }
    const port = window.location.port;
    if ((host === 'localhost' || host === '127.0.0.1') && port === '3000') {
      return 'http://localhost:3000';
    }
    return '';
  }
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return '';
}
