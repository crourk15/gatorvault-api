/**
 * FutureCast predictions page — /futurecast (App Router target).
 */
import React from 'react';
import { FutureCastFeed } from '@/components/futurecast/FutureCastFeed';
import '@/lib/futurecast.css';

export default function FutureCastPage(): React.ReactElement {
  return (
    <div className="fc-futurecast-page" data-testid="futurecast-page">
      <h1 className="fc-futurecast-page__title">FutureCast Predictions</h1>
      <p className="fc-futurecast-page__subtitle">
        Live MODEL picks, confidence scores, and trending Florida targets.
      </p>
      <FutureCastFeed />
    </div>
  );
}
