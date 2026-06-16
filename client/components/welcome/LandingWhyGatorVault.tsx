'use client';

import React from 'react';

export function LandingWhyGatorVault(): React.ReactElement {
  return (
    <section className="gv-why-gv" data-testid="welcome-why-gatorvault">
      <div className="gv-why-container">
        <h2 className="gv-why-title">Why GatorVault Exists</h2>

        <div className="gv-why-grid">
          <article className="gv-why-card">
            <h3 className="gv-why-card-title">The Problem</h3>
            <p className="gv-why-card-body">
              Florida recruiting moves fast — but most fans are stuck scrolling message boards, chasing
              rumors, and piecing together half-truths from scattered sources. Noise wins when there is no
              single place to trust.
            </p>
          </article>

          <article className="gv-why-card">
            <h3 className="gv-why-card-title">The Mission</h3>
            <p className="gv-why-card-body">
              GatorVault exists to cut through the clutter. We combine verified intel, movement tracking,
              FutureCast probabilities, film, and insider tools into one platform built specifically for
              Gator Nation.
            </p>
          </article>

          <article className="gv-why-card">
            <h3 className="gv-why-card-title">The Promise</h3>
            <p className="gv-why-card-body">
              Real-time updates when it matters. Elite recruiting tools when you need an edge. A home for
              Florida fans who refuse to guess — and want the same clarity the insiders see.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
