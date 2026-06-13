'use client';

import { useEffect, useState } from 'react';

/** Client-side pathname for static export (no Next router on all routes). */
export function usePathname(): string {
  const [pathname, setPathname] = useState(
    () => (typeof window !== 'undefined' ? window.location.pathname : '')
  );

  useEffect(() => {
    const sync = () => setPathname(window.location.pathname);
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
  }, []);

  return pathname;
}
