'use client';

import { useEffect } from 'react';
import { isNativeApp } from '@/lib/api-base';
import { loadSession } from '@/lib/auth-api';

const SITE = 'https://gatorvaultinsider.com';

function isMarketingPath(pathname: string): boolean {
  const p = pathname.replace(/\/$/, '') || '/';
  return p === '/' || p === '/welcome' || p === '/insider';
}

/** Redirect native app away from marketing/pricing pages (React fallback if boot script missed). */
export function NativeMarketingRedirect(): null {
  useEffect(() => {
    if (!isNativeApp()) return;
    const path = window.location.pathname || '/';
    if (!isMarketingPath(path)) return;

    const session = loadSession();
    const dest =
      session?.email && session?.token
        ? `${SITE}/vault/`
        : `${SITE}/join/?mode=signin&next=/vault/`;
    if (window.location.href !== dest) window.location.replace(dest);
  }, []);

  return null;
}