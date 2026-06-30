const PRODUCTION_SITE = 'https://gatorvaultinsider.com';

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

/** True in Capacitor WebView — reads injected runtime, no @capacitor/core import. */
export function isNativeApp(): boolean {
  return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;
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
