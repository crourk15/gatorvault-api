'use client';

import React from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { playerProfileRoute } from '@/lib/site-routes';
import { comfortZone, estimateNilValuation, marketTrend, positionBand, ufNilFitLabel } from './nil-player-utils';

type Props = {
  player: HighPriorityPlayer;
};

export function NILRow({ player }: Props): React.ReactElement {
  const comfort = comfortZone(player);

  return (
    <tr>
      <td>
        <a href={playerProfileRoute(player.slug, 'futurecast')} className="rh-nil-row__player">
          <strong>{player.name}</strong>
          <span>{player.position}</span>
        </a>
      </td>
      <td>{estimateNilValuation(player)}</td>
      <td>{ufNilFitLabel(player)}</td>
      <td>{marketTrend(player)}</td>
      <td>{positionBand(player)}</td>
      <td>
        <span className={`rh-nil-row__comfort rh-nil-row__comfort--${comfort.level}`}>{comfort.label}</span>
      </td>
    </tr>
  );
}
