'use client';

import React from 'react';
import { useUser } from '@/hooks/useUser';
import { isVaultAdmin } from '@/lib/admin-access';
import { ToolButton } from './ToolButton';

export function ToolsBar(): React.ReactElement {
  const { user } = useUser();
  const warRoomHref = isVaultAdmin(user) ? '/vault/admin' : '/join?mode=signin&next=%2Fvault%2Fadmin';

  return (
    <footer className="rh-tools-bar" data-testid="rh-tools-sticky">
      <div className="rh-tools-bar__inner rh-frame">
        <ToolButton
          label="Depth Chart"
          href="/vault/depth-chart"
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h16v12H4V6zm2 2v8h12V8H6zm2 2h8v2H8v-2zm0 3h5v2H8v-2z" />
            </svg>
          }
        />
        <ToolButton
          label="Scouting Reports"
          href="/vault/scouting"
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 4h9l3 3v13H6V4zm2 2v10h8V8h-3V6H8zm1 3h6v2H9V9zm0 3h6v2H9v-2z" />
            </svg>
          }
        />
        <ToolButton
          label="War Room"
          href={warRoomHref}
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2 4 6v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V6l-8-4zm0 2.2 6 3v4.8c0 3.8-2.5 7.4-6 8.7-3.5-1.3-6-4.9-6-8.7V7.2l6-3z" />
            </svg>
          }
        />
      </div>
    </footer>
  );
}
