'use client';

import { useEffect } from 'react';

/** Recruiting Board merged into Recruiting Hub. */
export default function VaultRecruitingBoardPage(): null {
  useEffect(() => {
    window.location.replace('/vault/recruiting');
  }, []);
  return null;
}
