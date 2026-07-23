'use client';

import React from 'react';
import type { NilEliteBundle } from '@/lib/nil-elite-api';

type Props = {
  money?: NilEliteBundle['money'];
  desk?: NilEliteBundle['desk'];
};

export function NilMetricsBar({ money, desk }: Props): React.ReactElement {
  const metrics = [
    { label: 'School market', value: money?.schoolMarketLabel || money?.poolLabel || '—' },
    { label: 'Football only', value: money?.footballMarketLabel || '—' },
    {
      label: 'Football share',
      value: desk?.stats?.footballSharePct != null ? `${desk.stats.footballSharePct}%` : '—',
    },
    { label: 'SEC', value: money?.secRank != null ? `#${money.secRank}` : '—' },
    { label: 'National', value: money?.nationalRank != null ? `#${money.nationalRank}` : '—' },
    {
      label: 'vs Texas',
      value:
        desk?.stats?.vsElitePct != null
          ? `${desk.stats.vsElitePct}%`
          : money?.vsElitePct != null
            ? `${money.vsElitePct}%`
            : '—',
    },
  ];

  return (
    <section className="nil-metrics nil-bleed" data-testid="nil-metrics-bar" aria-label="NIL money pulse">
      <div className="nil-metrics__track rh-frame">
        {metrics.map((m) => (
          <article key={m.label} className="nil-metric-card">
            <span className="nil-metric-card__label">{m.label}</span>
            <strong className="nil-metric-card__value">{m.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
