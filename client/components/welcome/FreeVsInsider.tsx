'use client';

import React from 'react';
import Link from 'next/link';
import '@/lib/free-vs-insider.css';

const ROWS = [
  ['Recruiting Hub', 'Limited', 'Full Access'],
  ['Player Profiles', 'Limited', 'Full Access'],
  ['Live Feed', 'Read-only', 'Full Insider Feed'],
  ['FutureCast', 'Locked', 'Full Predictions'],
  ['Film Room', 'Locked', 'Full Breakdowns'],
  ['War Room Intel', 'No', 'Yes'],
  ['Insider Chat', 'No', 'Yes'],
  ['NIL Tracker', 'Limited', 'Full Access'],
  ['Portal Tracker', 'Limited', 'Full Access'],
] as const;

export function FreeVsInsider(): React.ReactElement {
  return (
    <section className="fvi-section" data-testid="free-vs-insider">
      <h2>Free vs Insider</h2>
      <div className="fvi-table">
        <div className="fvi-header">
          <div>Feature</div>
          <div>Free</div>
          <div>Insider</div>
        </div>
        {ROWS.map(([feature, free, insider]) => (
          <div key={feature} className="fvi-row">
            <div>{feature}</div>
            <div>{free}</div>
            <div>{insider}</div>
          </div>
        ))}
      </div>
      <Link href="/insider" className="fvi-cta">
        Upgrade to Insider
      </Link>
    </section>
  );
}
