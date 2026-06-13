'use client';

import React from 'react';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import type { RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import {
  formatCommitDate,
  formatCompositeRating,
  formatRank,
  playerPos,
  playerRating,
  starsDisplay,
} from '@/lib/recruiting-board-utils';
import { playerProfilePath, recruitingProfileLifecycle } from '@/lib/player-routes';

export function ClassHeadlinerHero({
  player,
}: {
  player: RecruitingBoardPlayer;
}): React.ReactElement {
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

  return (
    <section className="gv-rb-headliner" data-testid="class-headliner">
      <div className="gv-rb-headliner__label">
        <span aria-hidden="true">🏆</span> Class Headliner
      </div>
      <div className="gv-rb-headliner__body">
        <div className="gv-rb-headliner__rating-col">
          <div className="gv-rb-headliner__rating-badge">
            <span className="gv-rb-headliner__rating-value">{ratingStr ?? '—'}</span>
            <span className="gv-rb-headliner__rating-label">On3 / Rivals Composite</span>
          </div>
          {player.stars ? (
            <span className="gv-rb-headliner__stars">{starsDisplay(player.stars)}</span>
          ) : null}
          {player.movementDirection && (
            <span className={`gv-rb-headliner__move gv-rb-headliner__move--${player.movementDirection}`}>
              {player.movementDirection === 'up' ? '▲ Rising' : player.movementDirection === 'down' ? '▼ Cooling' : '◆ Stable'}
            </span>
          )}
        </div>
        <div className="gv-rb-headliner__info">
          <h2 className="gv-rb-headliner__name">
            <a href={href}>{player.name}</a>
            <span className="gv-rb-headliner__pos-pill">{pos}</span>
            {natl != null && (
              <span className="gv-rb-headliner__natl">#{natl} Nationally</span>
            )}
          </h2>
          <p className="gv-rb-headliner__school">
            {player.school || '—'}
            {player.htWt ? ` · ${player.htWt}` : ''}
          </p>
          <p className="gv-rb-headliner__ranks">
            NATL {formatRank(player.natlRank ?? player.natl)} · POS {formatRank(player.posRank)} ({pos}) · ST{' '}
            {formatRank(player.stateRank)}
            {player.state ? ` (${player.state})` : ''}
          </p>
          {player.commitDate && (
            <p className="gv-rb-headliner__commit">Committed: {formatCommitDate(player.commitDate)}</p>
          )}
          {player.fitScore != null && (
            <p className="gv-rb-headliner__fit">Fit Score: {Number(player.fitScore).toFixed(2)}</p>
          )}
          {(player.ufOvStatus || player.visitStart) && (
            <p className="gv-rb-headliner__visit">
              {player.visitStart ? '🔥 UF Visit Scheduled' : player.ufOvStatus}
            </p>
          )}
          {skinny && <blockquote className="gv-rb-headliner__skinny">{skinny}</blockquote>}
        </div>
      </div>
    </section>
  );
}

export function ClassSummaryBar({
  commits,
  rankings,
  classYear,
  compareRankings,
}: {
  commits: RecruitingBoardPlayer[];
  rankings: RecruitingBoardResponse['rankings'];
  classYear: number;
  compareRankings?: RecruitingBoardResponse['rankings'];
}): React.ReactElement {
  const blueChips = commits.filter((c) => (Number(c.stars) || 0) >= 4).length;
  const inStateCount = commits.filter((c) => c.inState).length;
  const inStatePct = commits.length ? Math.round((inStateCount / commits.length) * 100) : 0;

  return (
    <div className="gv-rb-summary" data-testid="class-summary-bar">
      <div className="gv-rb-summary__stat gv-rb-summary__stat--accent">
        <span className="gv-rb-summary__label">Commits</span>
        <span className="gv-rb-summary__value">{commits.length}</span>
      </div>
      <div className="gv-rb-summary__stat">
        <span className="gv-rb-summary__label">National Rank</span>
        <span className="gv-rb-summary__value">
          {rankings?.nationalRank != null ? `#${rankings.nationalRank}` : '—'}
        </span>
      </div>
      <div className="gv-rb-summary__stat">
        <span className="gv-rb-summary__label">SEC Rank</span>
        <span className="gv-rb-summary__value">
          {rankings?.secRank != null ? `#${rankings.secRank}` : '—'}
        </span>
      </div>
      <div className="gv-rb-summary__stat gv-rb-summary__stat--accent">
        <span className="gv-rb-summary__label">Class Score</span>
        <span className="gv-rb-summary__value">
          {rankings?.classScore != null ? Number(rankings.classScore).toFixed(2) : '—'}
        </span>
      </div>
      {compareRankings && (
        <>
          <div className="gv-rb-summary__stat">
            <span className="gv-rb-summary__label">{classYear - 1} Class Score</span>
            <span className="gv-rb-summary__value">
              {compareRankings.classScore != null
                ? Number(compareRankings.classScore).toFixed(2)
                : '—'}
            </span>
          </div>
          <div className="gv-rb-summary__stat">
            <span className="gv-rb-summary__label">{classYear - 1} SEC Rank</span>
            <span className="gv-rb-summary__value">
              {compareRankings.secRank != null ? `#${compareRankings.secRank}` : '—'}
            </span>
          </div>
        </>
      )}
      <div className="gv-rb-summary__stat">
        <span className="gv-rb-summary__label">Blue Chips</span>
        <span className="gv-rb-summary__value">{blueChips}</span>
      </div>
      <div className="gv-rb-summary__stat">
        <span className="gv-rb-summary__label">In-State</span>
        <span className="gv-rb-summary__value">
          {inStatePct}%{' '}
          <small>
            ({inStateCount} of {commits.length})
          </small>
        </span>
      </div>
      <div className="gv-rb-summary__stat">
        <span className="gv-rb-summary__label">Head Coach</span>
        <span className="gv-rb-summary__value gv-rb-summary__value--coach">Jon Sumrall</span>
      </div>
    </div>
  );
}
