'use client';

import { useEffect, useState } from 'react';

/** True after client mount — use before reading localStorage/window. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}
