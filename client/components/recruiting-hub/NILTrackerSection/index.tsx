'use client';

import React from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { NILTable } from './NILTable';

type Props = {
  players: HighPriorityPlayer[];
};

export function NILTrackerSection({ players }: Props): React.ReactElement {
  return (
    <section className="rh-section rh-section--panel rh-container" data-testid="rh-nil-tracker-section">
      <h2 className="rh-section__title">NIL Tracker</h2>
      <NILTable players={players} />
    </section>
  );
}
