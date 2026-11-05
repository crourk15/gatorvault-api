'use client';

import React from 'react';

export function LandingWhyGatorVault(): React.ReactElement {
  return (
    <section className="gv-why-gv" data-testid="welcome-why-gatorvault">
      <div className="gv-why-container">
        <h2 className="gv-why-title">Why GatorVault Exists</h2>

        <div className="gv-why-grid">
          <article className="gv-why-card">
            <h3 className="gv-why-card-title">The problem</h3>
            <p className="gv-why-card-body">
              Following Florida recruiting means bouncing between message boards, timelines, and
              paywalled sites, then piecing it together yourself.
            </p>
          </article>

          <article className="gv-why-card">
            <h3 className="gv-why-card-title">What we do</h3>
            <p className="gv-why-card-body">
              GatorVault keeps the board, portal, visits, Game Week, and film in one clean app,
              updated as the class moves.
            </p>
          </article>

          <article className="gv-why-card">
            <h3 className="gv-why-card-title">Who it&apos;s for</h3>
            <p className="gv-why-card-body">
              Fans who already know the names and want one place to keep up — without the rumor
              chase.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
