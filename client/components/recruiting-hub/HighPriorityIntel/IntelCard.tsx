'use client';

import React from 'react';
import { PositionIcon } from '@/components/ui/PositionIcon';
import { HEAT_LABELS, type IntelCardProps } from '@/components/recruiting-hub/types/intel';
import { formatIntelUpdated } from '@/components/recruiting-hub/utils/formatDate';
import { playerProfilePath } from '@/lib/player-routes';
import { playerProfileRoute } from '@/lib/site-routes';
import './intel-card.css';

export type { IntelCardProps };

export function IntelCard(props: IntelCardProps): React.ReactElement {
  const {
    name,
    position,
    classYear,
    ufProbability,
    heatStatus,
    intelType,
    intelText,
    timestamp,
    playerId,
  } = props;

  return (
    <article className="intel-card" data-testid="rh-intel-card">
      {/* Top — identity + UF probability */}
      <div className="intel-card__top">
        <div className="intel-card__identity">
          <PositionIcon position={position} size="sm" variant="on-blue" showLabel={false} />
          <div className="intel-card__identity-text">
            <h3 className="intel-card__name">{name}</h3>
            <p className="intel-card__meta">
              {position} · Class {classYear}
            </p>
          </div>
        </div>
        <div className="intel-card__uf-block">
          <span className="intel-card__uf-pct">{ufProbability}%</span>
          <span className="intel-card__uf-label">UF Probability</span>
        </div>
      </div>

      {/* Heat tag */}
      <span className={`intel-card__heat intel-card__heat--${heatStatus}`}>{HEAT_LABELS[heatStatus]}</span>

      {/* Middle — intel type + analyst signals */}
      <div className="intel-card__middle">
        <span className="intel-card__intel-type">{intelType}</span>
        <div className="rh-analyst-signals">
          <span className="rh-analyst-signals__label">Analyst Signals</span>
          <p className="rh-analyst-signals__text intel-card__intel-text">{intelText}</p>
        </div>
      </div>

      {/* Bottom — timestamp + actions */}
      <footer className="intel-card__bottom">
        <time className="intel-card__time" dateTime={timestamp}>
          Updated {formatIntelUpdated(timestamp)}
        </time>
        <div className="intel-card__actions">
          <a
            href={playerProfileRoute(playerId, 'futurecast')}
            className="intel-card__btn intel-card__btn--primary"
          >
            FutureCast
          </a>
          <a
            href={playerProfilePath(playerId, 'target', true, name, 'recruiting')}
            className="intel-card__btn intel-card__btn--secondary"
          >
            More Intel
          </a>
        </div>
      </footer>
    </article>
  );
}
