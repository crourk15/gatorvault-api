'use client';

import React, { useMemo } from 'react';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { BoardTierColumn } from './BoardTierColumn';

type Props = {
  targets: RecruitingBoardPlayer[];
};

function bucketTargets(targets: RecruitingBoardPlayer[]) {
  const tier1: RecruitingBoardPlayer[] = [];
  const tier2: RecruitingBoardPlayer[] = [];
  const tier3: RecruitingBoardPlayer[] = [];
  const sortRank = (a: RecruitingBoardPlayer, b: RecruitingBoardPlayer) =>
    (a.natlRank ?? a.natl ?? 9999) - (b.natlRank ?? b.natl ?? 9999);

  for (const p of targets) {
    if (p.tier === 'TOP') tier1.push(p);
    else if (p.tier === 'HIGH') tier2.push(p);
    else tier3.push(p);
  }

  return {
    tier1: tier1.sort(sortRank).slice(0, 4),
    tier2: tier2.sort(sortRank).slice(0, 4),
    tier3: tier3.sort(sortRank).slice(0, 4),
  };
}

export function RecruitingBoardSection({ targets }: Props): React.ReactElement {
  const buckets = useMemo(() => bucketTargets(targets), [targets]);

  return (
    <section className="rh-section rh-section--panel rh-container" data-testid="rh-recruiting-board-section">
      <h2 className="rh-section__title">Recruiting Board</h2>
      <div className="rh-board-grid">
        <BoardTierColumn title="Tier 1 — Priority Targets" players={buckets.tier1} />
        <BoardTierColumn title="Tier 2 — Secondary Targets" players={buckets.tier2} />
        <BoardTierColumn title="Tier 3 — Evaluations / Longshots" players={buckets.tier3} />
      </div>
    </section>
  );
}
