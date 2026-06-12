/** Portal Watchlist tab — uses Portal Intelligence API */
import React from 'react';
import { PortalWatchlistGrid } from '../../../components/futurecast/PortalWatchlistGrid';

export interface PortalWatchlistTabProps {
  classYear?: number;
}

export default function PortalWatchlistTab({
  classYear = 2026,
}: PortalWatchlistTabProps): React.ReactElement {
  return (
    <div data-testid="tab-portal-watchlist">
      <PortalWatchlistGrid
        query={{
          class_year: classYear,
          sort: 'likelihood',
          likelihood_min: 0.25,
          limit: 100,
        }}
      />
    </div>
  );
}
