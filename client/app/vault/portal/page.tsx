'use client';

import React from 'react';
import { useEffect } from 'react';

/** Portal moved into Recruiting Hub — redirect legacy route. */
export default function VaultPortalRoute(): React.ReactElement {
  useEffect(() => {
    window.location.replace('/vault/recruiting/?tab=portal');
  }, []);
  return (
    <main style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
      <p>Opening Portal in Recruiting…</p>
    </main>
  );
}
