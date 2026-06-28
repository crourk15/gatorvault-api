'use client';

import React from 'react';

export function LandingSystemOverview(): React.ReactElement {
  return (
    <section className="gv-system" data-testid="welcome-value-proposition">
      <div className="gv-system-container">
        <h2 className="gv-system-title">How GatorVault Works</h2>

        <div className="gv-system-lane">
          <h3 className="gv-system-lane-title">Locker Room — your hub</h3>
          <ul className="gv-system-list">
            <li>Recruiting board + 2027 targets</li>
            <li>Portal tracker + visit intel</li>
            <li>NIL snapshot + live feed</li>
          </ul>
        </div>

        <div className="gv-system-lane">
          <h3 className="gv-system-lane-title">Film Room — FutureCast</h3>
          <ul className="gv-system-list">
            <li>UF probabilities + movement intel</li>
            <li>Fit scores + staff notes</li>
            <li>Film breakdowns + Game Week prep</li>
          </ul>
        </div>

        <div className="gv-system-lane">
          <h3 className="gv-system-lane-title">Built for the cycle</h3>
          <ul className="gv-system-list">
            <li>Heat Check on trending targets</li>
            <li>On3-sourced intel — no rumor filler</li>
            <li>One place for the class you already track</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
