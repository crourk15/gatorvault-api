/** Early Discovery tab — 2028+ underclassmen via /api/futurecast/early-discovery */
import React from 'react';
import { EarlyDiscoveryGrid } from '../../../components/futurecast/EarlyDiscoveryGrid';

export interface EarlyDiscoveryTabProps {
  classYear?: number;
}

export default function EarlyDiscoveryTab({
  classYear = 2028,
}: EarlyDiscoveryTabProps): React.ReactElement {
  return (
    <div data-testid="tab-early-discovery">
      <EarlyDiscoveryGrid
        query={{
          class_year_gte: classYear,
          min_discovery_score: 50,
          limit: 100,
        }}
      />
    </div>
  );
}
