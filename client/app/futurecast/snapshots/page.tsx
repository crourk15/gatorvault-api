'use client';

/**
 * Daily & weekly movement snapshots — /futurecast/snapshots
 */
import React, { useEffect, useState } from 'react';
import { FutureCastSubNav } from '@/components/site/FutureCastSubNav';
import { FutureCastHomeCard } from '@/components/futurecast/FutureCastHomeCard';
import {
  fetchMovementSnapshots,
  type FeedPrediction,
} from '@/lib/predictions-api';
import '@/lib/futurecast.css';

const REFRESH_MS = 60_000;

function SnapshotSection({
  title,
  tone,
  predictions,
  emptyMessage,
}: {
  title: string;
  tone: 'up' | 'down';
  predictions: FeedPrediction[];
  emptyMessage: string;
}): React.ReactElement {
  const headingClass =
    tone === 'up' ? 'fc-snapshots__heading--up' : 'fc-snapshots__heading--down';

  return (
    <section className="fc-snapshots__section">
      <h2 className={`fc-snapshots__heading ${headingClass}`}>{title}</h2>
      <div className="fc-home-card-grid">
        {predictions.map((prediction) => (
          <FutureCastHomeCard
            key={prediction.id}
            prediction={prediction}
            variant={tone === 'up' ? 'trending-up' : 'trending-down'}
          />
        ))}
        {predictions.length === 0 && (
          <p className="fc-snapshots__empty">{emptyMessage}</p>
        )}
      </div>
    </section>
  );
}

export default function MovementSnapshotsPage(): React.ReactElement {
  const [dailyUp, setDailyUp] = useState<FeedPrediction[]>([]);
  const [dailyDown, setDailyDown] = useState<FeedPrediction[]>([]);
  const [weeklyUp, setWeeklyUp] = useState<FeedPrediction[]>([]);
  const [weeklyDown, setWeeklyDown] = useState<FeedPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function load(isInitial: boolean) {
      if (isInitial) {
        setLoading(true);
        setError(null);
      }

      try {
        const data = await fetchMovementSnapshots();
        if (!cancelled) {
          setDailyUp(data.dailyUp);
          setDailyDown(data.dailyDown);
          setWeeklyUp(data.weeklyUp);
          setWeeklyDown(data.weeklyDown);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error loading snapshots.');
        }
      } finally {
        if (!cancelled && isInitial) setLoading(false);
      }
    }

    void load(true);
    timer = setInterval(() => void load(false), REFRESH_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  if (loading) {
    return (
      <div className="fc-snapshots-wrap">
        <p className="fc-snapshots__status">Loading movement snapshots…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fc-snapshots-wrap">
        <p className="fc-snapshots__error">{error}</p>
      </div>
    );
  }

  return (
    <div className="fc-snapshots-wrap" data-testid="movement-snapshots-page">
      <FutureCastSubNav active="snapshots" />
      <h1 className="fc-snapshots__title">Daily &amp; Weekly Movement Snapshots</h1>
      <p className="fc-snapshots__subtitle">
        MODEL confidence risers and fallers over 1-day and 7-day windows
      </p>
      <div className="fc-snapshots">
        <SnapshotSection
          title="Daily Risers"
          tone="up"
          predictions={dailyUp}
          emptyMessage="No daily risers in the current window."
        />
        <SnapshotSection
          title="Daily Fallers"
          tone="down"
          predictions={dailyDown}
          emptyMessage="No daily fallers in the current window."
        />
        <SnapshotSection
          title="Weekly Risers"
          tone="up"
          predictions={weeklyUp}
          emptyMessage="No weekly risers in the current window."
        />
        <SnapshotSection
          title="Weekly Fallers"
          tone="down"
          predictions={weeklyDown}
          emptyMessage="No weekly fallers in the current window."
        />
      </div>
    </div>
  );
}
