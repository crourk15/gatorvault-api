'use client';

import React from 'react';
import { PublicSiteShell } from '@/components/site/PublicSiteShell';
import { NativeMarketingRedirect } from '@/components/native/NativeMarketingRedirect';
import '@/lib/operator-access.css';
import '@/lib/welcome-mobile.css';
import '@/lib/mobile-native-framework.css';

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
      <NativeMarketingRedirect />
      <div data-testid="marketing-shell">{children}</div>
    </PublicSiteShell>
  );
}
