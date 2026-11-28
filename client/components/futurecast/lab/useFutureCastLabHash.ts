'use client';

import { useEffect, useState } from 'react';

/** Live FutureCast lab hash without the leading #. */
export function useFutureCastLabHash(): string {
  const [hash, setHash] = useState(() =>
    typeof window === 'undefined' ? '' : String(window.location.hash || '').replace(/^#/, '')
  );

  useEffect(() => {
    const sync = () => setHash(String(window.location.hash || '').replace(/^#/, ''));
    sync();
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  return hash;
}
