'use client';

import { useEffect, useState } from 'react';
import { usePathname as useNextPathname } from 'next/navigation';

/** Pathname synced with Next client router + hard navigations. */
export function usePathname(): string {
  const nextPath = useNextPathname();
  const [hardPath, setHardPath] = useState(
    () => (typeof window !== 'undefined' ? window.location.pathname : '')
  );

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
  }, []);

  return nextPath || hardPath;
}
