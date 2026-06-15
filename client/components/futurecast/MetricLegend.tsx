'use client';

import React from 'react';
import { FC_METRIC_LABELS } from '@/lib/futurecast-elite-metrics';

/**
 * Reusable legend explaining the four FutureCast Elite card metrics.
 * Styles: `futurecast-elite.css` (`.fc-legend`).
 */
export function MetricLegend(): React.ReactElement {
  return (
    <aside className="fc-legend gv-card" aria-label="How to read FutureCast metrics">
      <h3 className="fc-legend-title">How to Read the Metrics</h3>
      <ul className="fc-legend-list">
        <li>
          <strong>{FC_METRIC_LABELS.uf}</strong> — FutureCast model commit likelihood for Florida.
        </li>
        <li>
          <strong>{FC_METRIC_LABELS.staff}</strong> — Insider confidence based on staff notes and
          evaluations.
        </li>
        <li>
          <strong>{FC_METRIC_LABELS.fit}</strong> — Scheme + roster + athletic match for Florida.
        </li>
        <li>
          <strong>{FC_METRIC_LABELS.priority}</strong> — Importance to UF’s 2027 class strategy.
        </li>
      </ul>
    </aside>
  );
}
