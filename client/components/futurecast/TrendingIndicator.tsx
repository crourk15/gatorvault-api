/**
 * Trending delta indicator — up/down/neutral confidence or score change.
 */
import React from 'react';

export interface TrendingIndicatorProps {
  delta: number;
}

export function TrendingIndicator({ delta }: TrendingIndicatorProps): React.ReactElement {
  if (delta > 0) {
    return (
      <span className="fc-trending fc-trending--up" data-testid="trending-indicator">
        <span className="fc-trending__icon" aria-hidden>
          ▲
        </span>
        +{delta}%
      </span>
    );
  }

  if (delta < 0) {
    return (
      <span className="fc-trending fc-trending--down" data-testid="trending-indicator">
        <span className="fc-trending__icon" aria-hidden>
          ▼
        </span>
        {delta}%
      </span>
    );
  }

  return (
    <span className="fc-trending fc-trending--flat" data-testid="trending-indicator">
      <span className="fc-trending__icon" aria-hidden>
        •
      </span>
      0%
    </span>
  );
}
