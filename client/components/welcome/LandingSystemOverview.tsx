'use client';

import React from 'react';

export function LandingSystemOverview(): React.ReactElement {
  return (
    <section className="gv-system" data-testid="welcome-value-proposition">
      <div className="gv-system-container">
        <h2 className="gv-system-title">How GatorVault Works</h2>

        <div className="gv-system-lane">
          <h3 className="gv-system-lane-title">Recruiting Engine</h3>
          <ul className="gv-system-list">
            <li>Priority board with verified intel</li>
            <li>Movement tracking + portal status</li>
            <li>FutureCast probabilities for UF targets</li>
          </ul>
        </div>

        <div className="gv-system-lane">
          <h3 className="gv-system-lane-title">Game + Film</h3>
          <ul className="gv-system-list">
            <li>Film Room breakdowns + highlights</li>
            <li>Game Week prep + matchups</li>
            <li>Live Scores + Game Zone analytics</li>
          </ul>
        </div>

        <div className="gv-system-lane">
          <h3 className="gv-system-lane-title">Insider Layer</h3>
          <ul className="gv-system-list">
            <li>War Room chat + insider notes</li>
            <li>NIL valuations + portal tracker</li>
            <li>Insider-only live feed</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
