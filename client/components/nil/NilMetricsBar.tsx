'use client';

import React from 'react';
import type { NilEliteBundle } from '@/lib/nil-elite-api';

type Props = {
  money?: NilEliteBundle['money'];
  pulse: NilEliteBundle['pulse'];
};

export function NilMetricsBar({ money, pulse }: Props): React.ReactElement {
  const metrics = [
    { label: 'School market (all sports)', value: money?.schoolMarketLabel || money?.rosterMarketLabel || money?.poolLabel || '—' },
    { label: 'Football only', value: money?.footballMarketLabel || '—' },
    { label: 'Top valuation', value: money?.topEarnerValue || '—' },
    { label: 'SEC rank', value: money?.secRank != null ? `#${money.secRank}` : '—' },
    { label: 'Natl rank', value: money?.nationalRank != null ? `#${money.nationalRank}` : '—' },
    {
      label: 'vs Texas (#1)',
      value:
        money?.vsElitePct != null
          ? `${money.vsElitePct}%`
          : money?.eliteMarketM != null && money?.rosterMarketM != null
            ? `${Math.round((money.rosterMarketM / money.eliteMarketM) * 1000) / 10}%`
            : '—',
    },
    {
      label: 'Indexed market',
      value: money?.indexedMarketB != null ? `$${money.indexedMarketB}B` : '—',
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
          {money.programsIndexed != null ? ` · ${money.programsIndexed} programs` : ''}
          {money.benefitsCapM != null ? ` · 2026–27 benefits cap ~$${money.benefitsCapM}M` : ''}
          {money.topEarnerName ? ` · Lead: ${money.topEarnerName}` : ''}
          {money.attribution ? ` · ${money.attribution}` : ''}
        </p>
      ) : null}
    </section>
  );
}
