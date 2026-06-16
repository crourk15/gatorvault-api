'use client';

import { useEffect, useState } from 'react';
import { usePathname as useNextPathname } from 'next/navigation';

function readBrowserPath(): string {
  return typeof window !== 'undefined' ? window.location.pathname : '';
}

/** Prefer browser URL when Next pathname is a rewrite prefix (player slugs, nested static routes). */
function resolvePathname(nextPath: string | null, hardPath: string): string {
  const browser = readBrowserPath();
  const candidate = nextPath || hardPath || browser;
  if (!browser) return candidate;

  if (nextPath && browser.startsWith(nextPath) && browser.length > nextPath.length) {
    return browser;
  }
  if (hardPath && browser.startsWith(hardPath) && browser.length > hardPath.length) {
    return browser;
  }
  return browser || candidate;
}

/** Pathname synced with Next client router + hard navigations. */
export function usePathname(): string {
  const nextPath = useNextPathname();
  const [hardPath, setHardPath] = useState(readBrowserPath);

  useEffect(() => {
    const sync = () => setHardPath(window.location.pathname);
    sync();
    window.addEventListener('popstate', sync);
    window.addEventListener('vault:navigation', sync);
    const onPageShow = (e: PageTransitionEvent) => {
      sync();
      if (e.persisted) window.dispatchEvent(new Event('vault:pageshow-restore'));
    };
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('vault:navigation', sync);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [nextPath]);

  return resolvePathname(nextPath, hardPath);
}
