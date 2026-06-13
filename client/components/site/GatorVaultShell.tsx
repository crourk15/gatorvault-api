'use client';

import React from 'react';
import { GatorVaultSiteNav } from './GatorVaultSiteNav';

export function GatorVaultShell({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="gv-site">
      <GatorVaultSiteNav />
      <main className="gv-site-main">{children}</main>
      <footer className="gv-site-footer">
        <a href="/">← Back to GatorVault</a>
      </footer>
    </div>
  );
}
