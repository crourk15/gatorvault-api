/** Early Discovery tab — HS players sorted by signals via /api/big-board */
import React from 'react';
import { BigBoardGrid } from '../../../components/futurecast/BigBoardGrid';

export interface EarlyDiscoveryTabProps {
  classYear?: number;
}

export default function EarlyDiscoveryTab({
  classYear = 2028,
}: EarlyDiscoveryTabProps): React.ReactElement {
  return (
    <div data-testid="tab-early-discovery">
      <BigBoardGrid
        query={{
          class_year: classYear,
          lifecycle: 'HS',
          sort: 'signals',
          order: 'desc',
          limit: 200,
        }}
      />
    </div>
  );
}
