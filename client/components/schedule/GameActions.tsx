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
  const lowest = vendors.reduce((min, v) => (v.priceFrom < min ? v.priceFrom : min), vendors[0]?.priceFrom ?? 0);

  return (
    <div className="gv-sched-actions">
      <Button href={intelUrl} variant="primary" className="gv-sched-actions__btn">
        Game Week Intel →
      </Button>
      <div className="gv-sched-tickets">
        <p className="gv-sched-tickets__label">
          Tickets from <strong>${lowest}+</strong>
        </p>
        <div className="gv-sched-tickets__vendors">
          {vendors.map((vendor) => (
            <a
              key={vendor.id}
              href={vendor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="gv-sched-tickets__vendor"
              title={`${vendor.name} from $${vendor.priceFrom}`}
            >
              <span className="gv-sched-tickets__logo" aria-hidden="true">
                {vendor.logo}
              </span>
              <span className="gv-sched-tickets__name">{vendor.name}</span>
              <span className="gv-sched-tickets__price">${vendor.priceFrom}+</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
