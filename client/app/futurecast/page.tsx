'use client';

/**
 * FutureCast predictions page — /futurecast (2027 cycle homepage)
 */
import React from 'react';
import { FutureCastHomepage } from '@/components/futurecast/FutureCastHomepage';
import '@/lib/futurecast.css';

export default function FutureCastPage(): React.ReactElement {
  return (
    <div className="fc-futurecast-page" data-testid="futurecast-page">
      <nav className="fc-futurecast-nav">
        <a href="/futurecast" className="fc-futurecast-nav__link is-active">
          Predictions
        </a>
        <a href="/futurecast/stock" className="fc-futurecast-nav__link">
          Stock Up / Stock Down
        </a>
        <a href="/futurecast/snapshots" className="fc-futurecast-nav__link">
          Snapshots
        </a>
        <a href="/alerts" className="fc-futurecast-nav__link">
          Alerts
        </a>
        <a href="/staff/dashboard" className="fc-futurecast-nav__link">
          Staff Dashboard
        </a>
      </nav>
      <h1 className="fc-futurecast-page__title">FutureCast</h1>
      <p className="fc-futurecast-page__subtitle">
        2027 recruiting cycle — commits, targets, movement, and portal intel.
      </p>
      <FutureCastHomepage />
    </div>
  );
}
