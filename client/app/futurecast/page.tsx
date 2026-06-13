/**
 * FutureCast predictions page — /futurecast (App Router target).
 */
import React from 'react';
import { FutureCastFeed } from '@/components/futurecast/FutureCastFeed';
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
      </nav>
      <h1 className="fc-futurecast-page__title">FutureCast Predictions</h1>
      <p className="fc-futurecast-page__subtitle">
        Live MODEL picks, confidence scores, and trending Florida targets.
      </p>
      <FutureCastFeed />
    </div>
  );
}
