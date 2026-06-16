'use client';

import React from 'react';
import type { RecruitingBoardResponse } from '@/lib/recruiting-board-api';

type Props = {
  classYear: number;
  rankings: RecruitingBoardResponse['rankings'];
  compareRankings?: RecruitingBoardResponse['rankings'] | null;
};

export function YearOverYearChart({ classYear, rankings, compareRankings }: Props): React.ReactElement {
  const current = rankings?.nationalRank ?? null;
  const previous = compareRankings?.nationalRank ?? null;
  const movement = current != null && previous != null ? previous - current : null;

  return (
    <div className="rh-yoy-chart" data-testid="rh-yoy-chart">
      <h3 className="rh-yoy-chart__title">Year-over-Year National Rank</h3>
      <div className="rh-yoy-chart__bars">
        <div className="rh-yoy-chart__col">
          <span className="rh-yoy-chart__value">{previous != null ? `#${previous}` : '—'}</span>
          <div
            className="rh-yoy-chart__bar rh-yoy-chart__bar--prev"
            style={{ height: previous != null ? `${Math.max(20, 100 - previous)}%` : '20%' }}
          />
          <span className="rh-yoy-chart__label">{classYear - 1}</span>
        </div>
        <div className="rh-yoy-chart__col">
          <span className="rh-yoy-chart__value">{current != null ? `#${current}` : '—'}</span>
          <div
            className="rh-yoy-chart__bar rh-yoy-chart__bar--current"
            style={{ height: current != null ? `${Math.max(20, 100 - current)}%` : '20%' }}
          />
          <span className="rh-yoy-chart__label">{classYear}</span>
        </div>
      </div>
      {movement != null ? (
        <p className={`rh-yoy-chart__delta${movement >= 0 ? ' rh-yoy-chart__delta--up' : ''}`}>
          {movement >= 0 ? `↑ ${movement} spots vs last class` : `↓ ${Math.abs(movement)} spots vs last class`}
        </p>
      ) : null}
    </div>
  );
}
