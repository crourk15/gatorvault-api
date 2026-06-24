'use client';

import { useEffect } from 'react';

/** Vault login alias — preserves optional ?next= return path. */
export default function VaultLoginPage(): null {
  useEffect(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    window.location.replace(`/join/?mode=signin${search ? `&${search.slice(1)}` : ''}`);
  }, []);
  return null;
}
