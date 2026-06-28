'use client';

import React from 'react';
import { Chip } from '@/components/brand';

export function LandingSocialProofElite(): React.ReactElement {
  return (
    <section className="gv-social-elite" data-testid="welcome-social-proof">
      <div className="gv-social-container">
        <h2 className="gv-social-title">For fans who live and breathe Gator football</h2>
        <p className="gv-social-lead">
          You already refresh the board, track visits, and argue about the class. GatorVault is just the
          home base for all of it — built for people who care about UF, not hype.
        </p>

        <div className="gv-social-metrics">
          <div className="gv-social-metric">
            <span className="gv-social-number">🐊</span>
            <span className="gv-social-label">Florida recruiting only — no national noise</span>
          </div>
          <div className="gv-social-metric">
            <span className="gv-social-number">📋</span>
            <span className="gv-social-label">Board, portal, and visits in one spot</span>
          </div>
          <div className="gv-social-metric">
            <span className="gv-social-number">📈</span>
            <span className="gv-social-label">Following the class as it actually moves</span>
          </div>
        </div>

        <div className="gv-social-chips">
          <Chip variant="orange">Recruiting board</Chip>
          <Chip variant="blue">FutureCast</Chip>
          <Chip variant="blue">Film + game week</Chip>
        </div>
      </div>
    </section>
  );
}
