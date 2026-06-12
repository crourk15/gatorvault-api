/** Movement Tracker tab — players with most signals (proxy for activity) */
import React from 'react';
import { BigBoardGrid } from '../../../components/futurecast/BigBoardGrid';

export interface MovementTrackerTabProps {
  classYear?: number;
}

export default function MovementTrackerTab({
  classYear = 2026,
}: MovementTrackerTabProps): React.ReactElement {
  return (
    <div data-testid="tab-movement-tracker">
      <BigBoardGrid
        query={{ class_year: classYear, sort: 'signals', order: 'desc', limit: 200 }}
      />
    </div>
  );
}
