'use client';

import React from 'react';
import { Chip } from '@/components/brand';

export function LandingSocialProofElite(): React.ReactElement {
  return (
    <section className="gv-social-elite" data-testid="welcome-social-proof">
      <div className="gv-social-container">
        <h2 className="gv-social-title">Trusted by Florida fans everywhere</h2>

        <div className="gv-social-metrics">
          <div className="gv-social-metric">
            <span className="gv-social-number">24/7</span>
            <span className="gv-social-label">Real-time updates</span>
          </div>
          <div className="gv-social-metric">
            <span className="gv-social-number">#1</span>
            <span className="gv-social-label">Florida recruiting hub</span>
          </div>
          <div className="gv-social-metric">
            <span className="gv-social-number">1000s</span>
            <span className="gv-social-label">Gator fans served</span>
          </div>
        </div>

        <div className="gv-social-chips">
          <Chip variant="orange">Verified Intel</Chip>
          <Chip variant="blue">FutureCast Engine</Chip>
          <Chip variant="blue">Film + Data</Chip>
        </div>
      </div>
    </section>
  );
}
