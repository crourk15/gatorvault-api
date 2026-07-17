'use client';

import { useEffect } from 'react';
import { replaceAuthLocation } from '@/lib/auth-api';

/** Vault login alias — preserves optional ?next= return path. */
export default function VaultLoginPage(): null {
  useEffect(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    replaceAuthLocation(`/join/?mode=signin${search ? `&${search.slice(1)}` : ''}`);
  }, []);
  return null;
}
