'use client';

import React from 'react';
import type { NilEliteBundle } from '@/lib/nil-elite-api';

type Props = {
  money?: NilEliteBundle['money'];
  pulse: NilEliteBundle['pulse'];
};

export function NilMetricsBar({ money, pulse }: Props): React.ReactElement {
  const metrics = [
    {
      label: 'Football market',
      value: money?.poolLabel || '—',
    },
    {
      label: 'Roster market',
      value: money?.rosterMarketLabel || '—',
    },
    {
      label: 'Top valuation',
      value: money?.topEarnerValue || '—',
    },
    {
      label: 'SEC rank',
      value: money?.secRank != null ? `#${money.secRank}` : '—',
    },
    {
      label: 'Natl rank',
      value: money?.nationalRank != null ? `#${money.nationalRank}` : '—',
    },
    {
      label: 'vs #1 market',
      value: money?.vsElitePct != null ? `${money.vsElitePct}%` : '—',
    },
    {
      label: 'Active UF targets',
      value: String(pulse.activeTargets),
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
      {money?.provider ? (
        <p className="nil-metrics__note rh-frame">
          {money.provider}
          {money.topEarnerName ? ` · Lead: ${money.topEarnerName}` : ''}
          {money.attribution ? ` · ${money.attribution}` : ''}
        </p>
      ) : null}
    </section>
  );
}
