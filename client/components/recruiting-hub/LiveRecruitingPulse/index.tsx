'use client';

import React, { useMemo } from 'react';
import type { HeatCheckItem } from '@/lib/recruiting-api';
import type { RecruitingBoardPlayer, RecruitingBoardResponse } from '@/lib/recruiting-board-api';

type Props = {
  rankings: RecruitingBoardResponse['rankings'];
  targets: RecruitingBoardPlayer[];
  rising: HeatCheckItem[];
  cooling: HeatCheckItem[];
  flipWatchCount: number;
};

function avgRating(targets: RecruitingBoardPlayer[]): string {
  const rated = targets.filter((t) => t.rating != null && Number(t.rating) > 0);
  if (!rated.length) return '—';
  const sum = rated.reduce((acc, t) => acc + Number(t.rating), 0);
  return (sum / rated.length).toFixed(1);
}

function blueChipPct(targets: RecruitingBoardPlayer[]): string {
  if (!targets.length) return '—';
  const chips = targets.filter((t) => (Number(t.stars) || 0) >= 4).length;
  return `${Math.round((chips / targets.length) * 100)}%`;
}

function temperatureGauge(rankings: RecruitingBoardResponse['rankings'], rising: number, cooling: number): number {
  const base = rankings?.nationalRank != null ? Math.max(35, 100 - rankings.nationalRank) : 62;
  return Math.min(99, Math.max(25, base + rising * 4 - cooling * 3));
}

export function LiveRecruitingPulse({
  rankings,
  targets,
  rising,
  cooling,
  flipWatchCount,
}: Props): React.ReactElement {
  const temp = useMemo(() => temperatureGauge(rankings, rising.length, cooling.length), [rankings, rising.length, cooling.length]);
  const portalStorm = flipWatchCount >= 2;

  return (
    <section className="rh-pulse rh-frame" data-testid="rh-live-pulse">
      <div className="rh-pulse__strip">
        <div className="rh-pulse__gauge-wrap">
          <span className="rh-pulse__gauge-label">UF Recruiting Temperature</span>
          <div className="rh-pulse__gauge">
            <div className="rh-pulse__gauge-fill" style={{ width: `${temp}%` }} />
            <span className="rh-pulse__gauge-value">{temp}°</span>
          </div>
        </div>

        <div className="rh-pulse__stats">
          <div className="rh-pulse__stat">
            <span className="rh-pulse__stat-label">Class Rank</span>
            <span className="rh-pulse__stat-value">
              {rankings?.nationalRank != null ? `#${rankings.nationalRank}` : '—'}
            </span>
          </div>
          <div className="rh-pulse__stat">
            <span className="rh-pulse__stat-label">Avg Rating</span>
            <span className="rh-pulse__stat-value">{avgRating(targets)}</span>
          </div>
          <div className="rh-pulse__stat">
            <span className="rh-pulse__stat-label">Blue Chip %</span>
            <span className="rh-pulse__stat-value">{blueChipPct(targets)}</span>
          </div>
          <div className="rh-pulse__stat rh-pulse__stat--accent">
            <span className="rh-pulse__stat-label">Total Points</span>
            <span className="rh-pulse__stat-value">
              {rankings?.classScore != null ? Number(rankings.classScore).toFixed(1) : '—'}
            </span>
          </div>
        </div>

        <div className="rh-pulse__signals" aria-label="Live recruiting signals">
          <span className="rh-pulse__signal rh-pulse__signal--hot">🔥 Trending Up {rising.length || ''}</span>
          <span className="rh-pulse__signal rh-pulse__signal--cool">❄️ Cooling {cooling.length || ''}</span>
          <span className="rh-pulse__signal rh-pulse__signal--flip">🚨 Flip Watch {flipWatchCount || ''}</span>
          {portalStorm ? (
            <span className="rh-pulse__signal rh-pulse__signal--portal">🌀 Portal Storm</span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
