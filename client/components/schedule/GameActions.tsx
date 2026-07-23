'use client';

import React from 'react';
import { Button } from '@/components/ui';
import type { TicketVendor } from '@/lib/schedule-premium';

type Props = {
  intelUrl: string;
  ticketVendors: TicketVendor[];
};

export function GameActions({ intelUrl, ticketVendors }: Props): React.ReactElement {
  const vendors = ticketVendors.slice(0, 3);
  const liveFloors = vendors
    .map((v) => v.priceFrom)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0);
  const lowest = liveFloors.length ? Math.min(...liveFloors) : null;

  return (
    <div className="gv-sched-actions">
      <Button href={intelUrl} variant="primary" className="gv-sched-actions__btn">
        Game Week Intel →
      </Button>
      <div className="gv-sched-tickets">
        <p className="gv-sched-tickets__label">
          {lowest != null ? (
            <>
              Tickets from <strong>${lowest}+</strong>
            </>
          ) : (
            <>Tickets</>
          )}
        </p>
        <div className="gv-sched-tickets__links" role="list">
          {vendors.map((vendor) => (
            <a
              key={vendor.id}
              href={vendor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="gv-sched-tickets__link"
              role="listitem"
              title={
                vendor.priceFrom != null
                  ? `${vendor.name} from $${vendor.priceFrom}`
                  : `Find tickets on ${vendor.name}`
              }
            >
              {vendor.name}
              {vendor.priceFrom != null ? (
                <span className="gv-sched-tickets__price">${vendor.priceFrom}+</span>
              ) : null}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
