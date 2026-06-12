/**
 * Big Board player card.
 * @see server/docs/futurecast-platform-spec.md §4.1
 */
import React from 'react';
import { FitScoreBadge } from './FitScoreBadge';
import { PortalLikelihoodBadge } from './PortalLikelihoodBadge';

export interface PlayerCardProps {
  name: string;
  primaryPosition: string;
  classYear: number;
  photoUrl?: string | null;
  ufFitScore: number;
  portalLikelihood?: number;
  ufStatus: string;
  onClick?: () => void;
}

export function PlayerCard(props: PlayerCardProps): React.ReactElement {
  // TODO(Phase 4): wire props from BigBoardRow API type
  return (
    <article className="fc-player-card" onClick={props.onClick} data-testid="player-card">
      <img src={props.photoUrl ?? undefined} alt="" />
      <h3>{props.name}</h3>
      <p>{props.primaryPosition} · {props.classYear}</p>
      <FitScoreBadge score={props.ufFitScore} />
      {props.portalLikelihood != null && (
        <PortalLikelihoodBadge score={props.portalLikelihood} />
      )}
      <span className="fc-status">{props.ufStatus}</span>
    </article>
  );
}
