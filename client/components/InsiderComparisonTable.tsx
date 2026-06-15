'use client';

import React from 'react';
import Link from 'next/link';
import { WELCOME_LINKS } from '@/components/welcome/links';

const ROWS = [
  { feature: 'FutureCast Trending', free: 'Limited', insider: 'Full Access' },
  { feature: 'Movement Intel', free: 'Blurred', insider: 'Full Access' },
  { feature: 'Staff Notes', free: '3 blurred notes', insider: 'All notes + confidence' },
  { feature: 'UF % (Likelihood)', free: 'Top 3 only', insider: 'All recruits' },
  { feature: 'Fit % (Scheme Match)', free: 'Hidden', insider: 'Full Access' },
  { feature: 'Priority Score (Importance)', free: 'Hidden', insider: 'Full Access' },
  { feature: 'Portal Tracker', free: 'Limited', insider: 'Full Access' },
  { feature: 'Film Room', free: 'Highlights only', insider: 'Cut-ups + evaluations' },
  { feature: 'Live Updates', free: 'No', insider: 'Yes' },
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
        <Link href={WELCOME_LINKS.join} className="welcome-cta-primary">
          Become an Insider
        </Link>
      </div>
    </div>
  );
}
