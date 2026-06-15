'use client';

import React from 'react';
import { Button } from '@/components/ui';

type Props = {
  intelUrl: string;
  ticketsUrl: string;
};

export function GameActions({ intelUrl, ticketsUrl }: Props): React.ReactElement {
  return (
    <div className="gv-sched-actions">
      <Button href={intelUrl} variant="primary" className="gv-sched-actions__btn">
        Game Week Intel →
      </Button>
      <Button
        href={ticketsUrl}
        variant="secondary"
        className="gv-sched-actions__btn"
        target="_blank"
        rel="noopener noreferrer"
      >
        Buy Tickets
      </Button>
    </div>
  );
}
