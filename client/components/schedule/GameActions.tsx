'use client';

import React from 'react';
import { Button } from '@/components/ui';
import type { TicketVendor } from '@/lib/schedule-premium';

const OFFICIAL_TICKETS_URL = 'https://floridagators.com/tickets';

type Props = {
  intelUrl: string;
  ticketVendors: TicketVendor[];
  opponentName: string;
};

export function GameActions({ intelUrl, ticketVendors, opponentName }: Props): React.ReactElement {
  const vendors = ticketVendors.slice(0, 3);
  const liveFloors = vendors
    .map((v) => v.priceFrom)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0);
  const lowest = liveFloors.length ? Math.min(...liveFloors) : null;
  const ticketsHref = OFFICIAL_TICKETS_URL;

  return (
    <div className="gv-sched-actions">
      <Button href={intelUrl} variant="primary" className="gv-sched-actions__btn">
        Open Game Week
      </Button>
      <Button
        href={ticketsHref}
        variant="secondary"
        className="gv-sched-actions__btn"
        target="_blank"
        rel="noopener noreferrer"
      >
        {lowest != null ? `Tickets from $${lowest}+` : 'Find tickets'}
      </Button>
      <p className="gv-sched-actions__hint">Official UF tickets for {opponentName}</p>
    </div>
  );
}
