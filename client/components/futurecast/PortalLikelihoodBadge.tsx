/**
 * Portal likelihood indicator (college players).
 * @see server/docs/futurecast-platform-spec.md §4.1
 */
import React from 'react';

export interface PortalLikelihoodBadgeProps {
  score: number;
}

export function PortalLikelihoodBadge({ score }: PortalLikelihoodBadgeProps): React.ReactElement {
  const pct = score <= 1 ? Math.round(score * 100) : Math.round(score);
  return (
    <span className="fc-portal-likelihood" data-testid="portal-likelihood-badge">
      Portal: {pct}%
    </span>
  );
}
