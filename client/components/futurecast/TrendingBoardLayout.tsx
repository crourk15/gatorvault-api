'use client';

import React, { useMemo, useState } from 'react';
import { FutureCastHero } from './FutureCastHero';
import { TrendingPlayerCard } from './TrendingPlayerCard';
import {
  TrendingFilters,
  applyTrendingFilters,
  type TrendingFilterState,
} from './TrendingFilters';
import { FutureCastInsiderCTA } from './FutureCastInsiderCTA';
import { isFutureCastInsider } from '@/lib/futurecast-insider';
import type { FutureCastPlayer } from '@/lib/futurecast-board-types';

type Props = {
  trendingUp: FutureCastPlayer[];
  trendingDown: FutureCastPlayer[];
  updatedAt?: string;
};

const DEFAULT_FILTERS: TrendingFilterState = {
  position: '',
  state: '',
  minRating: 0,
  movementThreshold: 0,
};

export function TrendingBoardLayout({ trendingUp, trendingDown, updatedAt }: Props): React.ReactElement {
  const [filters, setFilters] = useState<TrendingFilterState>(DEFAULT_FILTERS);
  const insider = isFutureCastInsider();
  const freeLimit = 3;

  const positions = useMemo(
    () => [...new Set([...trendingUp, ...trendingDown].map((p) => p.position))].sort(),
    [trendingUp, trendingDown]
  );
  const states = useMemo(
    () =>
      [...new Set([...trendingUp, ...trendingDown].map((p) => p.state).filter(Boolean) as string[])].sort(),
    [trendingUp, trendingDown]
  );

  const up = applyTrendingFilters(trendingUp, filters);
  const down = applyTrendingFilters(trendingDown, filters);
  const upVisible = insider ? up : up.slice(0, freeLimit);
  const downVisible = insider ? down : down.slice(0, freeLimit);

  return (
    <div className="gv-elite-stack fc-elite-page" data-testid="fc-trending-layout">
      <FutureCastHero
        badge={updatedAt ? `Updated ${new Date(updatedAt).toLocaleDateString()}` : 'Updated daily'}
      />
      {insider ? (
        <TrendingFilters
          filters={filters}
          onChange={setFilters}
          positions={positions}
          states={states}
        />
      ) : null}
      <div className="gv-trending-columns fc-trending-columns">
        <section className="fc-trending-column">
          <h2 className="gv-card-title fc-trending-column__title">Trending Up</h2>
          <div className="fc-trending-column__grid">
            {upVisible.map((p) => (
              <TrendingPlayerCard key={p.id} player={p} direction="up" />
            ))}
            {upVisible.length === 0 ? <p className="fc-elite-empty">No risers match filters.</p> : null}
          </div>
        </section>
        <section className="fc-trending-column">
          <h2 className="gv-card-title fc-trending-column__title">Trending Down</h2>
          <div className="fc-trending-column__grid">
            {downVisible.map((p) => (
              <TrendingPlayerCard key={p.id} player={p} direction="down" />
            ))}
            {downVisible.length === 0 ? <p className="fc-elite-empty">No fallers match filters.</p> : null}
          </div>
        </section>
      </div>
      {!insider ? (
        <FutureCastInsiderCTA limit={freeLimit} total={up.length + down.length} />
      ) : null}
    </div>
  );
}
