'use client';

import { useEffect, useState } from 'react';

/** Client-side pathname for static export (no Next router on all routes). */
export function usePathname(): string {
  const [pathname, setPathname] = useState('');

  useEffect(() => {
    setPathname(window.location.pathname);
    const onNav = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onNav);
    return () => window.removeEventListener('popstate', onNav);
  }, []);

  return pathname;
}
