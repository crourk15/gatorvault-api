import React from 'react';
import { TeamSection } from './TeamSection';

export function TeamRoster(): React.ReactElement {
  return (
    <TeamSection title="Roster" description="Vault-rated 2026 roster · filter by position">
      <div id="gv-team-roster-filters" className="gv-mteam-roster-filters" />
      <div id="gv-team-roster-list" className="gv-team-roster-grid" />
    </TeamSection>
  );
}
