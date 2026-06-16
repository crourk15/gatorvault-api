'use client';

import React from 'react';
import { PublicSiteShell } from '@/components/site/PublicSiteShell';

/**
 * Marketing routes (/ and /welcome) — PublicSiteShell only.
 * Must NOT use (app)/layout.tsx (AppShell + MobileBottomNav).
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <PublicSiteShell marketing>
      <div data-testid="marketing-shell">{children}</div>
    </PublicSiteShell>
  );
}
