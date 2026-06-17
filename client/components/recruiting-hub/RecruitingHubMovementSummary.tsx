'use client';

import React from 'react';
import type { MovementSummary } from '@/lib/movement-summary-api';
import { formatIntelUpdated } from '@/components/recruiting-hub/utils/formatDate';

type Props = {
  movementSummary: MovementSummary | null;
};

export function RecruitingHubMovementSummary({ movementSummary }: Props): React.ReactElement | null {
  if (!movementSummary) return null;

  return (
    <div className="rh-movement-summary rh-container" data-testid="rh-movement-summary">
      <p className="rh-movement-summary__line">
        UF trending up on {movementSummary.rising} targets, down on {movementSummary.falling}, volatile on{' '}
        {movementSummary.volatile}.
      </p>
      <p className="rh-movement-summary__meta">
        Last updated: {formatIntelUpdated(movementSummary.lastUpdated)}
      </p>
    </div>
  );
}
