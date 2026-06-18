'use client';

import React from 'react';
import { useBoardsSummary } from '@/hooks/home/useBoardsSummary';
import { SITE_ROUTES } from '@/lib/site-routes';

export function HomeBoardsSlider(): React.ReactElement | null {
  const boards = useBoardsSummary();

  if (!boards) {
    return <div className="gv-home-skeleton-block" aria-hidden />;
  }

  if (!boards.length) return null;

  return (
    <div className="gv-card gv-card--boards" data-testid="home-boards-slider">
      <div className="gv-card__header">
        <div className="gv-card__title">Recruiting Boards</div>
        <div className="gv-card__meta">2026 • 2027 • 2028</div>
      </div>
      <div className="gv-card__body">
        <div className="gv-boards-slider">
          <div className="gv-boards-slider__scroll no-scrollbar">
            {boards.map((b) => (
              <a
                key={b.classYear}
                href={`${SITE_ROUTES.recruiting}?class=${b.classYear}`}
                className="gv-board-card"
              >
                <div className="gv-board-card__year">Class of {b.classYear}</div>
                <div className="gv-board-card__rank">Rank #{b.rank}</div>
                <div className="gv-board-card__bluechip">
                  Blue Chip {b.blueChipPercent != null ? `${b.blueChipPercent}%` : '—'}
                </div>
                <div className="gv-board-card__commits">{b.commitCount} commits</div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
