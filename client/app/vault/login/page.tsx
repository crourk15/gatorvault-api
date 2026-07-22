'use client';

import React from 'react';
import { useEffect } from 'react';
import { replaceAuthLocation } from '@/lib/auth-api';

/** Vault login alias — preserves optional ?next= return path. */
export default function VaultLoginPage(): React.ReactElement {
  useEffect(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    replaceAuthLocation(`/join/?mode=signin${search ? `&${search.slice(1)}` : ''}`);
  }, []);
  return (
    <main style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
      <p>Opening sign in…</p>
    </main>
  );
}
