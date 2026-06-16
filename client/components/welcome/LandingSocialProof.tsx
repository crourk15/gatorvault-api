'use client';

import React from 'react';
import { landingContent } from './content';

export function LandingSocialProof(): React.ReactElement {
  const { socialProof } = landingContent;
  const stats = [socialProof.stat1, socialProof.stat2, socialProof.stat3];

  return (
    <section className="gv-landing-social" data-testid="welcome-social-proof">
      <div className="gv-landing-container">
        <h2 className="gv-landing-h2">Trusted by Florida fans everywhere</h2>
        <div className="gv-landing-stats">
          {stats.map((stat) => (
            <div key={stat.label} className="gv-landing-stat">
              <span className="gv-landing-stat-number">{stat.number}</span>
              <span className="gv-landing-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
