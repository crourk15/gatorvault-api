'use client';

import React from 'react';
import { GatorVaultSiteNav } from '@/components/site/GatorVaultSiteNav';

export function PublicSiteShell({
  children,
  marketing = false,
}: {
  children: React.ReactNode;
  marketing?: boolean;
}): React.ReactElement {
  return (
    <div className={`gv-site${marketing ? ' gv-site--marketing' : ''}`}>
      <GatorVaultSiteNav marketing={marketing} />
      <main className={marketing ? 'gv-marketing-main' : 'gv-site-main'}>{children}</main>
      {!marketing && (
        <footer className="gv-site-footer">
          <a href="/">← Back to GatorVault</a>
        </footer>
      )}
    </div>
  );
}
