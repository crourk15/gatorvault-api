'use client';

import React from 'react';
import { useUser } from '@/hooks/useUser';
import { isVaultAdmin } from '@/lib/admin-access';
import { ToolTile } from '@/components/recruiting-hub/primitives/ToolTile';

export function DeepDiveSection(): React.ReactElement {
  const { user } = useUser();
  const warRoomHref = isVaultAdmin(user) ? '/vault/admin' : '/join?mode=signin&next=%2Fvault%2Fadmin';
  const warRoomLocked = !isVaultAdmin(user);

  return (
    <section className="rh-section rh-container" data-testid="rh-deep-dive-section">
      <h2 className="rh-section__title">War Room &amp; Tools</h2>
      <div className="rh-tool-grid">
        <ToolTile
          title="Depth Chart"
          description="Roster layers, snap projections, and positional depth intel."
          href="/vault/depth-chart"
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h16v12H4V6zm2 2v8h12V8H6zm2 2h8v2H8v-2zm0 3h5v2H8v-2z" />
            </svg>
          }
        />
        <ToolTile
          title="Scouting Reports"
          description="Film grades, eval notes, and staff confidence scores."
          href="/vault/scouting"
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 4h9l3 3v13H6V4zm2 2v10h8V8h-3V6H8zm1 3h6v2H9V9zm0 3h6v2H9v-2z" />
            </svg>
          }
        />
        <ToolTile
          title="War Room"
          description="Admin-only ops dashboard — predictions, alerts, staff intel."
          href={warRoomHref}
          locked={warRoomLocked}
          cta="Enter →"
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2 4 6v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V6l-8-4zm0 2.2 6 3v4.8c0 3.8-2.5 7.4-6 8.7-3.5-1.3-6-4.9-6-8.7V7.2l6-3z" />
            </svg>
          }
        />
        <ToolTile
          title="Florida Recruiting Resources"
          description="Board exports, visit calendar, and insider reference hub."
          href="/vault/recruiting/board"
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 5h16v2H4V5zm0 6h10v2H4v-2zm0 6h14v2H4v-2z" />
            </svg>
          }
        />
      </div>
    </section>
  );
}
