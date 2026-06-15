'use client';

import React from 'react';
import { NavBar } from '@/components/NavBar';

/** @deprecated Use NavBar directly — thin wrapper for existing imports. */
export function GatorVaultSiteNav(props: { marketing?: boolean }): React.ReactElement {
  return <NavBar {...props} />;
}
