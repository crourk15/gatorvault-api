'use client';

import React from 'react';
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

/** Full-width hero card for the class headliner commit (2027 Maxwell Hiller layout). */
export function RecruitingHubHeadlinerCommit({ player }: Props): React.ReactElement {
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
  const skinny = player.skinny || player.profileNote || player.notes;
  const natl = player.natlRank ?? player.natl;
  const classYear = player.classYear ?? 2027;

  return (
    <section className="gv-rh-headliner gv-rh-headliner--hero" data-testid="rh-headliner-commit">
      <div className="gv-rh-headliner__bg" aria-hidden="true" />
      <div className="gv-rh-headliner__body">
        <div className="gv-rh-headliner__rating-col">
          <span className="gv-rh-headliner__eyebrow">
            Class of {classYear} · Headliner
          </span>
          <div className="gv-rh-headliner__rating-badge">
            <span className="gv-rh-headliner__rating-value">{ratingStr ?? '—'}</span>
            <span className="gv-rh-headliner__rating-label">On3 / Rivals Composite</span>
          </div>
          {player.stars ? (
            <span className="gv-rh-headliner__stars">{starsDisplay(player.stars)}</span>
          ) : null}
          {player.inState ? (
            <span className="gv-rh-headliner__badge">In-State</span>
          ) : null}
        </div>
        <div className="gv-rh-headliner__info">
          <h2 className="gv-rh-headliner__name">
            {player.name}
            <span className="gv-rh-headliner__pos-pill">{pos}</span>
            {natl != null ? (
              <span className="gv-rh-headliner__natl">#{natl} Nationally</span>
            ) : null}
          </h2>
          <p className="gv-rh-headliner__meta">
            {player.school || '—'}
            {player.htWt ? ` · ${player.htWt}` : ''}
          </p>
          <p className="gv-rh-headliner__ranks">
            NATL {formatRank(player.natlRank ?? player.natl)} · POS {formatRank(player.posRank)} ({pos}) · ST{' '}
            {formatRank(player.stateRank)}
            {player.state ? ` (${player.state})` : ''}
          </p>
          {player.commitDate ? (
            <p className="gv-rh-headliner__commit">Committed: {formatCommitDate(player.commitDate)}</p>
          ) : null}
          {skinny ? <blockquote className="gv-rh-headliner__quote">{skinny}</blockquote> : null}
          <Button href={href} variant="primary">
            View Profile →
          </Button>
        </div>
      </div>
    </section>
  );
}

export function pickHeadlinerCommit(commits: RecruitingBoardPlayer[]): RecruitingBoardPlayer | null {
  return selectHeadliner(commits);
}

export function filterCommitsWithoutHeadliner(
  commits: RecruitingBoardPlayer[],
  headliner: RecruitingBoardPlayer | null
): RecruitingBoardPlayer[] {
  if (!headliner) return commits;
  return commits.filter(
    (p) => p.slug !== headliner.slug && p.name !== headliner.name
  );
}
