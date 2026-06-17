'use client';

import React from 'react';
import type { IntelCardProps } from '@/components/recruiting-hub/types/intel';
import { IntelCard } from './IntelCard';
import './high-priority-intel-grid.css';

type Props = {
  items: IntelCardProps[];
  loading?: boolean;
};

function IntelGridSkeleton(): React.ReactElement {
  return (
    <div className="hp-intel-grid" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="hp-intel-grid__skeleton" />
      ))}
    </div>
  );
}

export function HighPriorityIntelGrid({ items, loading }: Props): React.ReactElement {
  return (
    <section className="hp-intel-section rh-container" data-testid="rh-high-priority-intel-grid">
      <header>
        <h2 className="hp-intel-section__title">High Priority Intel</h2>
        <p className="hp-intel-section__sub">Structured intel on UF&apos;s top targets — probability, heat, and next action.</p>
      </header>

      {loading && items.length === 0 ? (
        <IntelGridSkeleton />
      ) : items.length === 0 ? (
        <p className="hp-intel-section__empty">No high-priority intel loaded yet.</p>
      ) : (
        <div className="hp-intel-grid">
          {items.slice(0, 4).map((item) => (
            <IntelCard key={`${item.playerId}-${item.timestamp}`} {...item} />
          ))}
        </div>
      )}
    </section>
  );
}
