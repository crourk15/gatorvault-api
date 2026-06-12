/**
 * Big Board player card — consumes /api/big-board rows.
 */
import React from 'react';
import type { BigBoardPlayer } from '../../lib/big-board-api';
import { FitScoreBadge } from './FitScoreBadge';
import { PortalLikelihoodBadge } from './PortalLikelihoodBadge';

export interface PlayerCardProps {
  player: BigBoardPlayer;
  onClick?: (player: BigBoardPlayer) => void;
}

export function PlayerCard({ player, onClick }: PlayerCardProps): React.ReactElement {
  const showPortal =
    player.lifecycle === 'COLLEGE' || player.lifecycle === 'PORTAL' || player.portalLikelihood > 0;

  return (
    <article
      className="fc-player-card"
      onClick={() => onClick?.(player)}
      data-testid="player-card"
      data-slug={player.slug}
    >
      <div className="fc-player-card__rank">#{player.rank}</div>
      <h3 className="fc-player-card__name">{player.fullName}</h3>
      <p className="fc-player-card__meta">
        {player.position} · {player.classYear} · {player.lifecycle}
      </p>
      <div className="fc-player-card__badges">
        <FitScoreBadge score={player.ufFitScore} />
        {showPortal && <PortalLikelihoodBadge score={player.portalLikelihood} />}
        <span className="fc-signal-pill">{player.signalCount} signals</span>
        {player.portalStatus && <span className="fc-status">{player.portalStatus}</span>}
      </div>
    </article>
  );
}
