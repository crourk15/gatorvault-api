/**
 * FutureCast predictions page — /futurecast (App Router target).
 */
import React, { useEffect, useState } from 'react';
import { FutureCastFeed } from '@/components/futurecast/FutureCastFeed';
import {
  MovementHeatmap,
  type MovementHeatmapBucket,
} from '@/components/futurecast/MovementHeatmap';
import { fetchMovementHeatmap } from '@/lib/predictions-api';
import '@/lib/futurecast.css';

const HEATMAP_REFRESH_MS = 60_000;

export default function FutureCastPage(): React.ReactElement {
  const [heatmapBuckets, setHeatmapBuckets] = useState<MovementHeatmapBucket[] | null>(null);
  const [heatmapWindowDays, setHeatmapWindowDays] = useState(7);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function loadHeatmap() {
      try {
        const data = await fetchMovementHeatmap();
        if (!cancelled) {
          setHeatmapBuckets(data.buckets);
          setHeatmapWindowDays(data.windowDays);
        }
      } catch {
        if (!cancelled) setHeatmapBuckets(null);
      }
    }

    void loadHeatmap();
    timer = setInterval(() => void loadHeatmap(), HEATMAP_REFRESH_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

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
      <h1 className="fc-futurecast-page__title">FutureCast Predictions</h1>
      <p className="fc-futurecast-page__subtitle">
        Live MODEL picks, confidence scores, and trending Florida targets.
      </p>
      {heatmapBuckets && (
        <div className="fc-futurecast-page__heatmap">
          <MovementHeatmap buckets={heatmapBuckets} windowDays={heatmapWindowDays} />
        </div>
      )}
      <FutureCastFeed />
    </div>
  );
}
