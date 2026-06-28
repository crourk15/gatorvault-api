'use client';

import React from 'react';
import Link from 'next/link';
import '@/lib/free-vs-insider.css';
import { PUBLIC_FEATURE_COMPARISON_ROWS } from '@/lib/pricing-tiers';

export function FreeVsInsider(): React.ReactElement {
  return (
    <section className="fvi-section" data-testid="free-vs-insider">
      <h2>Compare Plans</h2>
      <p className="fvi-subtitle">
        Core hub tools at Locker Room. Full FutureCast, staff notes, and film unlock at Film Room.
      </p>
      <div className="fvi-scroll">
        <div className="fvi-table fvi-table--public">
          <div className="fvi-header">
            <div>Feature</div>
            <div>Free</div>
            <div>Locker</div>
            <div>Film</div>
          </div>
          {PUBLIC_FEATURE_COMPARISON_ROWS.map((row) => (
            <div key={row.feature} className="fvi-row">
              <div>{row.feature}</div>
              <div>{row.free}</div>
              <div>{row.locker}</div>
              <div>{row.film}</div>
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
