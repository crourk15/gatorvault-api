'use client';

import React from 'react';
import Link from 'next/link';
import { WELCOME_LINKS } from '@/components/welcome/links';

const ROWS = [
  { feature: 'Recruiting Hub', free: 'Limited', insider: 'Full access' },
  { feature: 'Player Profiles', free: 'Limited', insider: 'Full access' },
  { feature: 'Live Feed', free: 'Read-only', insider: 'Full Insider feed' },
  { feature: 'FutureCast', free: 'Locked', insider: 'Full predictions' },
  { feature: 'Film Room', free: 'Locked', insider: 'Full breakdowns' },
  { feature: 'War Room Intel', free: 'No', insider: 'Yes' },
  { feature: 'Insider Chat', free: 'No', insider: 'Yes' },
  { feature: 'NIL Tracker', free: 'Limited', insider: 'Full access' },
  { feature: 'Portal Tracker', free: 'Limited', insider: 'Full access' },
] as const;

export function InsiderComparisonTable(): React.ReactElement {
  return (
    <div className="insider-table" data-testid="insider-comparison-table">
      <h2 className="insider-table-title">Free vs Insider</h2>
      <div className="insider-table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Feature</th>
              <th scope="col">Free</th>
              <th scope="col">Insider</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.feature}>
                <td>{row.feature}</td>
                <td>{row.free}</td>
                <td>{row.insider}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="insider-table-cta">
        <Link href={WELCOME_LINKS.insider} className="welcome-cta-primary">
          Upgrade to Insider
        </Link>
      </div>
    </div>
  );
}
