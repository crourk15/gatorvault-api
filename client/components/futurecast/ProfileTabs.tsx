/**
 * Player Profile 2.0 tab shell.
 * @see server/docs/futurecast-platform-spec.md §4.2
 */
import React, { useState } from 'react';

export type ProfileTabId = 'high-school' | 'college' | 'portal' | 'war-room';

export function ProfileTabs(): React.ReactElement {
  const [tab, setTab] = useState<ProfileTabId>('high-school');
  // TODO(Phase 4): load player graph from GET /api/players/:id
  return (
    <div data-testid="profile-tabs">
      <nav>
        {(['high-school', 'college', 'portal', 'war-room'] as ProfileTabId[]).map((id) => (
          <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id}>
            {id}
          </button>
        ))}
      </nav>
      <section>{/* TODO: tab panels — spec §4.2 */}Active: {tab}</section>
    </div>
  );
}
