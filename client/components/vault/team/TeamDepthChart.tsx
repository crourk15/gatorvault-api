'use client';

import React from 'react';
import { TeamSection } from './TeamSection';

export function TeamDepthChart(): React.ReactElement {
  return (
    <TeamSection
      id="gv-team-dc-section"
      className="gv-team-dc-wrap"
      title="2026 Depth Chart"
      description="OTA / summer intel · Updated July 2026"
      headerExtra={
        <div className="gv-team-dc-legend">
          <span className="gv-team-dc-legend-pill gv-team-dc-legend-pill--locked">🟢 Locked</span>
          <span className="gv-team-dc-legend-pill gv-team-dc-legend-pill--battle">🟡 Battle</span>
          <span className="gv-team-dc-legend-pill gv-team-dc-legend-pill--watch">🔴 Watch</span>
        </div>
      }
    >
      <div className="gv-team-dc-phase-tabs">
        <button
          type="button"
          className="dctbtn active"
          data-phase="off"
          data-dc-root="team"
        >
          ⚔️ Offense
        </button>
        <button type="button" className="dctbtn" data-phase="def" data-dc-root="team">
          🛡️ Defense 3-3-5
        </button>
        <button type="button" className="dctbtn" data-phase="st" data-dc-root="team">
          ⚡ Special Teams
        </button>
      </div>
      <div id="gv-team-dc-off" className="active dc-phase gv-team-dc-grid" />
      <div id="gv-team-dc-def" className="dc-phase gv-team-dc-grid" style={{ display: 'none' }} />
      <div id="gv-team-dc-st" className="dc-phase gv-team-dc-grid" style={{ display: 'none' }} />
    </TeamSection>
  );
}
