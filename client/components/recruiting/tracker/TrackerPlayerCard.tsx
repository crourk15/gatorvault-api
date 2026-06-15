'use client';

import React from 'react';
import Link from 'next/link';
import type { TrackerPlayer } from '@/lib/tracker-api';
import { trackerStatusClass } from '@/lib/tracker-api';
import { playerProfilePath, recruitingProfileLifecycle } from '@/lib/player-routes';

type Props = {
  player: TrackerPlayer;
};

export function TrackerPlayerCard({ player }: Props): React.ReactElement {
  const href = playerProfilePath(
    player.slug,
    recruitingProfileLifecycle({ isCommittedToUF: player.status === 'Committed' }),
    false,
    player.name,
    'recruiting'
  );

  return (
    <Link
      href={href}
      className={`tracker-card status-${trackerStatusClass(player.status)}`}
      data-testid="tracker-player-card"
    >
      <div className="tracker-photo" aria-hidden="true">
        {player.name.slice(0, 1)}
      </div>
      <div className="tracker-info">
        <h3>{player.name}</h3>
        <p>
          {player.position} • {player.rating > 0 ? player.rating.toFixed(2) : '—'}
          {player.ranking > 0 ? ` • #${player.ranking}` : ''}
        </p>
        <p className="tracker-school">{player.school}</p>
        {player.prediction ? <p className="tracker-prediction">{player.prediction}</p> : null}
      </div>
      <div className="tracker-status">{player.status}</div>
    </Link>
  );
}
