'use client';

import React from 'react';

export function TrackerSkeleton({ rows = 6 }: { rows?: number }): React.ReactElement {
  return (
    <div className="tracker-skeleton" data-testid="tracker-skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="tracker-skeleton__row">
          <div className="tracker-skeleton__photo" />
          <div className="tracker-skeleton__lines">
            <div className="tracker-skeleton__line tracker-skeleton__line--wide" />
            <div className="tracker-skeleton__line" />
          </div>
        </div>
      ))}
    </div>
  );
}
