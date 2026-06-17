'use client';

import React, { useMemo } from 'react';
import type { FeedPrediction, StockBoardResponse } from '@/lib/predictions-api';
import { playerProfileRoute } from '@/lib/vault-route-map';
import { movementArrow, movementClass, shortIntel, ufPct } from './futurecast-page-utils';

type Props = {
  stock: StockBoardResponse;
};

function stockLabel(p: FeedPrediction, bucket: 'rising' | 'falling' | 'volatile'): string {
  if (bucket === 'rising') return 'Rising';
  if (bucket === 'falling') return 'Falling';
  const vol = p.volatilityScore ?? 0;
  return vol >= 50 ? 'Volatile' : 'Watch';
}

function StockColumn({
  title,
  titleClass,
  players,
  bucket,
}: {
  title: string;
  titleClass: string;
  players: FeedPrediction[];
  bucket: 'rising' | 'falling' | 'volatile';
}): React.ReactElement {
  return (
    <div className="fc-panel">
      <h3 className={`fc-stock-col__title ${titleClass}`}>{title}</h3>
      {players.length === 0 ? (
        <p className="fc-empty">None flagged.</p>
      ) : (
        players.slice(0, 8).map((p) => {
          const delta = p.delta ?? 0;
          return (
            <div key={p.id} className="fc-stock-item">
              <a href={playerProfileRoute(p.playerSlug, 'futurecast')} className="fc-table__player">
                <strong>{p.fullName}</strong>
                <span>{p.position}</span>
              </a>
              <p className="fc-hp-card__meta">
                UF {ufPct(p.ufProbability ?? p.confidence)}% ·{' '}
                <span className={movementClass(delta)}>
                  {movementArrow(delta)} {Math.abs(delta) || 0}
                </span>{' '}
                · {stockLabel(p, bucket)}
              </p>
              <p className="fc-hp-card__intel">{shortIntel(p.visitIndicator ?? undefined, 70)}</p>
            </div>
          );
        })
      )}
    </div>
  );
}

export function FutureCastStockBoard({ stock }: Props): React.ReactElement {
  const volatile = useMemo(() => {
    const pool = [...(stock.stockUp ?? []), ...(stock.stockDown ?? [])];
    return pool
      .filter((p) => (p.volatilityScore ?? 0) >= 40)
      .sort((a, b) => (b.volatilityScore ?? 0) - (a.volatilityScore ?? 0));
  }, [stock]);

  return (
    <section className="futurecast-page__section" data-testid="fc-stock-board">
      <h2 className="futurecast-page__section-title">Stock Board</h2>
      <p className="futurecast-page__section-sub">Rising, falling, and volatile players across the cycle.</p>
      <div className="fc-stock-grid">
        <StockColumn
          title="Rising"
          titleClass="fc-stock-col__title--rising"
          players={stock.stockUp ?? []}
          bucket="rising"
        />
        <StockColumn
          title="Falling"
          titleClass="fc-stock-col__title--falling"
          players={stock.stockDown ?? []}
          bucket="falling"
        />
        <StockColumn title="Volatile" titleClass="fc-stock-col__title--volatile" players={volatile} bucket="volatile" />
      </div>
    </section>
  );
}
