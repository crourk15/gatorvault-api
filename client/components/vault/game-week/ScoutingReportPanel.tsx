'use client';

import React from 'react';
import type { ScoutingReportIntel } from '@/lib/game-week-data';

type Props = {
  scouting: ScoutingReportIntel;
};

export function ScoutingReportPanel({ scouting }: Props): React.ReactElement {
  return (
    <div data-testid="gw-scouting-report">
      <div className="gv-gw-scout-grid">
        <div className="gv-gw-scout-card">
          <h3 className="gv-gw-scout-card__title">Opponent offense</h3>
          <ul>
            {scouting.offense.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="gv-gw-scout-card">
          <h3 className="gv-gw-scout-card__title">Opponent defense</h3>
          <ul>
            {scouting.defense.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="gv-gw-scout-card">
          <h3 className="gv-gw-scout-card__title">Special teams</h3>
          <ul>
            {scouting.specialTeams.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="gv-gw-scout-summary">{scouting.matchupSummary}</div>
    </div>
  );
}
