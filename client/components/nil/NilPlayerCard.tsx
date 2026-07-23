'use client';

import React, { useState } from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { PlayerNavLink } from '@/components/vault/PlayerNavLink';
import { playerProfileRoute } from '@/lib/site-routes';
import { estimateNilValuation } from '@/components/recruiting-hub/NILTrackerSection/nil-player-utils';
import { isActiveUfTarget, isCommittedElsewhere, isFloridaSchool } from '@/lib/recruiting-target-filters';

type Props = {
  player: HighPriorityPlayer;
};

function commitLabel(player: HighPriorityPlayer): { text: string; tone: 'commit' | 'target' | 'elsewhere' } {
  if (player.committedTo && isFloridaSchool(player.committedTo)) {
    return { text: 'UF Commit', tone: 'commit' };
  }
  if (isCommittedElsewhere(player)) {
    return { text: 'Committed elsewhere', tone: 'elsewhere' };
  }
  if (isActiveUfTarget(player)) {
    return { text: 'UF Target', tone: 'target' };
  }
  return { text: 'Board', tone: 'target' };
}

function trendTone(delta: number): 'up' | 'down' | 'flat' {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}

export function NilPlayerCard({ player }: Props): React.ReactElement {
  const [photoFailed, setPhotoFailed] = useState(false);
  const photoUrl = `/headshots/${encodeURIComponent(player.slug)}.jpg`;
  const delta = player.delta7d ?? player.movementDelta ?? 0;
  const tone = trendTone(delta);
  const status = commitLabel(player);
  const initials = player.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const href = playerProfileRoute(player.slug, 'futurecast');

  return (
    <PlayerNavLink href={href} className="nil-player-card" data-testid="nil-player-card">
      <div className="nil-player-card__photo-wrap">
        {!photoFailed ? (
          <img
            src={photoUrl}
            alt=""
            className="nil-player-card__photo"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <span className="nil-player-card__photo-fallback" aria-hidden>
            {initials}
          </span>
        )}
      </div>

      <div className="nil-player-card__body">
        <div className="nil-player-card__identity">
          <h3 className="nil-player-card__name">{player.name}</h3>
          <p className="nil-player-card__meta">
            {player.position}
            <span className="nil-player-card__dot">·</span>
            <span className={`nil-player-card__status nil-player-card__status--${status.tone}`}>
              {status.text}
            </span>
          </p>
        </div>

        <div className="nil-player-card__valuation">
          <span className="nil-player-card__val-label">Est. NIL</span>
          <strong className="nil-player-card__val">{estimateNilValuation(player)}</strong>
          <span className={`nil-player-card__trend nil-player-card__trend--${tone}`} aria-label={`Trend ${tone}`}>
            {tone === 'up' ? '↑' : tone === 'down' ? '↓' : '→'}
            {delta !== 0 ? ` ${Math.abs(delta)}%` : ''}
          </span>
        </div>
      </div>

      <span className="nil-player-card__cta" aria-hidden="true">
        Profile
      </span>
    </PlayerNavLink>
  );
}
