'use client';

import React, { useState } from 'react';
import { PlayerNavLink } from '@/components/vault/PlayerNavLink';
import { playerProfileRoute } from '@/lib/site-routes';
import type { NilEliteBoardPlayer } from '@/lib/nil-elite-api';

type Props = {
  player: NilEliteBoardPlayer;
};

function statusMeta(player: NilEliteBoardPlayer): { text: string; tone: string } {
  if (player.status === 'uf_commit') return { text: 'UF Commit', tone: 'commit' };
  if (player.status === 'elsewhere') return { text: 'Committed elsewhere', tone: 'elsewhere' };
  if (player.status === 'uf_target') return { text: 'UF Target', tone: 'target' };
  return { text: 'Board', tone: 'target' };
}

export function NilPlayerCard({ player }: Props): React.ReactElement {
  const [photoFailed, setPhotoFailed] = useState(false);
  const photoUrl = `/headshots/${encodeURIComponent(player.slug)}.jpg`;
  const status = statusMeta(player);
  const initials = player.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const href = playerProfileRoute(player.slug, 'futurecast');
  const display = player.nilDisplay || player.nilEstimate || player.vaultEstimate;
  const label =
    player.nilSource === 'on3' || player.nilEstimate
      ? 'On3 NIL'
      : display
        ? 'Vault est.'
        : player.ufRpmPct != null
          ? 'UF board'
          : 'Board';

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
            {player.stars != null ? (
              <>
                <span className="nil-player-card__dot">·</span>
                {player.stars}★
              </>
            ) : null}
            {player.nationalRank != null ? (
              <>
                <span className="nil-player-card__dot">·</span>#{player.nationalRank}
              </>
            ) : null}
            <span className="nil-player-card__dot">·</span>
            <span className={`nil-player-card__status nil-player-card__status--${status.tone}`}>
              {status.text}
            </span>
          </p>
        </div>

        <div className="nil-player-card__valuation">
          {display ? (
            <>
              <span className="nil-player-card__val-label">{label}</span>
              <strong className="nil-player-card__val">{display}</strong>
            </>
          ) : player.ufRpmPct != null ? (
            <>
              <span className="nil-player-card__val-label">UF board</span>
              <strong className="nil-player-card__val">{player.ufRpmPct}%</strong>
            </>
          ) : (
            <>
              <span className="nil-player-card__val-label">Board</span>
              <strong className="nil-player-card__val">
                {player.stars != null ? `${player.stars}★` : '—'}
              </strong>
            </>
          )}
        </div>
      </div>

      <span className="nil-player-card__cta" aria-hidden="true">
        Profile
      </span>
    </PlayerNavLink>
  );
}
