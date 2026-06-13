'use client';

import React from 'react';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import {
  formatCommitDate,
  formatCompositeRating,
  formatRank,
  playerPos,
  playerRating,
  starsDisplay,
} from '@/lib/recruiting-board-utils';
import { playerProfilePath, recruitingProfileLifecycle } from '@/lib/player-routes';

export type RatingCardVariant = 'commit' | 'target';

function movementArrow(dir?: 'up' | 'down' | 'flat'): React.ReactNode {
  if (dir === 'up') return <span className="gv-rb-card__move gv-rb-card__move--up" aria-label="Trending up">▲</span>;
  if (dir === 'down') return <span className="gv-rb-card__move gv-rb-card__move--down" aria-label="Trending down">▼</span>;
  if (dir === 'flat') return <span className="gv-rb-card__move gv-rb-card__move--flat" aria-label="Stable">◆</span>;
  return null;
}

function visitBadge(player: RecruitingBoardPlayer): string | null {
  const ov = String(player.ufOvStatus || '').toLowerCase();
  if (ov.includes('scheduled') || player.visitStart) return '🔥 Visit Scheduled';
  if (ov.includes('cancelled')) return '🟥 Visit Cancelled';
  return null;
}

function heatMeter(pct: number): React.ReactElement {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="gv-rb-card__heat" aria-label={`UF interest ${clamped}%`}>
      <div className="gv-rb-card__heat-track">
        <div className="gv-rb-card__heat-fill" style={{ width: `${clamped}%` }} />
      </div>
      <span className="gv-rb-card__heat-pct">{clamped}%</span>
    </div>
  );
}

export function RatingRecruitCard({
  player,
  variant,
}: {
  player: RecruitingBoardPlayer;
  variant: RatingCardVariant;
}): React.ReactElement {
  const href = playerProfilePath(
    player.slug,
    recruitingProfileLifecycle(player),
    true,
    player.name,
    'recruiting'
  );
  const ratingStr = formatCompositeRating(player.displayRating ?? player.rating ?? playerRating(player) / 100);
  const pos = playerPos(player);
  const visit = visitBadge(player);
  const skinny = player.skinny || player.profileNote || player.notePreview || player.notes;
  const heatPct =
    player.ufProbability != null
      ? Math.round(Number(player.ufProbability) * 100)
      : player.fitScore != null
        ? Math.round(Number(player.fitScore) * 100)
        : null;
  const predictions = player.predictionSchools?.slice(0, 2) ?? [];

  return (
    <article className={`gv-rb-card gv-rb-card--${variant}`}>
      <a href={href} className="gv-rb-card__link">
        <div className="gv-rb-card__hero">
          <div className="gv-rb-card__rating-badge" aria-label={`Composite rating ${ratingStr}`}>
            <span className="gv-rb-card__rating-value">{ratingStr ?? '—'}</span>
            <span className="gv-rb-card__rating-label">Composite</span>
          </div>
          <div className="gv-rb-card__hero-meta">
            {player.stars ? (
              <span className="gv-rb-card__stars" aria-label={`${player.stars} stars`}>
                {starsDisplay(player.stars)}
              </span>
            ) : null}
            {movementArrow(player.movementDirection)}
          </div>
        </div>

        <div className="gv-rb-card__head">
          <h3 className="gv-rb-card__name">{player.name}</h3>
          <span className="gv-rb-card__pos-pill">{pos}</span>
          {player.inState && <span className="gv-rb-card__instate">IN-STATE</span>}
        </div>

        <p className="gv-rb-card__school">
          {player.school || '—'}
          {player.state ? ` · ${player.state}` : ''}
        </p>

        {player.htWt && <p className="gv-rb-card__htwt">{player.htWt}</p>}

        <p className="gv-rb-card__ranks">
          NATL {formatRank(player.natlRank ?? player.natl)} · POS {formatRank(player.posRank)} · ST{' '}
          {formatRank(player.stateRank)}
        </p>

        <div className="gv-rb-card__status-row">
          {variant === 'commit' || player.isCommittedToUF ? (
            <span className="gv-rb-card__status gv-rb-card__status--commit">🟢 Committed</span>
          ) : (
            <span className="gv-rb-card__status gv-rb-card__status--target">🎯 Target</span>
          )}
          {player.commitDate && (
            <span className="gv-rb-card__commit-date">{formatCommitDate(player.commitDate)}</span>
          )}
        </div>

        {predictions.length > 0 && (
          <div className="gv-rb-card__predictions">
            {predictions.map((p) => (
              <span key={p.school} className="gv-rb-card__pred">
                {p.school} {p.pct}%
              </span>
            ))}
          </div>
        )}

        {variant === 'target' && heatPct != null && heatMeter(heatPct)}

        <div className="gv-rb-card__badges">
          {visit && <span className="gv-rb-card__badge gv-rb-card__badge--visit">{visit}</span>}
          {player.fitScore != null && (
            <span className="gv-rb-card__badge">Fit {Number(player.fitScore).toFixed(1)}</span>
          )}
          {player.staffGrade && (
            <span className="gv-rb-card__badge">Staff {player.staffGrade}</span>
          )}
        </div>
      </a>

      {skinny && <p className="gv-rb-card__skinny">{skinny}</p>}
    </article>
  );
}
