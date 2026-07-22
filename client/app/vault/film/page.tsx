'use client';

import React from 'react';
import { useEffect } from 'react';

/** Short path alias for Film Room. */
export default function VaultFilmAlias(): React.ReactElement {
  useEffect(() => {
    window.location.replace('/vault/film-room/');
  }, []);
  return (
    <main style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
      <p>Opening Film Room…</p>
    </main>
  );
}
