'use client';

import React from 'react';
import { ToolButton } from './ToolButton';

export function ToolsBar(): React.ReactElement {
  return (
    <footer className="rh-tools-bar" data-testid="rh-tools-sticky">
      <div className="rh-tools-bar__inner rh-frame">
        <ToolButton
          label="Depth Chart"
          href="/vault/team/#depth"
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
      </div>
    </footer>
  );
}
