/**
 * Big Board layout — tab shell.
 * @see server/docs/futurecast-platform-spec.md §4.1
 */
import React from 'react';

export type BigBoardTabId =
  | 'top-targets'
  | 'early-discovery'
  | 'portal-watchlist'
  | 'predictions'
  | 'movement-tracker';

export default function BigBoardLayout(): React.ReactElement {
  return (
    <div data-testid="big-board-layout">
      <nav>{/* TODO(Phase 4): tab nav — spec §4.1 */}</nav>
      <main>{/* TODO: Outlet for tab routes */}</main>
    </div>
  );
}
