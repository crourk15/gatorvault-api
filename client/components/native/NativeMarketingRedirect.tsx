'use client';

import { useEffect } from 'react';
import { isNativeApp, normalizeNativeRoutePath } from '@/lib/api-base';
import { nativeEntryDestination } from '@/lib/native-app-entry';

function isMarketingPath(pathname: string): boolean {
  const p = normalizeNativeRoutePath(pathname);
  return p === '/' || p === '/welcome' || p === '/insider';
}

/** React fallback if the inline boot script missed a marketing path. */
export function NativeMarketingRedirect(): null {
  useEffect(() => {
    if (!isNativeApp()) return;
    const path = window.location.pathname || '/';
    if (!isMarketingPath(path)) return;

    const dest = nativeEntryDestination();
    if (window.location.href !== dest) window.location.replace(dest);
  }, []);

  return null;
}
