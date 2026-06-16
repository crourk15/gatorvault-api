'use client';

import React from 'react';
import type { RecruitingBoardPlayer, RecruitingBoardResponse } from '@/lib/recruiting-board-api';

type Props = {
  commits: RecruitingBoardPlayer[];
  rankings: RecruitingBoardResponse['rankings'];
  compareRankings?: RecruitingBoardResponse['rankings'];
  classYear: number;
};

export function StatsBar({ commits, rankings, compareRankings, classYear }: Props): React.ReactElement {
  const blueChips = commits.filter((c) => (Number(c.stars) || 0) >= 4).length;
  const inStateCount = commits.filter((c) => c.inState || String(c.state || '').toUpperCase() === 'FL').length;
  const inStatePct = commits.length ? Math.round((inStateCount / commits.length) * 100) : 0;

  return (
    <div className="rh-stats-bar" data-testid="rh-stats-bar">
      <div className="rh-stats-bar__item rh-stats-bar__item--accent">
        <span className="rh-stats-bar__label">Commits</span>
        <span className="rh-stats-bar__value">{commits.length}</span>
      </div>
      <div className="rh-stats-bar__item">
        <span className="rh-stats-bar__label">National Rank</span>
        <span className="rh-stats-bar__value">
          {rankings?.nationalRank != null ? `#${rankings.nationalRank}` : '—'}
        </span>
      </div>
      <div className="rh-stats-bar__item">
        <span className="rh-stats-bar__label">SEC Rank</span>
        <span className="rh-stats-bar__value">
          {rankings?.secRank != null ? `#${rankings.secRank}` : '—'}
        </span>
      </div>
      <div className="rh-stats-bar__item rh-stats-bar__item--accent">
        <span className="rh-stats-bar__label">Class Score</span>
        <span className="rh-stats-bar__value">
          {rankings?.classScore != null ? Number(rankings.classScore).toFixed(2) : '—'}
        </span>
      </div>
      <div className="rh-stats-bar__item">
        <span className="rh-stats-bar__label">Blue Chips</span>
        <span className="rh-stats-bar__value">{blueChips}</span>
      </div>
      <div className="rh-stats-bar__item">
        <span className="rh-stats-bar__label">In-State %</span>
        <span className="rh-stats-bar__value">{inStatePct}%</span>
      </div>
      {compareRankings ? (
        <div className="rh-stats-bar__item">
          <span className="rh-stats-bar__label">{classYear - 1} Natl</span>
          <span className="rh-stats-bar__value">
            {compareRankings.nationalRank != null ? `#${compareRankings.nationalRank}` : '—'}
          </span>
        </div>
      ) : null}
    </div>
  );
}
