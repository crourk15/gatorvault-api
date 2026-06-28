'use client';

import React from 'react';

export function LandingSocialProofElite(): React.ReactElement {
  return (
    <section className="gv-social-elite" data-testid="welcome-social-proof">
      <div className="gv-social-container">
        <h2 className="gv-social-title">For fans who live and breathe Gator football</h2>
        <p className="gv-social-lead">
          You already know the board, the visits, and which recruit everyone&apos;s talking about.
          GatorVault is where that all comes together — one home for Gator recruiting, built by people
          who follow the class the same way you do.
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

        <div className="gv-social-pills" aria-label="Core GatorVault tools">
          <span className="gv-social-pill gv-social-pill--orange">Recruiting board</span>
          <span className="gv-social-pill gv-social-pill--blue">FutureCast</span>
          <span className="gv-social-pill gv-social-pill--blue">Film + game week</span>
        </div>
      </div>
    </section>
  );
}
