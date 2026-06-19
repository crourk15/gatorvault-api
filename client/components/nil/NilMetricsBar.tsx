'use client';

import React from 'react';
import type { NilDashboard } from '@/lib/nil-api';

type Props = {
  dashboard: NilDashboard;
};

export function NilMetricsBar({ dashboard }: Props): React.ReactElement {
  const uf = dashboard.ufStanding;
  const pool = uf?.estimatedAnnualPoolM != null ? `$${uf.estimatedAnnualPoolM}M` : '—';
  const momentum = uf?.trend === 'up' ? '↑ Rising' : uf?.trend === 'down' ? '↓ Cooling' : '→ Stable';
  const portalImpact = dashboard.positionImpact?.[0]
    ? `${dashboard.positionImpact[0].position} +${dashboard.positionImpact[0].count}`
    : 'Active';

  const metrics = [
    { icon: '📊', label: 'SEC NIL Trend', value: uf?.secRank != null ? `#${uf.secRank} SEC` : '—' },
    { icon: '💰', label: 'Team NIL Valuation', value: pool },
    { icon: '🔥', label: 'UF Collective Momentum', value: momentum },
    { icon: '🔄', label: 'Portal NIL Impact', value: portalImpact },
  ];

  return (
    <section className="nil-metrics nil-bleed" data-testid="nil-metrics-bar" aria-label="NIL metrics">
      <div className="nil-metrics__track rh-frame">
        {metrics.map((m) => (
          <article key={m.label} className="nil-metric-card">
            <span className="nil-metric-card__icon" aria-hidden>
              {m.icon}
            </span>
            <span className="nil-metric-card__label">{m.label}</span>
            <strong className="nil-metric-card__value">{m.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
