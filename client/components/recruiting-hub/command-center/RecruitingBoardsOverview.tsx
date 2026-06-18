'use client';

import React from 'react';
import type { RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { playerProfileRoute } from '@/lib/site-routes';
import { ModuleShell, MovementBadge, UfProbBar, ufPctFromRaw } from './primitives';

type ClassBundle = {
  commits: unknown[];
  targets: unknown[];
  rankings: RecruitingBoardResponse['rankings'];
};

type Props = {
  b26: ClassBundle;
  b27: ClassBundle;
  b28: ClassBundle;
  highPriority: HighPriorityPlayer[];
};

function classCard(year: number, bundle: ClassBundle): React.ReactElement {
  const rank = bundle.rankings?.nationalRank;
  const score = bundle.rankings?.classScore;
  const commits = bundle.commits.length;
  const targets = bundle.targets.length;
  const blueChip =
    targets > 0
      ? Math.round(
          ((bundle.targets as { stars?: number }[]).filter((t) => (Number(t.stars) || 0) >= 4).length /
            targets) *
            100
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

export function RecruitingBoardsOverview({ b26, b27, b28, highPriority }: Props): React.ReactElement {
  const stock = highPriority.slice(0, 5);

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
            const delta = p.delta7d ?? p.movementDelta ?? 0;
            return (
              <li key={p.slug} className="rh-cc-stock__row">
                <a href={playerProfileRoute(p.slug, 'futurecast')} className="rh-cc-stock__name">
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
