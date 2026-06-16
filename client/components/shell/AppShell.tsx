'use client';

import React from 'react';
import { TopNav } from '@/components/shell/TopNav';
import { MobileBottomNav } from '@/components/shell/MobileBottomNav';
import { Breadcrumbs } from '@/components/shell/Breadcrumbs';

export function AppShell({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="gv-app-shell" data-testid="app-shell">
      <TopNav />
      <Breadcrumbs />
      <main className="gv-app-shell__main">{children}</main>
      <MobileBottomNav />
    </div>
  );
}
