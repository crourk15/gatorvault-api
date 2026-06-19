'use client';

import React, { useState } from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { PlayerNavLink } from '@/components/vault/PlayerNavLink';
import { playerProfileRoute } from '@/lib/site-routes';
import { estimateNilValuation } from '@/components/recruiting-hub/NILTrackerSection/nil-player-utils';

type Props = {
  player: HighPriorityPlayer;
};

function commitLabel(player: HighPriorityPlayer): string {
  if (player.committedTo) {
    return String(player.committedTo).toLowerCase().includes('florida') ? 'UF Commit' : 'Open';
  }
  return 'UF Target';
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
  const initials = player.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <article className="nil-player-card" data-testid="nil-player-card">
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
            <span className={`nil-player-card__status nil-player-card__status--${commitLabel(player) === 'UF Commit' ? 'commit' : 'target'}`}>
              {commitLabel(player)}
            </span>
          </p>
        </div>

        <div className="nil-player-card__valuation">
          <span className="nil-player-card__val-label">NIL Valuation</span>
          <strong className="nil-player-card__val">{estimateNilValuation(player)}</strong>
          <span className={`nil-player-card__trend nil-player-card__trend--${tone}`} aria-label={`Trend ${tone}`}>
            {tone === 'up' ? '↑' : tone === 'down' ? '↓' : '→'}
            {delta !== 0 ? ` ${Math.abs(delta)}%` : ''}
          </span>
        </div>
      </div>

      <PlayerNavLink href={playerProfileRoute(player.slug, 'futurecast')} className="nil-player-card__cta">
        View Profile
      </PlayerNavLink>
    </article>
  );
}
