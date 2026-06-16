'use client';

import React from 'react';
import type { HighPriorityIntelEntry } from '@/hooks/useIntelFeed';
import { IntelCard } from './IntelCard';

type Props = {
  items: HighPriorityIntelEntry[];
  loading?: boolean;
};

function IntelSkeleton(): React.ReactElement {
  return (
    <div className="rh-intel-feed__grid">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rh-skeleton rh-skeleton--intel" />
      ))}
    </div>
  );
}

export function HighPriorityIntelFeed({ items, loading }: Props): React.ReactElement {
  return (
    <section className="rh-intel-feed rh-frame" data-testid="rh-high-priority-intel">
      <h2 className="rh-section-title">High Priority Intel</h2>
      {loading && items.length === 0 ? (
        <IntelSkeleton />
      ) : items.length === 0 ? (
        <p className="rh-muted">No high-priority intel loaded yet.</p>
      ) : (
        <div className="rh-intel-feed__grid">
          {items.slice(0, 4).map((entry) => (
            <IntelCard
              key={entry.intel.id}
              item={entry.intel}
              playerName={entry.playerName}
              position={entry.position}
            />
          ))}
        </div>
      )}
    </section>
  );
}
