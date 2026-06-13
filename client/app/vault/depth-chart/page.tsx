'use client';

import { useEffect } from 'react';

/** Depth chart lives inside Team — redirect legacy route. */
export default function VaultDepthChartRoute(): null {
  useEffect(() => {
    window.location.replace('/vault/team');
  }, []);
  return null;
}
