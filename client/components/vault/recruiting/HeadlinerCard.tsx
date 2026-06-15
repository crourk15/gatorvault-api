'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import {
  formatCommitDate,
  formatCompositeRating,
  formatRank,
  playerPos,
  playerRating,
  selectHeadliner,
  starsDisplay,
} from '@/lib/recruiting-board-utils';
import { playerProfilePath, recruitingProfileLifecycle } from '@/lib/player-routes';

type Props = {
  player: RecruitingBoardPlayer;
};

function headlinerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function HeadlinerPhoto({ player }: { player: RecruitingBoardPlayer }): React.ReactElement {
  const [failed, setFailed] = useState(false);
  const pos = playerPos(player);
  const src = `/headshots/${encodeURIComponent(player.slug)}.jpg`;

  if (failed) {
    return (
      <div className="gv-headliner-card__photo gv-headliner-card__photo--fallback" aria-hidden="true">
        <span className="gv-headliner-card__monogram">{headlinerInitials(player.name)}</span>
        <span className="gv-headliner-card__photo-pos">{pos}</span>
      </div>
    );
  }

  return (
    <div className="gv-headliner-card__photo">
      <img src={src} alt="" onError={() => setFailed(true)} />
      <span className="gv-headliner-card__photo-pos">{pos}</span>
    </div>
  );
}

/** Premium full-width hero card for the class headliner commit. */
export function HeadlinerCard({ player }: Props): React.ReactElement {
  const href = playerProfilePath(
    player.slug,
    recruitingProfileLifecycle(player),
    true,
    player.name,
    'recruiting'
  );
  const ratingStr = formatCompositeRating(
    player.displayRating ?? player.rating ?? playerRating(player) / 100
  );
  const pos = playerPos(player);
  const quote = player.profileNote || player.skinny || player.notes;
  const natl = player.natlRank ?? player.natl;
  const classYear = player.classYear ?? 2027;

  return (
    <section className="gv-headliner-card" data-testid="rh-headliner-commit">
      <div className="gv-headliner-card__accent" aria-hidden="true" />
      <div className="gv-headliner-card__glow" aria-hidden="true" />
      <div className="gv-headliner-card__body">
        <HeadlinerPhoto player={player} />
        <div className="gv-headliner-card__content">
          <span className="gv-headliner-card__eyebrow">Class of {classYear} · Headliner Commit</span>
          <h2 className="gv-headliner-card__name">{player.name}</h2>
          <p className="gv-headliner-card__role">
            {pos}
            {player.school ? ` · ${player.school}` : ''}
            {player.state ? ` · ${player.state}` : ''}
          </p>
          <div className="gv-headliner-card__badges">
            {natl != null ? (
              <span className="gv-headliner-card__badge gv-headliner-card__badge--natl">
                #{natl} National
              </span>
            ) : null}
            <span className="gv-headliner-card__badge">{pos}</span>
            {player.stateRank != null ? (
              <span className="gv-headliner-card__badge">ST {formatRank(player.stateRank)}</span>
            ) : null}
            {player.stars ? (
              <span className="gv-headliner-card__badge gv-headliner-card__badge--stars">
                {starsDisplay(player.stars)}
              </span>
            ) : null}
            <span className="gv-headliner-card__badge gv-headliner-card__badge--commit">Committed</span>
          </div>
          <p className="gv-headliner-card__meta">
            {player.htWt ? `${player.htWt} · ` : ''}
            Rating {ratingStr ?? '—'}
          </p>
          <p className="gv-headliner-card__school">{player.school || '—'}</p>
          <p className="gv-headliner-card__ranks">
            NATL {formatRank(player.natlRank ?? player.natl)} · POS {formatRank(player.posRank)} ({pos}) · ST{' '}
            {formatRank(player.stateRank)}
            {player.state ? ` (${player.state})` : ''}
          </p>
          {player.commitDate ? (
            <p className="gv-headliner-card__commit">
              Committed: {formatCommitDate(player.commitDate)}
            </p>
          ) : null}
          {quote ? <blockquote className="gv-headliner-card__quote">{quote}</blockquote> : null}
          <Button href={href} variant="primary">
            View Profile →
          </Button>
        </div>
      </div>
    </section>
  );
}

/** @deprecated Use HeadlinerCard */
export const RecruitingHubHeadlinerCommit = HeadlinerCard;

export function pickHeadlinerCommit(commits: RecruitingBoardPlayer[]): RecruitingBoardPlayer | null {
  return selectHeadliner(commits);
}

export function filterCommitsWithoutHeadliner(
  commits: RecruitingBoardPlayer[],
  headliner: RecruitingBoardPlayer | null
): RecruitingBoardPlayer[] {
  if (!headliner) return commits;
  return commits.filter((p) => p.slug !== headliner.slug && p.name !== headliner.name);
}
