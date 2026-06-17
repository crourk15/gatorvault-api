'use client';

import React, { useMemo, useState } from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import type { RecruitingBoardResponse } from '@/lib/recruiting-board-api';

type Props = {
  targets: HighPriorityPlayer[];
  rankings: RecruitingBoardResponse['rankings'];
  blueChipPct: number;
};

export function RankSimulator({ targets, rankings, blueChipPct }: Props): React.ReactElement {
  const [selectedSlug, setSelectedSlug] = useState('');

  const projection = useMemo(() => {
    if (!selectedSlug) return null;
    const player = targets.find((p) => p.slug === selectedSlug);
    if (!player) return null;
    const baseRank = rankings?.nationalRank ?? 12;
    const baseScore = rankings?.classScore ?? 280;
    const isElite = (player.nationalRank ?? 999) <= 100 || (player.stars ?? 0) >= 5;
    const rankBump = isElite ? 3 : 1;
    const scoreBump = isElite ? 4.2 : 1.8;
    const chipBump = (player.stars ?? 0) >= 4 ? 4 : 2;
    return {
      name: player.name,
      rank: Math.max(1, baseRank - rankBump),
      score: (baseScore + scoreBump).toFixed(1),
      blueChip: Math.min(100, blueChipPct + chipBump),
    };
  }, [selectedSlug, targets, rankings, blueChipPct]);

  return (
    <div className="rh-rank-sim">
      <h3 className="rh-rank-sim__title">If UF lands X → Rank becomes Y</h3>
      <label className="rh-rank-sim__label" htmlFor="rh-rank-sim-select">
        Select target
      </label>
      <select
        id="rh-rank-sim-select"
        className="rh-rank-sim__select"
        value={selectedSlug}
        onChange={(e) => setSelectedSlug(e.target.value)}
      >
        <option value="">Choose a target…</option>
        {targets.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.name} ({p.position})
          </option>
        ))}
      </select>
      {projection ? (
        <div className="rh-rank-sim__output">
          <p>
            Landing <strong>{projection.name}</strong> projects:
          </p>
          <ul>
            <li>
              Class rank: <strong>#{projection.rank}</strong>
            </li>
            <li>
              Class score: <strong>{projection.score}</strong>
            </li>
            <li>
              Blue chip %: <strong>{projection.blueChip}%</strong>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
