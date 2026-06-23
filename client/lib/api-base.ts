import { Capacitor } from '@capacitor/core';

const PRODUCTION_SITE = 'https://gatorvaultinsider.com';

export function isNativeApp(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform();
}

/** API / site origin — native apps call production; web uses same-origin on Netlify. */
export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    if (isNativeApp()) {
      const fromEnv = process.env.NEXT_PUBLIC_API_BASE;
      return (fromEnv || PRODUCTION_SITE).replace(/\/$/, '');
    }
    const host = window.location.hostname;
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
