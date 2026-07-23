'use client';

import React from 'react';
import type { NilEliteBundle } from '@/lib/nil-elite-api';

type Props = {
  money?: NilEliteBundle['money'];
  pulse: NilEliteBundle['pulse'];
};

function trendLabel(money?: NilEliteBundle['money']): string {
  if (!money?.trend) return '—';
  const pct = money.trendPct != null ? ` ${money.trendPct > 0 ? '+' : ''}${money.trendPct}%` : '';
  if (money.trend === 'up') return `↑${pct}`;
  if (money.trend === 'down') return `↓${pct}`;
  return `→${pct}`;
}

export function NilMetricsBar({ money, pulse }: Props): React.ReactElement {
  const metrics = [
    {
      label: 'UF pool est.',
      value: money?.poolLabel || '—',
    },
    {
      label: 'Avg deal',
      value: money?.avgDealK != null ? `$${money.avgDealK}K` : '—',
    },
    {
      label: 'Top deal',
      value: money?.topDealM != null ? `$${money.topDealM}M` : '—',
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
      label: 'Pool trend',
      value: trendLabel(money),
    },
    {
      label: 'Roster valuations',
      value: String(pulse.portalArrivals >= 0 ? 'Live' : '—'),
    },
  ];

  // Drop the useless "Live" metric — replace with active targets as secondary context
  metrics[6] = { label: 'Active UF targets', value: String(pulse.activeTargets) };

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
