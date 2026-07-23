'use client';

import React from 'react';
import type { NilEliteBundle } from '@/lib/nil-elite-api';

type Props = {
  pulse: NilEliteBundle['pulse'];
  classYear: number;
};

export function NilMetricsBar({ pulse, classYear }: Props): React.ReactElement {
  const metrics = [
    { label: `${classYear} commits`, value: String(pulse.commits) },
    {
      label: 'Blue-chip share',
      value: pulse.blueChipPct != null ? `${pulse.blueChipPct}%` : '—',
    },
    {
      label: 'Avg rating',
      value: pulse.avgRating != null ? String(pulse.avgRating) : '—',
    },
    { label: 'Active UF targets', value: String(pulse.activeTargets) },
    { label: 'Portal arrivals', value: String(pulse.portalArrivals) },
  ];

  return (
    <section className="nil-metrics nil-bleed" data-testid="nil-metrics-bar" aria-label="NIL pulse">
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
