'use client';

import React from 'react';
import type { HomeMetricCard } from '../types';
import { HomeMiniSparkline } from './HomeMiniSparkline';

type Props = {
  card: HomeMetricCard;
};

export function HomeMetricCardView({ card }: Props): React.ReactElement {
  const inner = (
    <>
      <span className="gv-hcc-metric__icon" aria-hidden>
        {card.icon}
      </span>
      <span className="gv-hcc-metric__label">{card.label}</span>
      <span className={`gv-hcc-metric__value${card.tone ? ` gv-hcc-metric__value--${card.tone}` : ''}`}>
        {card.value}
      </span>
      <HomeMiniSparkline values={card.sparkline ?? []} tone={card.tone} />
    </>
  );

  if (card.href) {
    return (
      <a href={card.href} className="gv-hcc-metric">
        {inner}
      </a>
    );
  }

  return <div className="gv-hcc-metric">{inner}</div>;
}
