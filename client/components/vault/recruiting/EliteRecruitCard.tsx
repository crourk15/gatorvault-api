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
import type { ClassicCardVariant, ClassicRecruitCardPlayer } from '@/components/vault/ClassicRecruitCard';
import { isElitePlayer, playerStatusLabel, schoolLogoInitials } from '@/lib/recruiting-hub-utils';

type CardProps = {
  player: ClassicRecruitCardPlayer;
  variant?: ClassicCardVariant;
  rank?: number;
  forceElite?: boolean;
  layout?: 'responsive' | 'horizontal' | 'vertical';
};

function positionCrest(pos: string): string {
  return pos.replace(/[^A-Z0-9/]/gi, '').slice(0, 3).toUpperCase() || '—';
}

function RecruitCardInner({
  player,
  variant = 'target',
  rank,
  forceElite,
  layout = 'responsive',
}: CardProps): React.ReactElement {
  const elite = forceElite ?? isElitePlayer(player);
  const lifecycle = recruitingProfileLifecycle(player);
  const href = playerProfilePath(player.slug, lifecycle, true, player.name, 'recruiting');
  const rawRating =
    player.displayRating ??
    player.rating ??
    (playerRating(player as RecruitingBoardPlayer) || null);
  const ratingStr =
    rawRating != null && Number(rawRating) > 0 ? formatCompositeRating(rawRating) : null;
  const pos = playerPos(player as RecruitingBoardPlayer);
  const heatPct =
    player.ufProbability != null
      ? Math.round(Number(player.ufProbability) * 100)
      : player.fitScore != null
        ? Math.round(Number(player.fitScore) * 100)
        : null;
  const predictions = player.predictionSchools?.slice(0, 3) ?? [];
  const isCommit = variant === 'commit' || Boolean(player.isCommittedToUF);
  const resolvedVariant: ClassicCardVariant = isCommit ? 'commit' : 'target';
  const natl = rank ?? player.natlRank ?? player.natl;
  const move = player.movementDirection;
  const status = playerStatusLabel(player, resolvedVariant);
  const classFit =
    player.fitScore != null ? Number(player.fitScore) : heatPct != null ? heatPct / 10 : null;

  const school = player.school?.trim();
  const state = player.state?.trim();
  const meta = [school, state].filter(Boolean).join(' · ') || '—';

  const layoutClass =
    layout === 'horizontal'
      ? ' gv-rh-elite-card--horizontal'
      : layout === 'vertical'
        ? ' gv-rh-elite-card--vertical'
        : '';

  return (
    <article
      className={`gv-rh-elite-card gv-rh-elite-card--${resolvedVariant}${elite ? ' gv-rh-elite-card--elite gv-texture-swamp-mist' : ''}${layoutClass}${player.headliner ? ' gv-rh-elite-card--headliner' : ''}`}
      data-testid={elite ? 'player-card-elite' : 'player-card-enhanced'}
    >
      <div
        className={`gv-rh-elite-card__status-bar gv-rh-elite-card__status-bar--${resolvedVariant}`}
        aria-hidden="true"
      />
      {elite && <span className="gv-rh-elite-card__elite-badge">Elite</span>}

      <div className="gv-rh-elite-card__link">
        <div className={`gv-rh-elite-card__aside${elite ? '' : ' gv-rh-elite-card__aside--compact'}`}>
          {elite && (
            <div className="gv-rh-elite-card__visual">
              <span className="gv-rh-elite-card__crest" aria-label={`Position ${pos}`}>
                {positionCrest(pos)}
              </span>
              {state && (
                <span className="gv-rh-elite-card__state-flag" aria-label={`State ${state}`}>
                  {state.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
          )}

          <div className="gv-rh-elite-card__rating">
            <span className="gv-rh-elite-card__rating-val">{ratingStr ?? '—'}</span>
            <span className="gv-rh-elite-card__rating-lbl">Composite</span>
            {player.stars ? (
              <span className="gv-rh-elite-card__stars" aria-label={`${player.stars} stars`}>
                {starsDisplay(player.stars)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="gv-rh-elite-card__body">
          <div className="gv-rh-elite-card__head">
            <h3 className="gv-rh-elite-card__name">{player.name}</h3>
            <span className="gv-rh-elite-card__pill">{pos}</span>
            <span className="gv-rh-elite-card__status-pill">{status}</span>
            {player.inState && <span className="gv-rh-elite-card__pill">IN-STATE</span>}
            {move === 'up' && (
              <span className="gv-rh-elite-card__move--up" aria-label="Trending up">
                ▲
              </span>
            )}
            {move === 'down' && (
              <span className="gv-rh-elite-card__move--down" aria-label="Trending down">
                ▼
              </span>
            )}
          </div>

          <p className="gv-rh-elite-card__meta">{meta}</p>
          <p className="gv-rh-elite-card__ranks">
            NATL {formatRank(natl)} · POS {formatRank(player.posRank)} · ST{' '}
            {formatRank(player.stateRank)}
          </p>

          {predictions.length > 0 && (
            <div className="gv-rh-elite-card__preds">
              {predictions.map((p) => (
                <span key={p.school} className="gv-rh-elite-card__pred">
                  <span className="gv-rh-elite-card__school-logo" aria-hidden="true">
                    {schoolLogoInitials(p.school)}
                  </span>
                  {p.school} {p.pct}%
                </span>
              ))}
            </div>
          )}

          {resolvedVariant !== 'commit' && heatPct != null && (
            <div className="gv-rh-elite-card__heat">
              <div className="gv-rh-elite-card__heat-track">
                <div
                  className="gv-rh-elite-card__heat-fill"
                  style={{ width: `${Math.min(100, heatPct)}%` }}
                />
              </div>
              <span className="gv-rh-elite-card__heat-pct">{heatPct}%</span>
            </div>
          )}

          {classFit != null && (
            <p className="gv-rh-elite-card__class-fit">
              Class Fit <strong>{classFit.toFixed(1)}</strong>
            </p>
          )}

          <div className="gv-rh-elite-card__badges">
            {resolvedVariant === 'commit' && (
              <span className="gv-rh-elite-card__badge gv-rh-elite-card__badge--commit">
                🟢 Committed
              </span>
            )}
            {player.commitDate && (
              <span className="gv-rh-elite-card__badge">{formatCommitDate(player.commitDate)}</span>
            )}
            {player.fitScore != null && (
              <span className="gv-rh-elite-card__badge">Fit {Number(player.fitScore).toFixed(1)}</span>
            )}
            {player.staffGrade && (
              <span className="gv-rh-elite-card__badge">Staff {player.staffGrade}</span>
            )}
          </div>

          <a href={href} className="gv-btn gv-btn--secondary gv-rh-elite-card__profile-btn">
            View Profile
          </a>
        </div>
      </div>
    </article>
  );
}

/** Enhanced player card — responsive layout; elite styling when criteria met */
export function PlayerCardEnhanced(props: CardProps): React.ReactElement {
  return <RecruitCardInner {...props} layout="responsive" />;
}

/** Elite card — horizontal layout (desktop) */
export function PlayerCardEliteHorizontal(
  props: Omit<CardProps, 'layout' | 'forceElite'>
): React.ReactElement {
  return <RecruitCardInner {...props} forceElite layout="horizontal" />;
}

/** Elite card — vertical layout (mobile) */
export function PlayerCardEliteVertical(
  props: Omit<CardProps, 'layout' | 'forceElite'>
): React.ReactElement {
  return <RecruitCardInner {...props} forceElite layout="vertical" />;
}

/** @deprecated use PlayerCardEnhanced */
export const EliteRecruitCard = PlayerCardEnhanced;
