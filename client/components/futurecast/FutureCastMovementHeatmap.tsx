'use client';

import React, { useMemo, useState } from 'react';
import type { FeedPrediction, MovementSnapshotsResponse, StockBoardResponse } from '@/lib/predictions-api';
import { playerProfileRoute } from '@/lib/vault-route-map';
import { movementArrow, movementClass, ufPct } from './futurecast-page-utils';

type WindowKey = '7d' | '30d' | '90d';

type Props = {
  snapshots: MovementSnapshotsResponse;
  stock: StockBoardResponse;
};

function pickWindowPlayers(
  key: WindowKey,
  snapshots: MovementSnapshotsResponse,
  stock: StockBoardResponse
): FeedPrediction[] {
  if (key === '7d') {
    return [...(snapshots.dailyUp ?? []), ...(snapshots.dailyDown ?? [])];
  }
  if (key === '30d') {
    return [...(stock.stockUp ?? []), ...(stock.stockDown ?? [])];
  }
  return [...(snapshots.weeklyUp ?? []), ...(snapshots.weeklyDown ?? [])];
}

export function FutureCastMovementHeatmap({ snapshots, stock }: Props): React.ReactElement {
  const [window, setWindow] = useState<WindowKey>('7d');

  const players = useMemo(
    () => pickWindowPlayers(window, snapshots, stock),
    [window, snapshots, stock]
  );

  return (
    <section className="futurecast-page__section fc-panel" data-testid="fc-movement-heatmap">
      <h2 className="futurecast-page__section-title">Movement Heatmap</h2>
      <p className="futurecast-page__section-sub">Volatility and direction across 7d, 30d, and 90d windows.</p>

      <div className="fc-heatmap-tabs" role="tablist" aria-label="Movement window">
        {(['7d', '30d', '90d'] as WindowKey[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={window === key}
            className={`fc-heatmap-tab${window === key ? ' fc-heatmap-tab--active' : ''}`}
            onClick={() => setWindow(key)}
          >
            {key}
          </button>
        ))}
      </div>

      {players.length === 0 ? (
        <p className="fc-empty">No movement data for this window.</p>
      ) : (
        <div className="fc-heatmap-grid">
          {players.slice(0, 12).map((p) => {
            const delta = p.delta ?? 0;
            return (
              <article key={p.id} className="fc-heatmap-cell">
                <p className="fc-heatmap-cell__name">
                  <a href={playerProfileRoute(p.playerSlug, 'futurecast')} className="fc-table__player">
                    {p.fullName}
                  </a>
                </p>
                <p className={`fc-heatmap-cell__meta ${movementClass(delta)}`}>
                  {movementArrow(delta)} {Math.abs(delta) || 0} · UF {ufPct(p.ufProbability ?? p.confidence)}%
                </p>
                <p className="fc-heatmap-cell__meta">{p.position}</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
