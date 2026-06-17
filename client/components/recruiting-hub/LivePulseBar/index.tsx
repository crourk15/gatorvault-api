'use client';

import React, { useMemo } from 'react';
import type { HeatCheckItem } from '@/lib/recruiting-api';
import type { RecruitingBoardPlayer, RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import { PulseMetric } from '@/components/recruiting-hub/primitives/PulseMetric';
import { SignalTag } from '@/components/recruiting-hub/primitives/SignalTag';

type Props = {
  rankings: RecruitingBoardResponse['rankings'];
  targets: RecruitingBoardPlayer[];
  rising: HeatCheckItem[];
  cooling: HeatCheckItem[];
  flipWatchCount: number;
  portalStorm?: boolean;
};

function avgRating(targets: RecruitingBoardPlayer[]): string {
  const rated = targets.filter((t) => t.rating != null && Number(t.rating) > 0);
  if (!rated.length) return '—';
  return (rated.reduce((a, t) => a + Number(t.rating), 0) / rated.length).toFixed(4);
}

function blueChipPct(targets: RecruitingBoardPlayer[]): string {
  if (!targets.length) return '—';
  const chips = targets.filter((t) => (Number(t.stars) || 0) >= 4).length;
  return `${Math.round((chips / targets.length) * 100)}%`;
}

function temperatureLabel(rankings: RecruitingBoardResponse['rankings'], rising: number, cooling: number): string {
  const base = rankings?.nationalRank != null ? Math.max(0, 100 - rankings.nationalRank) : 55;
  const score = base + rising * 5 - cooling * 4;
  if (score >= 85) return 'On Fire';
  if (score >= 68) return 'Hot';
  if (score >= 48) return 'Warm';
  return 'Cold';
}

export function LivePulseBar({
  rankings,
  targets,
  rising,
  cooling,
  flipWatchCount,
  portalStorm = false,
}: Props): React.ReactElement {
  const temp = useMemo(
    () => temperatureLabel(rankings, rising.length, cooling.length),
    [rankings, rising.length, cooling.length]
  );
  const tempClass = temp.toLowerCase().replace(/\s+/g, '-');

  return (
    <section className="rh-live-pulse rh-container" data-testid="rh-live-pulse-bar">
      <div className="rh-live-pulse__bar">
        <div className="rh-live-pulse__metrics">
          <div className={`rh-live-pulse__temp rh-live-pulse__temp--${tempClass}`}>
            <span className="rh-live-pulse__temp-label">UF Recruiting Temperature</span>
            <span className="rh-live-pulse__temp-value">{temp}</span>
          </div>
          <PulseMetric
            label="Class Rank (On3 Composite)"
            value={rankings?.nationalRank != null ? `#${rankings.nationalRank}` : '—'}
          />
          <PulseMetric label="Avg Rating" value={avgRating(targets)} />
          <PulseMetric label="Blue Chip %" value={blueChipPct(targets)} />
          <PulseMetric
            label="Total Points"
            value={rankings?.classScore != null ? Number(rankings.classScore).toFixed(1) : '—'}
            accent
          />
        </div>
        <div className="rh-live-pulse__signals" aria-label="Live recruiting signals">
          <SignalTag kind="hot" label="Trending Up" active={rising.length > 0} count={rising.length} />
          <SignalTag kind="cooling" label="Cooling" active={cooling.length > 0} count={cooling.length} />
          <SignalTag kind="flip" label="Flip Watch" active={flipWatchCount > 0} count={flipWatchCount} />
          <SignalTag kind="portal" label="Portal Storm" active={portalStorm || flipWatchCount >= 2} />
        </div>
      </div>
    </section>
  );
}
