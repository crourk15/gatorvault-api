'use client';

import React from 'react';
import type { MovementSummaryResponse } from '@/lib/recruiting-movement-api';
import { formatIntelUpdated } from '@/components/recruiting-hub/utils/formatDate';

type Props = {
  summary: MovementSummaryResponse | null;
};

export function MovementSummaryLine({ summary }: Props): React.ReactElement | null {
  if (!summary) return null;

  return (
    <div className="rh-movement-summary rh-container" data-testid="rh-movement-summary">
      <p className="rh-movement-summary__line">
        <span className="rh-movement-badge rh-movement-badge--rise">
          <span className="rh-movement-badge__icon" aria-hidden>↑</span>
          {summary.rising}
        </span>
        {' '}rising ·{' '}
        <span className="rh-movement-badge rh-movement-badge--fall">
          <span className="rh-movement-badge__icon" aria-hidden>↓</span>
          {summary.falling}
        </span>
        {' '}falling ·{' '}
        <span className="rh-movement-badge rh-movement-badge--volatile">
          <span className="rh-movement-badge__icon" aria-hidden>⚡</span>
          {summary.volatile}
        </span>
        {' '}volatile
      </p>
      <p className="rh-movement-summary__meta">
        Last updated: {formatIntelUpdated(summary.lastUpdated)}
      </p>
    </div>
  );
}
