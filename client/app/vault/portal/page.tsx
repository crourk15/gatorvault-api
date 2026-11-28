'use client';

import React from 'react';
import { useEffect } from 'react';
import { FUTURECAST_LAB_ANCHORS, futureCastLabHref } from '@/lib/vault-route-map';

/** Portal Room lives on FutureCast, next to 2028 Discovery. */
export default function VaultPortalRoute(): React.ReactElement {
  useEffect(() => {
    window.location.replace(futureCastLabHref(FUTURECAST_LAB_ANCHORS.portal));
  }, []);
  return (
    <main style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
      <p>Opening Portal Room in FutureCast…</p>
    </main>
  );
}
