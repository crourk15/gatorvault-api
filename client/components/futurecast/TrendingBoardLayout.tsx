'use client';

import React, { useMemo, useState } from 'react';
import { FutureCastSubPageHero } from './FutureCastSubPageHero';
import { TrendingPlayerCard } from './TrendingPlayerCard';
import {
  TrendingFilters,
  applyTrendingFilters,
  type TrendingFilterState,
} from './TrendingFilters';
import { FutureCastInsiderCTA } from './FutureCastInsiderCTA';
import { FutureCastPanelShell } from './lab/primitives';
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
    <div className="rh-cc-page fc-lab-cc-page" data-testid="fc-trending-layout">
      <FutureCastSubPageHero
        title="Trending Board"
        sub="Rising and falling prospects ranked by 7-day MODEL delta and signal activity."
        badge={updatedAt ? `Updated ${new Date(updatedAt).toLocaleDateString()}` : 'Updated daily'}
        metrics={[
          { label: 'Trending Up', value: up.length, highlight: true },
          { label: 'Trending Down', value: down.length },
        ]}
      />

      <div className="rh-cc-main rh-frame">
        {insider ? (
          <div className="rh-cc-col">
            <section>
              <FutureCastPanelShell title="Filters" sub="Position, state, rating, and movement threshold." testId="fc-trending-filters">
                <TrendingFilters
                  filters={filters}
                  onChange={setFilters}
                  positions={positions}
                  states={states}
                />
              </FutureCastPanelShell>
            </section>
          </div>
        ) : null}

        <div className="rh-cc-col rh-cc-col--left">
          <section>
            <FutureCastPanelShell title="Trending Up" sub="Risers in the current window." testId="fc-trending-up">
              <div className="fc-premium-trending-grid">
                {upVisible.map((p) => (
                  <TrendingPlayerCard key={p.id} player={p} direction="up" />
                ))}
                {upVisible.length === 0 ? <p className="rh-cc-empty">No risers match filters.</p> : null}
              </div>
            </FutureCastPanelShell>
          </section>
        </div>

        <div className="rh-cc-col rh-cc-col--right">
          <section>
            <FutureCastPanelShell title="Trending Down" sub="Fallers in the current window." testId="fc-trending-down">
              <div className="fc-premium-trending-grid">
                {downVisible.map((p) => (
                  <TrendingPlayerCard key={p.id} player={p} direction="down" />
                ))}
                {downVisible.length === 0 ? <p className="rh-cc-empty">No fallers match filters.</p> : null}
              </div>
            </FutureCastPanelShell>
          </section>
        </div>
      </div>

      {!insider ? (
        <FutureCastInsiderCTA limit={freeLimit} total={up.length + down.length} />
      ) : null}
    </div>
  );
}
