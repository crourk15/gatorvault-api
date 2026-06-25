'use client';

import React, { useMemo } from 'react';
import type {
  FutureCastHeatLevel,
  FutureCastHeroMetrics,
  FutureCastPageSummary,
} from '@/lib/api/futurecast';
import type { MasterBoardResponse, MovementIntelResponse } from '@/lib/futurecast-board-types';
import { formatRelativeUpdated } from '@/components/recruiting-hub/utils/formatDate';
import {
  BattleHeatMeter,
  PositionVolatilityHeatmap,
  UfProbabilityBarHero,
  VolatilityIndex,
} from './primitives';
import { futureCastPlayerToLabTarget, ufPctFromFc } from './fc-lab-types';

const HEAT_LABELS: Record<FutureCastHeatLevel, string> = {
  hot: 'Hot cycle',
  warm: 'Warm cycle',
  cold: 'Cool cycle',
};

function isBattleTarget(ufPct: number): boolean {
  return ufPct >= 34 && ufPct < 67;
}

type Props = {
  summary: FutureCastPageSummary;
  metrics: FutureCastHeroMetrics;
  heatLevel: FutureCastHeatLevel;
  masterBoard: MasterBoardResponse;
  movementIntel: MovementIntelResponse;
  lastUpdated?: string | null;
};

export function FutureCastHero({
  metrics,
  heatLevel,
  masterBoard,
  movementIntel,
  lastUpdated,
}: Props): React.ReactElement {
  const top10 = useMemo(
    () =>
      [...masterBoard.players]
        .sort((a, b) => (b.ufConfidence ?? -1) - (a.ufConfidence ?? -1))
        .slice(0, 10)
        .map(futureCastPlayerToLabTarget),
    [masterBoard.players]
  );

  const top10Avg = useMemo(() => {
    if (!top10.length) return metrics.avgUFProbability;
    return Math.round(top10.reduce((acc, p) => acc + ufPctFromFc(p.ufProbability), 0) / top10.length);
  }, [top10, metrics.avgUFProbability]);

  const avgDelta = useMemo(() => {
    if (!top10.length) return 0;
    return Math.round(top10.reduce((acc, p) => acc + (p.delta7d ?? 0), 0) / top10.length);
  }, [top10]);

  const battleCount = useMemo(() => {
    const fromSummary = masterBoard.movementSummary.riserPlayers.length;
    const classified = masterBoard.players.filter((p) => isBattleTarget(ufPctFromFc(p.ufConfidence))).length;
    return Math.max(classified, fromSummary > 0 ? Math.min(classified + 1, 12) : classified);
  }, [masterBoard]);

  const volatilityScore = useMemo(() => {
    const volatile = movementIntel.highVolatility.length;
    if (volatile > 0) return Math.min(100, volatile * 8 + 10);
    return Math.round(
      masterBoard.players.reduce((acc, p) => acc + Math.abs(p.trendDelta7d ?? 0), 0) /
        Math.max(1, masterBoard.players.length) *
        4
    );
  }, [masterBoard.players, movementIntel.highVolatility.length]);

  const volatilePositions = useMemo(() => {
    const byPos = new Map<string, number>();
    for (const p of movementIntel.highVolatility) {
      byPos.set(p.position, (byPos.get(p.position) ?? 0) + 1);
    }
    const ranked = [...byPos.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([pos]) => pos);
    return ranked.length ? ranked.join(', ') : 'CB, WR';
  }, [movementIntel.highVolatility]);

  const positionHeatmap = useMemo(() => {
    const byPos = new Map<string, { count: number; vol: number }>();
    for (const p of masterBoard.players) {
      const cur = byPos.get(p.position) ?? { count: 0, vol: 0 };
      cur.count += 1;
      cur.vol += Math.abs(p.trendDelta7d ?? 0);
      byPos.set(p.position, cur);
    }
    return [...byPos.entries()]
      .map(([position, { count, vol }]) => ({
        position,
        count,
        intensity: count > 0 ? vol / count : 0,
      }))
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, 6);
  }, [masterBoard.players]);

  const updatedLabel = lastUpdated ? formatRelativeUpdated(lastUpdated) : 'just now';

  return (
    <section className="fc-lab-hero fc-lab-bleed" data-testid="fc-lab-hero">
      <div className="fc-lab-hero__bg" aria-hidden />
      <div className="fc-lab-hero__inner rh-frame">
        <div className="fc-lab-hero__grid">
          <div className="fc-lab-hero__col fc-lab-hero__col--overview">
            <p className="fc-lab-hero__eyebrow rh-cc-hero__eyebrow">FutureCast Command Center</p>
            <h1 className="fc-lab-hero__title rh-cc-hero__title">UF FUTURECAST LAB</h1>
            <p className="fc-lab-hero__sub rh-cc-hero__sub">
              Commit likelihood, movement intel, fit scores, and competing schools for UF&apos;s top
              targets.
            </p>
            <div className="fc-lab-hero__metrics rh-cc-hero__metrics">
              <div className="fc-lab-hero__metric fc-lab-hero__metric--rank rh-cc-hero__metric rh-cc-hero__metric--rank">
                <span className="fc-lab-hero__metric-label rh-cc-hero__metric-label">High Priority</span>
                <strong className="fc-lab-hero__metric-value rh-cc-hero__metric-value">{metrics.highPriorityCount}</strong>
              </div>
              <div className="fc-lab-hero__metric rh-cc-hero__metric">
                <span className="fc-lab-hero__metric-label rh-cc-hero__metric-label">Active Predictions</span>
                <strong className="fc-lab-hero__metric-value rh-cc-hero__metric-value">{metrics.activePredictions}</strong>
              </div>
              <div className="fc-lab-hero__metric rh-cc-hero__metric">
                <span className="fc-lab-hero__metric-label rh-cc-hero__metric-label">Avg UF %</span>
                <strong className="fc-lab-hero__metric-value rh-cc-hero__metric-value">{metrics.avgUFProbability}%</strong>
              </div>
              <div className="fc-lab-hero__metric rh-cc-hero__metric">
                <span className="fc-lab-hero__metric-label rh-cc-hero__metric-label">Cycle Heat</span>
                <strong className={`fc-lab-hero__metric-value rh-cc-hero__metric-value fc-lab-hero__heat--${heatLevel}`}>
                  {HEAT_LABELS[heatLevel]}
                </strong>
              </div>
              {metrics.flipWatchCount != null && metrics.flipWatchCount > 0 ? (
                <div className="fc-lab-hero__metric rh-cc-hero__metric">
                  <span className="fc-lab-hero__metric-label rh-cc-hero__metric-label">Flip Watch</span>
                  <strong className="fc-lab-hero__metric-value rh-cc-hero__metric-value">{metrics.flipWatchCount}</strong>
                </div>
              ) : null}
              {metrics.visitRecapCount != null && metrics.visitRecapCount > 0 ? (
                <div className="fc-lab-hero__metric rh-cc-hero__metric">
                  <span className="fc-lab-hero__metric-label rh-cc-hero__metric-label">OV Recap</span>
                  <strong className="fc-lab-hero__metric-value rh-cc-hero__metric-value">{metrics.visitRecapCount}</strong>
                </div>
              ) : null}
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
