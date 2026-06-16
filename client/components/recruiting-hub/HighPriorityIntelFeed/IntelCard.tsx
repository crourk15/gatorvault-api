'use client';

import React from 'react';
import type { RecruitingIntelItem } from '@/api/recruiting';
import { PositionIcon } from '@/components/recruiting-hub/Icons/PositionIcon';
import { formatIntelTimestamp } from '@/components/recruiting-hub/utils/formatDate';
import { playerProfilePath } from '@/lib/player-routes';

type Props = {
  item: RecruitingIntelItem;
  playerName: string;
  position?: string | null;
};

export function IntelCard({ item, playerName, position }: Props): React.ReactElement {
  const href = playerProfilePath(item.playerId, 'target', true, playerName, 'recruiting');
  const ufPct = Math.min(100, Math.max(0, item.ufProbability));

  return (
    <article className="rh-intel-card">
      <div className="rh-intel-card__head">
        <PositionIcon position={position} size="sm" />
        <h3 className="rh-intel-card__name">{playerName}</h3>
      </div>
      <div className="rh-intel-card__meter" aria-label={`UF probability ${ufPct} percent`}>
        <div className="rh-intel-card__meter-fill" style={{ width: `${ufPct}%` }} />
      </div>
      <p className="rh-intel-card__text">{item.text}</p>
      <p className="rh-intel-card__time">{formatIntelTimestamp(item.timestamp)}</p>
      <a href={href} className="rh-intel-card__link">
        View More Intel →
      </a>
    </article>
  );
}
