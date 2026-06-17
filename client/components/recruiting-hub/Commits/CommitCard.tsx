'use client';

import React, { useState } from 'react';
import type { CommitCardProps } from './mapCommits';
import { formatDate } from '@/components/recruiting-hub/utils/formatDate';
import { playerProfilePath } from '@/lib/player-routes';
import { playerProfileRoute } from '@/lib/site-routes';
import './commit-card.css';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function starsLabel(stars: number): string {
  const n = Math.min(5, Math.max(0, Math.round(stars)));
  return `${'★'.repeat(n)}${'☆'.repeat(5 - n)}`;
}

function measLine(height?: string, weight?: string): string {
  if (height && weight) return `${height} · ${weight} lbs`;
  if (height) return height;
  if (weight) return `${weight} lbs`;
  return '—';
}

export function CommitCard({
  playerId,
  name,
  position,
  height,
  weight,
  ranking,
  stars,
  commitDate,
  hometown,
  school,
  photoUrl,
}: CommitCardProps): React.ReactElement {
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(photoUrl) && !photoFailed;

  return (
    <article className="commit-card" data-testid="rh-commit-card">
      <div className="commit-card__photo-wrap">
        {showPhoto ? (
          <img
            src={photoUrl}
            alt=""
            className="commit-card__photo"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <div className="commit-card__photo-fallback" aria-hidden="true">
            {initials(name)}
          </div>
        )}
      </div>

      <div className="commit-card__head">
        <h3 className="commit-card__name">{name}</h3>
        <p className="commit-card__position">{position}</p>
        <p className="commit-card__meas">{measLine(height, weight)}</p>
      </div>

      <div className="commit-card__rank-row">
        <span className="commit-card__ranking">{ranking}</span>
        {stars > 0 ? <span className="commit-card__stars">{starsLabel(stars)}</span> : null}
      </div>

      {commitDate ? (
        <p className="commit-card__meta">
          <strong>Committed:</strong> {formatDate(commitDate)}
        </p>
      ) : null}
      {school ? (
        <p className="commit-card__meta">
          <strong>School:</strong> {school}
        </p>
      ) : null}
      {hometown ? (
        <p className="commit-card__meta">
          <strong>Hometown:</strong> {hometown}
        </p>
      ) : null}

      <div className="commit-card__actions">
        <a
          href={playerProfilePath(playerId, 'COMMIT', true, name, 'recruiting')}
          className="commit-card__btn commit-card__btn--intel"
        >
          More Intel →
        </a>
        <a
          href={playerProfileRoute(playerId, 'futurecast')}
          className="commit-card__btn commit-card__btn--fc"
        >
          FutureCast →
        </a>
      </div>
    </article>
  );
}
