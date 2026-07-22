'use client';

import React from 'react';
import { ToolTile } from '@/components/recruiting-hub/primitives/ToolTile';

export function DeepDiveSection(): React.ReactElement {
  return (
    <section className="rh-section rh-section--panel rh-deep-dive rh-container" data-testid="rh-deep-dive-section">
      <h2 className="rh-section__title">More recruiting tools</h2>
      <div className="rh-tool-grid">
        <ToolTile
          title="Depth Chart"
          description="Roster layers, snap projections, and positional depth intel."
          href="/vault/team/#depth"
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
