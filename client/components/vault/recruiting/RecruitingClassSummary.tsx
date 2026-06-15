'use client';

import React from 'react';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import type { RecruitingBoardResponse } from '@/lib/recruiting-board-api';

type Props = {
  commits: RecruitingBoardPlayer[];
  rankings: RecruitingBoardResponse['rankings'];
  classYear: number;
  priorClassYear?: number;
  compareRankings?: RecruitingBoardResponse['rankings'];
  inline?: boolean;
};

export function ClassSummaryStats({
  commits,
  rankings,
  classYear,
  priorClassYear = 2026,
  compareRankings,
  inline,
}: Props): React.ReactElement {
  const blueChips = commits.filter((c) => (Number(c.stars) || 0) >= 4).length;
  const inStateCount = commits.filter((c) => c.inState).length;
  const inStatePct = commits.length ? Math.round((inStateCount / commits.length) * 100) : 0;

  const cards = [
    {
      icon: '🎯',
      label: 'Commits',
      value: String(commits.length),
      sub: `${classYear} Class`,
    },
    {
      icon: '🏆',
      label: 'National Rank',
      value: rankings?.nationalRank != null ? `#${rankings.nationalRank}` : '—',
      sub: 'Composite class',
    },
    {
      icon: '🐊',
      label: 'SEC Rank',
      value: rankings?.secRank != null ? `#${rankings.secRank}` : '—',
      sub: 'Conference',
    },
    {
      icon: '⭐',
      label: 'Class Score',
      value: rankings?.classScore != null ? Number(rankings.classScore).toFixed(2) : '—',
      sub: `${classYear} cycle`,
    },
    {
      icon: '📊',
      label: `${priorClassYear} Class Score`,
      value: compareRankings?.classScore != null ? Number(compareRankings.classScore).toFixed(2) : '—',
      sub: 'Prior class',
    },
    {
      icon: '💎',
      label: 'Blue Chips',
      value: String(blueChips),
      sub: '4★+ commits',
    },
    {
      icon: '📍',
      label: 'In-State %',
      value: `${inStatePct}%`,
      sub: `${inStateCount} of ${commits.length || 0}`,
    },
    {
      icon: '🎓',
      label: 'Head Coach',
      value: 'Sumrall',
      sub: 'Jon Sumrall',
    },
  ];

  const Tag = inline ? 'div' : 'section';

  return (
    <Tag className={`gv-rh-summary${inline ? ' gv-rh-summary--inline' : ''}`} aria-label="Class summary">
      {!inline && (
        <div className="gv-rh-hub__frame">
          <h2 className="gv-rh-section-title gv-type-h3">Class Summary</h2>
        </div>
      )}
      <div className={inline ? undefined : 'gv-rh-hub__frame'}>
        <div className="gv-rh-summary__grid">
          {cards.map((card) => (
            <div key={card.label} className="gv-rh-summary__card">
              <span className="gv-rh-summary__icon" aria-hidden="true">
                {card.icon}
              </span>
              <p className="gv-rh-summary__value gv-type-number">{card.value}</p>
              <p className="gv-rh-summary__label">{card.label}</p>
              {card.sub && <p className="gv-rh-summary__sub">{card.sub}</p>}
            </div>
          ))}
        </div>
      </div>
    </Tag>
  );
}

/** @deprecated use ClassSummaryStats */
export const RecruitingClassSummary = ClassSummaryStats;
