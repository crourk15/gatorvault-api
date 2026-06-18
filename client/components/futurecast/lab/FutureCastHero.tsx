'use client';

import React, { useMemo } from 'react';
import type {
  FutureCastHeatLevel,
  FutureCastHeroMetrics,
  FutureCastPageSummary,
} from '@/lib/api/futurecast';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import type { MovementSummary } from '@/lib/recruiting-movement-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { formatRelativeUpdated } from '@/components/recruiting-hub/utils/formatDate';
import {
  BattleHeatMeter,
  PositionVolatilityHeatmap,
  UfProbabilityBarHero,
  VolatilityIndex,
  ufPctFromRaw,
} from './primitives';

const HEAT_LABELS: Record<FutureCastHeatLevel, string> = {
  hot: 'Hot cycle',
  warm: 'Warm cycle',
  cold: 'Cool cycle',
};

function isBattleTarget(p: HighPriorityPlayer): boolean {
  const pct = ufPctFromRaw(p.ufProbability);
  if (p.committedTo && p.committedTo !== 'Florida') return true;
  return pct >= 34 && pct < 67;
}

type Props = {
  summary: FutureCastPageSummary;
  metrics: FutureCastHeroMetrics;
  heatLevel: FutureCastHeatLevel;
  highPriority: HighPriorityPlayer[];
  staffDashboard: StaffDashboardResponse | null;
  movementSummary: MovementSummary | null;
  lastUpdated?: string | null;
};

export function FutureCastHero({
  summary,
  metrics,
  heatLevel,
  highPriority,
  staffDashboard,
  movementSummary,
  lastUpdated,
}: Props): React.ReactElement {
  const top10 = useMemo(
    () =>
      [...highPriority]
        .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0))
        .slice(0, 10),
    [highPriority]
  );

  const top10Avg = useMemo(() => {
    if (!top10.length) return metrics.avgUFProbability;
    const sum = top10.reduce((acc, p) => acc + ufPctFromRaw(p.ufProbability), 0);
    return Math.round(sum / top10.length);
  }, [top10, metrics.avgUFProbability]);

  const avgDelta = useMemo(() => {
    if (!top10.length) return 0;
    const sum = top10.reduce((acc, p) => acc + (p.delta7d ?? p.movementDelta ?? 0), 0);
    return Math.round(sum / top10.length);
  }, [top10]);

  const battleCount = useMemo(
    () => highPriority.filter(isBattleTarget).length,
    [highPriority]
  );

  const volatilityScore = useMemo(() => {
    const fromStaff = staffDashboard?.highVolatility?.length ?? 0;
    if (fromStaff > 0) return Math.min(100, fromStaff * 4 + (movementSummary?.volatile ?? 0) * 2);
    if (!highPriority.length) return 0;
    const avgAbs = highPriority.reduce(
      (acc, p) => acc + Math.abs(p.delta7d ?? p.movementDelta ?? 0),
      0
    ) / highPriority.length;
    return Math.round(avgAbs * 3);
  }, [highPriority, staffDashboard, movementSummary]);

  const volatilePositions = useMemo(() => {
    const byPos = new Map<string, number[]>();
    for (const p of highPriority) {
      const pos = p.position || 'Other';
      const list = byPos.get(pos) ?? [];
      list.push(Math.abs(p.delta7d ?? p.movementDelta ?? 0));
      byPos.set(pos, list);
    }
    const ranked = [...byPos.entries()]
      .map(([position, deltas]) => ({
        position,
        vol: deltas.reduce((a, d) => a + d, 0) / deltas.length,
      }))
      .sort((a, b) => b.vol - a.vol)
      .slice(0, 2)
      .map((x) => x.position);
    return ranked.length ? ranked.join(', ') : 'CB, WR';
  }, [highPriority]);

  const positionHeatmap = useMemo(() => {
    const byPos = new Map<string, { count: number; vol: number }>();
    for (const p of highPriority) {
      const pos = p.position || 'Other';
      const cur = byPos.get(pos) ?? { count: 0, vol: 0 };
      cur.count += 1;
      cur.vol += Math.abs(p.delta7d ?? p.movementDelta ?? 0);
      byPos.set(pos, cur);
    }
    return [...byPos.entries()]
      .map(([position, { count, vol }]) => ({
        position,
        count,
        intensity: count > 0 ? vol / count : 0,
      }))
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, 6);
  }, [highPriority]);

  const updatedLabel = lastUpdated ? formatRelativeUpdated(lastUpdated) : 'just now';

  return (
    <section className="fc-lab-hero fc-lab-bleed" data-testid="fc-lab-hero">
      <div className="fc-lab-hero__bg" aria-hidden />
      <div className="fc-lab-hero__inner rh-frame">
        <div className="fc-lab-hero__grid">
          <div className="fc-lab-hero__col fc-lab-hero__col--overview">
            <h1 className="fc-lab-hero__title">UF FUTURECAST LAB</h1>
            <p className="fc-lab-hero__sub">
              Commit likelihood, movement intel, fit scores, and competing schools for UF&apos;s top
              targets.
            </p>
            <div className="fc-lab-hero__metrics">
              <div className="fc-lab-hero__metric fc-lab-hero__metric--rank">
                <span className="fc-lab-hero__metric-label">Natl Rank</span>
                <strong className="fc-lab-hero__metric-value">
                  {summary.nationalRank != null ? `#${summary.nationalRank}` : '—'}
                </strong>
              </div>
              <div className="fc-lab-hero__metric">
                <span className="fc-lab-hero__metric-label">High Priority</span>
                <strong className="fc-lab-hero__metric-value">{metrics.highPriorityCount}</strong>
              </div>
              <div className="fc-lab-hero__metric">
                <span className="fc-lab-hero__metric-label">Active Predictions</span>
                <strong className="fc-lab-hero__metric-value">{metrics.activePredictions}</strong>
              </div>
              <div className="fc-lab-hero__metric">
                <span className="fc-lab-hero__metric-label">Cycle Heat</span>
                <strong className={`fc-lab-hero__metric-value fc-lab-hero__heat--${heatLevel}`}>
                  {HEAT_LABELS[heatLevel]}
                </strong>
              </div>
            </div>
            <p className="fc-lab-hero__updated">Updated {updatedLabel}</p>
          </div>

          <div className="fc-lab-hero__col fc-lab-hero__col--meter">
            <UfProbabilityBarHero
              value={top10Avg}
              delta7d={avgDelta}
              label="Commit Likelihood — Top Targets"
            />
          </div>

          <div className="fc-lab-hero__col fc-lab-hero__col--heat">
            <BattleHeatMeter count={battleCount} />
            <VolatilityIndex score={volatilityScore} hotPositions={volatilePositions} />
            <PositionVolatilityHeatmap cells={positionHeatmap} />
          </div>
        </div>
      </div>
    </section>
  );
}
