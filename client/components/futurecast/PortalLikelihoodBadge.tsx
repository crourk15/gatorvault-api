/**
 * Portal likelihood indicator (college players).
 * @see server/docs/futurecast-platform-spec.md §4.1
 */
import React from 'react';

export interface PortalLikelihoodBadgeProps {
  score: number;
}

export function PortalLikelihoodBadge({ score }: PortalLikelihoodBadgeProps): React.ReactElement {
  return (
    <span className="fc-portal-likelihood" data-testid="portal-likelihood-badge">
      Portal: {score}%
    </span>
  );
}
