'use client';

import React from 'react';
import type { BigBoardPlayer } from '@/lib/big-board-api';
import { formatCompositeRating, formatRank, starsDisplay } from '@/lib/recruiting-board-utils';
import { playerProfilePath } from '@/lib/player-routes';

type Props = {
  player: BigBoardPlayer;
  inVault?: boolean;
};

function lifecycleContext(lifecycle: BigBoardPlayer['lifecycle']): 'futurecast' | 'recruiting' {
  return lifecycle === 'HS' ? 'futurecast' : 'recruiting';
}

/** Premium directory card — recruiting identity, not spreadsheet rows. */
export function PlayerDirectoryCard({ player, inVault = false }: Props): React.ReactElement {
  const href = playerProfilePath(
    player.slug,
    player.lifecycle,
    inVault,
    player.fullName,
    lifecycleContext(player.lifecycle)
  );
  const composite = formatCompositeRating(player.compositeScore ?? player.rating ?? 0);
  const fitPct = Math.round(player.ufFitScore ?? 0);
  const targetPct = Math.round(player.portalLikelihood ?? 0);

  return (
    <article className="gv-pdir-card" data-testid="player-directory-card">
      <a href={href} className="gv-pdir-card__link">
        <div className="gv-pdir-card__header">
          <h3 className="gv-pdir-card__name">{player.fullName}</h3>
          <div className="gv-pdir-card__badge-row">
            <span className="gv-pdir-card__pos">{player.position}</span>
            {player.stars ? (
              <span className="gv-pdir-card__stars" aria-label={`${player.stars} stars`}>
                {starsDisplay(player.stars)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="gv-pdir-card__rating-row">
          <span className="gv-pdir-card__composite">{composite ?? '—'}</span>
          <span className="gv-pdir-card__composite-label">Composite</span>
        </div>

        <p className="gv-pdir-card__ranks">
          NATL {formatRank(player.nationalRank ?? player.rank)} · POS{' '}
          {formatRank(player.positionRank)} · ST {formatRank(player.stateRank)}
        </p>

        <div className="gv-pdir-card__metrics">
          <span className="gv-pdir-card__metric">
            <strong>{fitPct}%</strong> Fit
          </span>
          <span className="gv-pdir-card__metric">
            <strong>{targetPct}%</strong> Target
          </span>
          <span className="gv-pdir-card__metric">
            <strong>{player.signalCount}</strong> Signals
          </span>
        </div>
      </a>
    </article>
  );
}
