'use client';

import React, { useMemo } from 'react';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { playerProfilePath } from '@/lib/player-routes';
import { playerProfileRoute } from '@/lib/site-routes';

export type BoardCardProps = {
  player: RecruitingBoardPlayer;
};

function ufPct(player: RecruitingBoardPlayer): number {
  const raw = player.ufProbability;
  if (raw == null) return 0;
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
}

function heatLevel(player: RecruitingBoardPlayer): number {
  if (player.movementDirection === 'up') return 85;
  if (player.movementDirection === 'down') return 35;
  return 55;
}

function rankingLabel(player: RecruitingBoardPlayer): string {
  const natl = player.natlRank ?? player.natl;
  if (natl != null) return `#${natl} Natl`;
  if (player.posRank != null) return `#${player.posRank} Pos`;
  return 'Unranked';
}

function competingTags(player: RecruitingBoardPlayer): string[] {
  if (player.predictionSchools?.length) {
    return player.predictionSchools.slice(0, 3).map((s) => s.school);
  }
  if (player.committedTo) return [player.committedTo];
  return ['Open'];
}

function whyUf(player: RecruitingBoardPlayer): string {
  return (
    player.notePreview?.trim() ||
    player.skinny?.trim()?.split('.')[0] ||
    player.notes?.trim() ||
    'UF staff actively engaged on fit and need.'
  );
}

function whatsNext(player: RecruitingBoardPlayer): string {
  if (player.visitStart) return `Visit ${player.visitStart}${player.visitEnd ? `–${player.visitEnd}` : ''}`;
  if (player.ufOvStatus) return `Status: ${player.ufOvStatus}`;
  if (player.nextVisitSchool) return `Next: ${player.nextVisitSchool}`;
  return 'Monitor summer circuit + decision window';
}

export function BoardCard({ player }: BoardCardProps): React.ReactElement {
  const pct = ufPct(player);
  const heat = heatLevel(player);
  const classYear = player.classYear ?? 2027;

  return (
    <article className="rh-board-card">
      <header className="rh-board-card__head">
        <div>
          <h4 className="rh-board-card__name">{player.name}</h4>
          <p className="rh-board-card__meta">
            {player.position || player.pos} · Class {classYear} · {rankingLabel(player)}
          </p>
        </div>
        <span className="rh-board-card__uf">{pct}%</span>
      </header>

      <div className="rh-board-card__heat">
        <div className="rh-board-card__heat-fill" style={{ width: `${heat}%` }} />
      </div>

      <div className="rh-board-card__tags">
        {competingTags(player).map((school) => (
          <span key={school} className="rh-board-card__tag">
            {school}
          </span>
        ))}
      </div>

      <p className="rh-board-card__line">
        <strong>Why UF is in it:</strong> {whyUf(player)}
      </p>
      <p className="rh-board-card__line">
        <strong>What&apos;s next:</strong> {whatsNext(player)}
      </p>

      <div className="rh-board-card__actions">
        <a href={playerProfileRoute(player.slug, 'futurecast')} className="rh-board-card__link">
          FutureCast
        </a>
        <a href={playerProfilePath(player.slug, 'target', true, player.name, 'recruiting')} className="rh-board-card__link">
          Profile
        </a>
      </div>
    </article>
  );
}
