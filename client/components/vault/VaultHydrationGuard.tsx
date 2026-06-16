'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    __gvHydrationTimeout?: ReturnType<typeof setTimeout>;
    __gvHydrationBoot?: boolean;
  }
}

/** Marks vault root hydrated — clears data-hydrating so client nav styles apply. */
export function VaultHydrationGuard(): null {
  useEffect(() => {
    const root = document.getElementById('gv-vault-root');
    if (!root) return;

    root.setAttribute('data-gv-hydrated', 'true');
    root.removeAttribute('data-hydrating');

    if (window.__gvHydrationTimeout != null) {
      clearTimeout(window.__gvHydrationTimeout);
      window.__gvHydrationTimeout = undefined;
    }
  }, []);

  return null;
}
