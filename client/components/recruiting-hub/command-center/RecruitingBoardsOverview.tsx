'use client';

import React from 'react';
import type { RecruitingBoardPlayer, RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import { playerProfileRoute } from '@/lib/vault-route-map';
import { ModuleShell, MovementBadge, UfProbBar, ufPctFromRaw } from './primitives';

type ClassBundle = {
  commits: unknown[];
  targets: RecruitingBoardPlayer[];
  rankings: RecruitingBoardResponse['rankings'];
};

type Props = {
  b26: ClassBundle;
  b27: ClassBundle;
  b28: ClassBundle;
};

function classCard(year: number, bundle: ClassBundle): React.ReactElement {
  const rank = bundle.rankings?.nationalRank;
  const commits = bundle.commits.length;
  const targets = bundle.targets.length;
  const blueChip =
    targets > 0
      ? Math.round(
          (bundle.targets.filter((t) => (Number(t.stars) || 0) >= 4).length / targets) * 100
        )
      : 0;

  return (
    <a href={`/vault/recruiting/board?year=${year}`} className="rh-cc-board-card">
      <span className="rh-cc-board-card__year">Class of {year}</span>
      <strong className="rh-cc-board-card__rank">{rank != null ? `#${rank}` : '—'}</strong>
      <span className="rh-cc-board-card__meta">Blue chip {blueChip}%</span>
      <span className="rh-cc-board-card__meta">{commits} commits</span>
      <span className="rh-cc-board-card__cta">View board →</span>
    </a>
  );
}

function targetDelta(player: RecruitingBoardPlayer): number {
  if (player.movementDirection === 'up') return 3;
  if (player.movementDirection === 'down') return -3;
  return 0;
}

export function RecruitingBoardsOverview({ b26, b27, b28 }: Props): React.ReactElement {
  const stock = b27.targets.slice(0, 5);

  return (
    <ModuleShell
      title="UF Recruiting Boards — 2026 / 2027 / 2028"
      testId="rh-cc-boards-overview"
    >
      <div className="rh-cc-board-cards">
        {classCard(2026, b26)}
        {classCard(2027, b27)}
        {classCard(2028, b28)}
      </div>

      <div className="rh-cc-stock">
        <h3 className="rh-cc-stock__title">Stock Board — Top UF Targets</h3>
        <ul className="rh-cc-stock__list">
          {stock.map((p) => {
            const pct = ufPctFromRaw(p.ufProbability);
            const delta = targetDelta(p);
            return (
              <li key={p.slug} className="rh-cc-stock__row">
                <a href={playerProfileRoute(p.slug, 'recruiting')} className="rh-cc-stock__name">
                  {p.name}
                </a>
                <UfProbBar value={pct} />
                <MovementBadge
                  delta={delta}
                  tone={delta > 0 ? 'rise' : delta < 0 ? 'fall' : 'flat'}
                />
                <span className="rh-cc-stock__schools">
                  {p.committedTo || p.school || 'Open'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </ModuleShell>
  );
}
