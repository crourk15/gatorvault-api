'use client';

import React from 'react';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { playerProfilePath } from '@/lib/player-routes';
import { playerProfileRoute } from '@/lib/site-routes';

export type BoardCardProps = {
  player: RecruitingBoardPlayer;
};

function ufPct(player: RecruitingBoardPlayer): number | null {
  const raw = player.ufProbability;
  if (raw == null || Number.isNaN(Number(raw))) return null;
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
}

function heatLevel(player: RecruitingBoardPlayer): number {
  if (player.movementDirection === 'up') return 85;
  if (player.movementDirection === 'down') return 35;
  return 55;
}

function competingSchools(player: RecruitingBoardPlayer): string {
  const schools = player.predictionSchools?.slice(0, 3).map((s) => s.school);
  if (schools?.length) return schools.join(' · ');
  if (player.committedTo) return player.committedTo;
  return '—';
}

function whyUf(player: RecruitingBoardPlayer): string {
  return (
    player.notePreview?.trim() ||
    player.skinny?.trim() ||
    player.notes?.trim() ||
    'Intel pending — board still building.'
  );
}

function whatsNext(player: RecruitingBoardPlayer): string {
  if (player.visitStart) return `OV window ${player.visitStart}${player.visitEnd ? `–${player.visitEnd}` : ''}`;
  if (player.nextVisitSchool) return `Next: ${player.nextVisitSchool}`;
  if (player.ufOvStatus) return `Visit status: ${player.ufOvStatus}`;
  return 'Visit / decision window TBD';
}

export function BoardCard({ player }: BoardCardProps): React.ReactElement {
  const pct = ufPct(player);
  const heat = heatLevel(player);

  return (
    <article className="rh-board-card">
      <header className="rh-board-card__head">
        <div>
          <h4 className="rh-board-card__name">{player.name}</h4>
          <p className="rh-board-card__pos">
            {player.position || player.pos}
            {player.natlRank != null || player.natl != null ? (
              <span> · #{player.natlRank ?? player.natl} Natl</span>
            ) : null}
          </p>
        </div>
        <span className="rh-board-card__uf">{pct == null ? 'RPM pending' : `${pct}% UF`}</span>
      </header>

      <div className="rh-board-card__heat">
        <div className="rh-board-card__heat-bar" style={{ width: `${heat}%` }} />
        <span>Heat {heat}</span>
      </div>

      <p className="rh-board-card__schools">
        <strong>Competing:</strong> {competingSchools(player)}
      </p>
      <p className="rh-board-card__why">
        <strong>Why UF is in it:</strong> {whyUf(player)}
      </p>
      <p className="rh-board-card__next">
        <strong>What&apos;s next:</strong> {whatsNext(player)}
      </p>

      <div className="rh-board-card__links">
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
