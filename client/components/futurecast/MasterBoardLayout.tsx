'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FutureCastHero } from './FutureCastHero';
import { MovementHeatmapCard } from './MovementHeatmapCard';
import { ConfidenceMeter } from './ConfidenceMeter';
import { CommitWatch } from './CommitWatch';
import { HighPriorityList } from './HighPriorityList';
import { MovementSummary } from './MovementSummary';
import { InsiderPaywall } from './InsiderPaywall';
import { FutureCastInsiderCTA } from './FutureCastInsiderCTA';
import { isFutureCastInsider } from '@/lib/futurecast-insider';
import { UiError } from '@/components/site/UiMessage';
import { fetchFutureCastMasterBoard } from '@/lib/futurecast-board-api';
import type { MasterBoardResponse } from '@/lib/futurecast-board-types';

const REFRESH_MS = 60_000;

export function MasterBoardLayout(): React.ReactElement {
  const [data, setData] = useState<MasterBoardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (initial: boolean) => {
    if (initial) {
      setLoading(true);
      setError(null);
    }
    try {
      const next = await fetchFutureCastMasterBoard();
      setData(next);
      setError(null);
    } catch (err) {
      if (initial) setError(err instanceof Error ? err.message : 'Failed to load master board.');
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    void load(true);
    timer = setInterval(() => {
      if (!cancelled) void load(false);
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [load]);

  if (loading && !data) {
    return <p className="fc-elite-loading">Loading FutureCast master board…</p>;
  }
  if (error && !data) {
    return <UiError message={error} />;
  }
  if (!data) {
    return <p className="fc-elite-empty">No master board data.</p>;
  }

  const insider = isFutureCastInsider();

  return (
    <div className="gv-elite-stack fc-elite-page" data-testid="fc-master-board-layout">
      <FutureCastHero badge="Updated daily" />
      <div className="gv-row gv-row--triple fc-elite-row fc-elite-row--triple">
        <MovementHeatmapCard
          heatmap={data.movementHeatmap}
          buckets={data.heatmap.buckets}
          windowDays={data.heatmap.windowDays}
        />
        <ConfidenceMeter average={data.ufConfidenceAverage} sparkline={data.confidenceSparkline} />
        <CommitWatch entries={data.commitWatch} />
      </div>
      <HighPriorityList players={data.highPriority.players} />
      <InsiderPaywall
        hideGate
        teaser={
          <section className="gv-card gv-insider-blur" aria-hidden="true">
            <h2 className="gv-card-title">Movement Summary</h2>
            <p className="gv-card-subtitle">Insider unlock required</p>
          </section>
        }
      >
        <MovementSummary
          risers={data.movementSummary.riserPlayers}
          fallers={data.movementSummary.fallerPlayers}
          volatile={data.movementSummary.volatilePlayers}
        />
      </InsiderPaywall>
      {!insider ? <FutureCastInsiderCTA /> : null}
    </div>
  );
}
