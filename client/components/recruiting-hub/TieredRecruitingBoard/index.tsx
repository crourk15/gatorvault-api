'use client';

import React, { useMemo } from 'react';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { BoardCard } from './BoardCard';

type Props = {
  targets: RecruitingBoardPlayer[];
};

const TIER_CONFIG = [
  { key: 'tier1' as const, label: 'Tier 1 — Priority Targets', tiers: ['TOP'] as const },
  { key: 'tier2' as const, label: 'Tier 2 — Secondary Targets', tiers: ['HIGH'] as const },
  { key: 'tier3' as const, label: 'Tier 3 — Evaluations / Longshots', tiers: ['MEDIUM', 'LOW', 'EVAL'] as const },
];

function bucketTargets(targets: RecruitingBoardPlayer[]) {
  const tier1: RecruitingBoardPlayer[] = [];
  const tier2: RecruitingBoardPlayer[] = [];
  const tier3: RecruitingBoardPlayer[] = [];

  for (const p of targets) {
    if (p.tier === 'TOP') tier1.push(p);
    else if (p.tier === 'HIGH') tier2.push(p);
    else tier3.push(p);
  }

  const sortRank = (a: RecruitingBoardPlayer, b: RecruitingBoardPlayer) =>
    (a.natlRank ?? a.natl ?? 9999) - (b.natlRank ?? b.natl ?? 9999);

  return {
    tier1: tier1.sort(sortRank).slice(0, 4),
    tier2: tier2.sort(sortRank).slice(0, 4),
    tier3: tier3.sort(sortRank).slice(0, 4),
  };
}

export function TieredRecruitingBoard({ targets }: Props): React.ReactElement {
  const buckets = useMemo(() => bucketTargets(targets), [targets]);

  return (
    <section className="rh-tier-board rh-frame" data-testid="rh-tiered-board">
      <div className="rh-section-head">
        <h2 className="rh-section-title">Recruiting Board</h2>
        <p className="rh-section-sub">Tiered priority grid — targets grouped by staff urgency and fit.</p>
      </div>
      <div className="rh-tier-board__grid">
        {TIER_CONFIG.map((col) => {
          const players = buckets[col.key];
          return (
            <div key={col.key} className="rh-tier-board__column">
              <h3 className="rh-tier-board__column-title">{col.label}</h3>
              <div className="rh-tier-board__cards">
                {players.length === 0 ? (
                  <p className="rh-muted">No {col.label.split('—')[0].trim().toLowerCase()} loaded.</p>
                ) : (
                  players.map((p) => <BoardCard key={p.slug} player={p} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
