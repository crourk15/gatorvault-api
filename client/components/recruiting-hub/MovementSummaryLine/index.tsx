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
        UF trending up on {summary.rising} targets, down on {summary.falling}, volatile on{' '}
        {summary.volatile}.
      </p>
      <p className="rh-movement-summary__meta">
        Last updated: {formatIntelUpdated(summary.lastUpdated)}
      </p>
    </div>
  );
}
