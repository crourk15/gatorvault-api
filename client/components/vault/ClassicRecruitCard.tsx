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
import { formatRecruitSchoolLine } from '@/lib/recruiting-display-utils';

export type ClassicCardVariant = 'commit' | 'target';

export type ClassicRecruitCardPlayer = Partial<RecruitingBoardPlayer> & {
  slug: string;
  name: string;
};

function movementArrow(dir?: 'up' | 'down' | 'flat'): React.ReactNode {
  if (dir === 'up') return <span className="gv-rb-card__move gv-rb-card__move--up" aria-label="Trending up">▲</span>;
  if (dir === 'down') return <span className="gv-rb-card__move gv-rb-card__move--down" aria-label="Trending down">▼</span>;
  if (dir === 'flat') return <span className="gv-rb-card__move gv-rb-card__move--flat" aria-label="Stable">◆</span>;
  return null;
}

function targetStatusChip(player: ClassicRecruitCardPlayer): { label: string; className: string } {
  const status = String(player.ufStatus || '').toUpperCase();
  if (status === 'EVAL') {
    return { label: '📋 Eval', className: 'gv-rb-card__status--eval' };
  }
  if (status === 'PRIORITY') {
    return { label: '⭐ Priority', className: 'gv-rb-card__status--priority' };
  }
  return { label: '🎯 Target', className: 'gv-rb-card__status--target' };
}

function visitBadge(player: ClassicRecruitCardPlayer): string | null {
  const ov = String(player.ufOvStatus || '').toLowerCase();
  if (ov.includes('scheduled') || player.visitStart) return '🔥 Visit Scheduled';
  if (ov.includes('cancelled')) return '🟥 Visit Cancelled';
  return null;
}

function heatMeter(pct: number, label = 'UF interest'): React.ReactElement {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="gv-rb-card__heat" aria-label={`${label} ${clamped}%`}>
      <span className="gv-rb-card__heat-label">{label}</span>
      <div className="gv-rb-card__heat-track">
        <div className="gv-rb-card__heat-fill" style={{ width: `${clamped}%` }} />
      </div>
      <span className="gv-rb-card__heat-pct">{clamped}%</span>
    </div>
  );
}

function schoolLine(player: ClassicRecruitCardPlayer): string {
  const city = (player as { city?: string }).city?.trim();
  return formatRecruitSchoolLine(player.school, player.state, city);
}

/** Classic rating-hero card — no headshots, no initials. Vault-wide default. */
export function ClassicRecruitCard({
  player,
  variant = 'target',
  rank,
}: {
  player: ClassicRecruitCardPlayer;
  variant?: ClassicCardVariant;
  rank?: number;
}): React.ReactElement {
  const lifecycle = recruitingProfileLifecycle(player);
  const href = playerProfilePath(player.slug, lifecycle, true, player.name, 'recruiting');
  const rawRating =
    player.displayRating ??
    player.rating ??
    (playerRating(player as RecruitingBoardPlayer) || null);
  const ratingStr =
    rawRating != null && Number(rawRating) > 0
      ? formatCompositeRating(rawRating)
      : null;
  const ratingLabel = player.ratingLabel ?? 'Composite';
  const pos = playerPos(player as RecruitingBoardPlayer);
  const visit = visitBadge(player);
  const skinny = player.skinny || player.profileNote || player.notePreview || player.notes;
  const heatPct =
    player.heatPct != null
      ? Math.round(Number(player.heatPct))
      : player.ufProbability != null
        ? Math.round(Number(player.ufProbability) * 100)
        : player.fitScore != null
          ? Math.round(Number(player.fitScore) * 100)
          : null;
  const heatLabel = player.heatLabel ?? 'UF interest';
  const showIndustryRanks = player.showIndustryRanks !== false;
  const predictions = player.predictionSchools?.slice(0, 2) ?? [];
  const isCommit = variant === 'commit' || Boolean(player.isCommittedToUF);
  const resolvedVariant: ClassicCardVariant = isCommit ? 'commit' : 'target';
  const natl = rank ?? player.natlRank ?? player.natl;
  const statusChip = targetStatusChip(player);

  return (
    <article
      className={`gv-rb-card gv-rb-card--classic gv-rb-card--${resolvedVariant}${player.headliner ? ' gv-rb-card--headliner' : ''}`}
      data-testid="classic-recruit-card"
    >
      <a href={href} className="gv-rb-card__link">
        {player.headliner && (
          <span className="gv-rb-card__headliner-badge" aria-label="Class headliner">
            🏆 Headliner
          </span>
        )}
        <div className="gv-rb-card__hero">
          <div className="gv-rb-card__rating-badge" aria-label={`${ratingLabel} ${ratingStr ?? 'unrated'}`}>
            <span className="gv-rb-card__rating-value">{ratingStr ?? '—'}</span>
            <span className="gv-rb-card__rating-label">{ratingLabel}</span>
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

        <p className="gv-rb-card__school">{schoolLine(player)}</p>

        {player.htWt ? <p className="gv-rb-card__htwt">{player.htWt}</p> : null}

        {showIndustryRanks ? (
          <p className="gv-rb-card__ranks">
            NATL {formatRank(natl)} · POS {formatRank(player.posRank)} · ST {formatRank(player.stateRank)}
          </p>
        ) : null}

        <div className="gv-rb-card__status-row">
          {resolvedVariant === 'commit' ? (
            <span className="gv-rb-card__status gv-rb-card__status--commit">🟢 Committed</span>
          ) : (
            <span className={`gv-rb-card__status ${statusChip.className}`}>{statusChip.label}</span>
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

        {resolvedVariant === 'target' && heatPct != null && heatMeter(heatPct, heatLabel)}

        <div className="gv-rb-card__badges">
          {visit && <span className="gv-rb-card__badge gv-rb-card__badge--visit">{visit}</span>}
          {player.fitScore != null && player.fitScore > 0 && (
            <span className="gv-rb-card__badge">UF Fit {Math.round(Number(player.fitScore))}</span>
          )}
          {player.staffGrade && <span className="gv-rb-card__badge">Staff {player.staffGrade}</span>}
        </div>
      </a>

      {skinny ? <p className="gv-rb-card__skinny">{skinny}</p> : null}
    </article>
  );
}
