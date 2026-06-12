/**
 * Related players grid — same position + class year from /api/players/:id/related.
 */
import React from 'react';
import type { BigBoardPlayer } from '../../lib/big-board-api';
import { fitTier } from '../../lib/player-derived';

export interface RelatedPlayersProps {
  players: BigBoardPlayer[];
  currentSlug?: string;
}

export function RelatedPlayers({ players, currentSlug }: RelatedPlayersProps): React.ReactElement {
  const list = players.filter((p) => p.slug !== currentSlug);
  if (!list.length) {
    return <p className="fc-profile-empty">No related players in this class and position.</p>;
  }

  return (
    <div className="fc-related-grid" data-testid="related-players">
      {list.map((p) => (
        <a
          key={p.id}
          href={`/futurecast/player/${p.slug}`}
          className="fc-related-card"
        >
          <span className="fc-related-card__rank">#{p.rank}</span>
          <span className="fc-related-card__name">{p.fullName}</span>
          <span className="fc-related-card__meta">
            {p.position} · UF Fit {p.ufFitScore}
          </span>
          <span className={`fc-fit-badge fc-fit-badge--${fitTier(p.ufFitScore)}`}>
            {fitTier(p.ufFitScore)}
          </span>
        </a>
      ))}
    </div>
  );
}
