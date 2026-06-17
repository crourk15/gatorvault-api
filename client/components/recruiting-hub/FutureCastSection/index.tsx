'use client';

import React from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { FutureCastTable } from './FutureCastTable';

type Props = {
  players: HighPriorityPlayer[];
};

export function FutureCastSection({ players }: Props): React.ReactElement {
  return (
    <section className="rh-section rh-section--panel rh-container" data-testid="rh-futurecast-section">
      <h2 className="rh-section__title">FutureCast</h2>
      <FutureCastTable players={players} />
    </section>
  );
}
