/**
 * Big Board player card — links to vault FutureCast player profile.
 */
import React from 'react';
import type { BigBoardPlayer } from '../../lib/big-board-api';
import { playerProfilePath } from '@/lib/player-routes';
import { usePathname } from '@/lib/use-pathname';
import { isVaultPath } from '@/lib/vault-routes';
import { FitScoreBadge } from './FitScoreBadge';
import { PortalLikelihoodBadge } from './PortalLikelihoodBadge';

export interface PlayerCardProps {
  player: BigBoardPlayer;
  onClick?: (player: BigBoardPlayer) => void;
}

export function PlayerCard({ player, onClick }: PlayerCardProps): React.ReactElement {
  const pathname = usePathname();
  const inVault = isVaultPath(pathname);
  const href = playerProfilePath(
    player.slug,
    player.lifecycle ?? 'HIGH_SCHOOL',
    inVault,
    player.fullName,
    inVault ? 'futurecast' : undefined
  );
  const showPortal =
    player.lifecycle === 'COLLEGE' || player.lifecycle === 'PORTAL' || player.portalLikelihood > 0;

  return (
    <a
      href={href}
      className="fc-player-card"
      onClick={(e) => {
        if (onClick) {
          e.preventDefault();
          onClick(player);
        }
      }}
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
    </a>
  );
}
