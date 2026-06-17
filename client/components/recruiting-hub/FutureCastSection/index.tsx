'use client';

import React from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { timeAgo } from '@/components/home/home-utils';
import { FutureCastTable } from './FutureCastTable';

type Props = {
  players: HighPriorityPlayer[];
  lastUpdated?: string | null;
};

export function FutureCastSection({ players, lastUpdated }: Props): React.ReactElement {
  const updatedLabel = lastUpdated ? `Updated ${timeAgo(lastUpdated)}` : null;

  return (
    <section className="rh-section rh-section--panel rh-container" data-testid="rh-futurecast-section">
      <header className="rh-section__header rh-section-head">
        <h2 className="rh-section__title rh-section-title">FutureCast</h2>
        <p className="rh-section-sub">UF probability movement, fit scores, and analyst signals for priority targets.</p>
        {updatedLabel ? <p className="rh-section__updated">{updatedLabel}</p> : null}
      </header>
      <FutureCastTable players={players} />
    </section>
  );
}
