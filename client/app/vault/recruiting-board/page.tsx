'use client';

import { useEffect } from 'react';

/** Legacy path → canonical recruiting board. */
export default function VaultRecruitingBoardRedirect(): null {
  useEffect(() => {
    window.location.replace('/vault/recruiting/board');
  }, []);
  return null;
}
