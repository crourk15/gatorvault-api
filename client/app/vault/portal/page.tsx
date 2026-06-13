'use client';

import { useEffect } from 'react';

/** Portal moved into Recruiting Hub — redirect legacy route. */
export default function VaultPortalRoute(): null {
  useEffect(() => {
    window.location.replace('/vault/recruiting?tab=portal');
  }, []);
  return null;
}
