'use client';

import React from 'react';
import Link from 'next/link';
import '@/lib/free-vs-insider.css';
import { FEATURE_COMPARISON_ROWS } from '@/lib/pricing-tiers';

export function FreeVsInsider(): React.ReactElement {
  return (
    <section className="fvi-section" data-testid="free-vs-insider">
      <h2>Compare Plans</h2>
      <p className="fvi-subtitle">See what unlocks at each tier. FutureCast full access starts at Film Room.</p>
      <div className="fvi-scroll">
        <div className="fvi-table">
          <div className="fvi-header">
            <div>Feature</div>
            <div>Free</div>
            <div>Locker</div>
            <div>Film</div>
            <div>War</div>
          </div>
          {FEATURE_COMPARISON_ROWS.map((row) => (
            <div key={row.feature} className="fvi-row">
              <div>{row.feature}</div>
              <div>{row.free}</div>
              <div>{row.locker}</div>
              <div>{row.film}</div>
              <div>{row.war}</div>
            </div>
          ))}
        </div>
      </div>
      <Link href="/join?tier=film" className="fvi-cta">
        Start with Film Room
      </Link>
    </section>
  );
}
