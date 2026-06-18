'use client';

import React from 'react';
import type { HomeMetricCard } from './types';
import { HomeMetricCardView } from './widgets/HomeMetricCard';

type Props = {
  cards: HomeMetricCard[];
  loading?: boolean;
};

export function HomeMetricsSlider({ cards, loading }: Props): React.ReactElement {
  if (loading) {
    return (
      <section className="gv-hcc-section" aria-label="Live metrics">
        <div className="gv-hcc-metrics gv-hcc-metrics--loading">
          {[1, 2, 3].map((n) => (
            <div key={n} className="gv-hcc-metric gv-hcc-skeleton" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="gv-hcc-section" aria-label="Live metrics" data-testid="home-metrics-slider">
      <div className="gv-hcc-metrics no-scrollbar">
        {cards.map((card) => (
          <HomeMetricCardView key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}
