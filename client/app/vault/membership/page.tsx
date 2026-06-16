'use client';

import { useEffect } from 'react';

/** Membership entry — same join flow as /join (no ?next= loop). */
export default function VaultMembershipPage(): null {
  useEffect(() => {
    window.location.replace('/join');
  }, []);
  return null;
}
