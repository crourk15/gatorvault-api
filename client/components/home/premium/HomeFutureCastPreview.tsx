'use client';

import React from 'react';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { playerProfilePath } from '@/lib/player-routes';

type Props = {
  movement: StaffDashboardResponse | null;
  loading?: boolean;
};

function ufPct(delta: number | null | undefined): number {
  return Math.min(99, Math.max(20, 55 + (delta ?? 0) * 2));
}

export function HomeFutureCastPreview({ movement, loading }: Props): React.ReactElement {
  if (loading && !movement) {
    return (
      <div className="uf-premium-grid uf-premium-grid--2">
        <div className="uf-premium-skeleton" />
        <div className="uf-premium-skeleton" />
      </div>
    );
  }

  const trending = [...(movement?.topRisers ?? [])]
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
    .slice(0, 4);
  const shifts = [...(movement?.highVolatility ?? movement?.topFallers ?? [])].slice(0, 4);

  return (
    <div className="uf-premium-grid uf-premium-grid--2" data-testid="home-futurecast-preview">
      <article className="uf-premium-card">
        <h3 className="uf-premium-card__title">Trending Players</h3>
        {trending.length === 0 ? (
          <p className="uf-premium-empty">FutureCast probabilities updating.</p>
        ) : (
          <ul className="uf-premium-card__list">
            {trending.map((p) => (
              <li key={p.id}>
                <a href={playerProfilePath(p.slug, 'HIGH_SCHOOL', true, p.name, 'futurecast')}>{p.name}</a>
                <span className="uf-premium-delta--up"> ↑ +{p.delta ?? 0}</span>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="uf-premium-card">
        <h3 className="uf-premium-card__title">Probability Shifts</h3>
        {shifts.length === 0 ? (
          <p className="uf-premium-empty">No major probability swings in the current window.</p>
        ) : (
          <ul className="uf-premium-card__list">
            {shifts.map((p) => {
              const delta = p.delta ?? 0;
              const tone = delta >= 0 ? 'up' : 'down';
              return (
                <li key={p.id}>
                  <a href={playerProfilePath(p.slug, 'HIGH_SCHOOL', true, p.name, 'futurecast')}>{p.name}</a>
                  <span className={`uf-premium-delta--${tone}`}>
                    {' '}
                    {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)} · {ufPct(delta)}% UF
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </article>
    </div>
  );
}
