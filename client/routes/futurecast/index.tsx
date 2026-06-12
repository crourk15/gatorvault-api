/**
 * FutureCast route hub.
 * @see server/docs/futurecast-platform-spec.md §4.1 — FutureCast Big Board
 */
import React from 'react';

// TODO(Phase 4): React Router outlet → /futurecast/big-board
export default function FutureCastIndex(): React.ReactElement {
  return (
    <div data-testid="futurecast-index">
      <h1>FutureCast Big Board</h1>
      <p>TODO: route to big-board tabs — spec §4.1</p>
    </div>
  );
}
