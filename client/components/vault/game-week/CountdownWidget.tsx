'use client';

import React, { useMemo } from 'react';
import { daysUntilKickoff } from '@/lib/game-week-data';

type Props = {
  dateStr: string;
};

export function CountdownWidget({ dateStr }: Props): React.ReactElement {
  const days = useMemo(() => daysUntilKickoff(dateStr), [dateStr]);
  return (
    <div className="gv-gw-countdown" data-testid="gw-countdown">
      <span className="gv-gw-countdown__num">{days}</span>
      <span className="gv-gw-countdown__label">Days to kickoff</span>
    </div>
  );
}
