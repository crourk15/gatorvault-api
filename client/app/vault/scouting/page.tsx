'use client';

import { useEffect } from 'react';

/** Scouting Department moved into Recruiting Hub. */
export default function VaultScoutingPage(): null {
  useEffect(() => {
    window.location.replace('/vault/recruiting?tab=scouting');
  }, []);
  return null;
}
