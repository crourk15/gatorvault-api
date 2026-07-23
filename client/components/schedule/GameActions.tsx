'use client';

import React from 'react';
import type { TicketVendor } from '@/lib/schedule-premium';

type Props = {
  ticketVendors: TicketVendor[];
  opponentName: string;
};

const VENDOR_MARK: Record<string, string> = {
  stubhub: 'SH',
  seatgeek: 'SG',
  vivid: 'VS',
};

export function GameActions({ ticketVendors, opponentName }: Props): React.ReactElement {
  const vendors = ticketVendors.slice(0, 3);
  const liveFloors = vendors
    .map((v) => v.priceFrom)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0);
  const lowest = liveFloors.length ? Math.min(...liveFloors) : null;

  return (
    <div className="gv-sched-tickets" data-testid="schedule-tickets">
      <div className="gv-sched-tickets__head">
        <p className="gv-sched-tickets__label">Tickets</p>
        {lowest != null ? (
          <p className="gv-sched-tickets__from">
            from <strong>${lowest}+</strong>
          </p>
        ) : (
          <p className="gv-sched-tickets__from">Compare markets</p>
        )}
      </div>
      <div className="gv-sched-tickets__grid" role="list" aria-label={`Ticket options for ${opponentName}`}>
        {vendors.map((vendor) => (
          <a
            key={vendor.id}
            href={vendor.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`gv-sched-tickets__vendor gv-sched-tickets__vendor--${vendor.id}`}
            role="listitem"
            title={`Find ${opponentName} tickets on ${vendor.name}`}
          >
            <span className="gv-sched-tickets__mark" aria-hidden="true">
              {VENDOR_MARK[vendor.id] ?? vendor.logo}
            </span>
            <span className="gv-sched-tickets__name">{vendor.name}</span>
            {vendor.priceFrom != null ? (
              <span className="gv-sched-tickets__price">${vendor.priceFrom}+</span>
            ) : (
              <span className="gv-sched-tickets__cta">View</span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
