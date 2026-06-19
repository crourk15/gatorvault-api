'use client';

import React from 'react';
import { TopNav } from '@/components/shell/TopNav';
import { MobileBottomNav } from '@/components/shell/MobileBottomNav';
import { Breadcrumbs } from '@/components/shell/Breadcrumbs';
import { AppMenuProvider } from '@/components/shell/AppMenuContext';
import { AppMenuDrawer } from '@/components/shell/AppMenuDrawer';
import { LivePulseFab } from '@/components/shell/LivePulseFab';

export function AppShell({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <AppMenuProvider>
      <div className="gv-app-shell" data-testid="app-shell">
        <TopNav />
        <Breadcrumbs />
        <main className="gv-app-shell__main">{children}</main>
        <MobileBottomNav />
        <AppMenuDrawer />
        <LivePulseFab />
      </div>
    </AppMenuProvider>
  );
}
