'use client';

import React from 'react';
import type { FcLabTarget } from '@/components/futurecast/lab/fc-lab-types';
import { ufPctFromFc } from '@/components/futurecast/lab/fc-lab-types';
import {
  buildChaseWhy,
  chaseFightLine,
  chaseHeatLabel,
} from '@/components/futurecast/lab/chase-priority';
import { playerProfileRoute } from '@/lib/vault-route-map';

type Props = {
  player: FcLabTarget;
  rank: number;
  showMovement?: boolean;
};

/**
 * Priority chase card — rank + why this name is a class fight, not a lead board.
 */
export function FutureCastChaseCard({
  player,
  rank,
  showMovement = true,
}: Props): React.ReactElement {
  const pct = ufPctFromFc(player.ufProbability);
  const delta = showMovement ? Math.round(player.delta7d ?? 0) : 0;
  const fit =
    player.fitScore != null && Number(player.fitScore) > 0
      ? Math.round(Number(player.fitScore))
      : null;
  const heat = chaseHeatLabel(player.priorityScore);
  const why = buildChaseWhy(player);
  const fight = chaseFightLine(player);
  const topChase = rank === 1;

  return (
    <a
      href={playerProfileRoute(player.slug, 'futurecast')}
      className={`fc-lab-chase-card${topChase ? ' fc-lab-chase-card--top' : ''}`}
      data-testid="fc-lab-chase-card"
      data-rank={rank}
    >
      <div className="fc-lab-chase-card__top">
        <span className="fc-lab-chase-card__rank" aria-hidden>
          #{rank}
        </span>
        <div className="fc-lab-chase-card__identity">
          <span className="fc-lab-chase-card__name">{player.name}</span>
          <span className="fc-lab-chase-card__meta">
            {player.position}
            {player.school ? ` · ${player.school}` : ''}
            {player.stars != null ? ` · ${player.stars}★` : ''}
          </span>
        </div>
        {topChase ? (
          <span className="fc-lab-chase-stamp fc-lab-chase-stamp--top">Top chase</span>
        ) : (
          <span className="fc-lab-chase-stamp fc-lab-chase-stamp--prio">Priority</span>
        )}
      </div>

      <div className="fc-lab-chase-card__facts">
        <div className="fc-lab-chase-fact">
          <span className="fc-lab-chase-fact__label">Chase heat</span>
          <span className="fc-lab-chase-fact__value fc-lab-chase-fact__value--strong">{heat}</span>
        </div>
        <div className="fc-lab-chase-fact">
          <span className="fc-lab-chase-fact__label">Scheme fit</span>
          <span className="fc-lab-chase-fact__value">{fit != null ? `${fit}` : '—'}</span>
        </div>
        <div className="fc-lab-chase-fact">
          <span className="fc-lab-chase-fact__label">Florida chance</span>
          <span className="fc-lab-chase-fact__value">
            {pct > 0 ? `${pct}%` : '—'}
            {delta !== 0 ? (
              <span className={delta > 0 ? 'is-up' : 'is-down'}>
                {delta > 0 ? '+' : ''}
                {delta}
              </span>
            ) : null}
          </span>
        </div>
      </div>

      <p className="fc-lab-chase-card__why">
        <span className="fc-lab-chase-card__why-label">Why #{rank}</span>
        {why.summary}
      </p>
      <p className="fc-lab-chase-card__fight">{fight}</p>
    </a>
  );
}
