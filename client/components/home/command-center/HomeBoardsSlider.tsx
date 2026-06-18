'use client';

import React from 'react';
import type { HomeBoardPreview } from '@/lib/vault-home-api';
import { SITE_ROUTES } from '@/lib/site-routes';

type Props = {
  boards: HomeBoardPreview[];
  loading?: boolean;
};

export function HomeBoardsSlider({ boards, loading }: Props): React.ReactElement {
  if (loading) {
    return (
      <section className="gv-hcc-section" aria-label="Boards preview">
        <div className="gv-hcc-boards no-scrollbar">
          {[1, 2, 3].map((n) => (
            <div key={n} className="gv-hcc-board-card gv-hcc-skeleton" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="gv-hcc-section" aria-label="Boards preview" data-testid="home-boards-slider">
      <header className="gv-hcc-section__head">
        <h2 className="gv-hcc-section__title">Recruiting Boards</h2>
      </header>
      <div className="gv-hcc-boards no-scrollbar">
        {boards.map((board) => (
          <a
            key={board.year}
            href={`${SITE_ROUTES.recruiting}/board?class=${board.year}`}
            className="gv-hcc-board-card"
          >
            <h3 className="gv-hcc-board-card__year">{board.year} Board</h3>
            <p className="gv-hcc-board-card__meta">
              Rank {board.classRank != null ? `#${board.classRank}` : '—'}
            </p>
            <p className="gv-hcc-board-card__meta">
              Blue Chip {board.blueChipPct != null ? `${board.blueChipPct}%` : '—'}
            </p>
            <p className="gv-hcc-board-card__meta">{board.commitCount} commits</p>
          </a>
        ))}
      </div>
    </section>
  );
}
