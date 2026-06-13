/**
 * Prediction source badge — e.g. MODEL PICK → Florida.
 */
import React from 'react';

export interface PredictionBadgeProps {
  type: string;
  team: string;
}

export function PredictionBadge({ type, team }: PredictionBadgeProps): React.ReactElement {
  return (
    <span className="fc-prediction-badge" data-testid="prediction-badge">
      {type.toUpperCase()} → {team}
    </span>
  );
}
