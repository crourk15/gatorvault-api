'use client';

import React, { useMemo } from 'react';
import type {
  FutureCastHeatLevel,
  FutureCastHeroMetrics,
  FutureCastPageSummary,
} from '@/lib/api/futurecast';
import type { MasterBoardResponse, MovementIntelResponse } from '@/lib/futurecast-board-types';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { formatRelativeUpdated } from '@/components/recruiting-hub/utils/formatDate';
import {
  BattleHeatMeter,
  PositionVolatilityHeatmap,
  UfProbabilityBarHero,
  VolatilityIndex,
} from './primitives';
import {
  computeDiscoveryVolatilityMetrics,
  futureCastPlayerToLabTarget,
  highPriorityToLabTarget,
  isBattleTarget,
  ufPctFromFc,
} from './fc-lab-types';
import { FutureCastLabCycleToggle } from './FutureCastLabCycleToggle';
import { useFutureCastLabCycle } from './FutureCastLabCycleContext';

const HEAT_LABELS: Record<FutureCastHeatLevel, string> = {
  hot: 'Hot cycle',
  warm: 'Warm cycle',
  cold: 'Cool cycle',
};

type Props = {
  summary: FutureCastPageSummary;
  metrics: FutureCastHeroMetrics;
  heatLevel: FutureCastHeatLevel;
  masterBoard: MasterBoardResponse;
  movementIntel: MovementIntelResponse;
  highPriority?: HighPriorityPlayer[];
  lastUpdated?: string | null;
};

export function FutureCastHero({
  metrics,
  heatLevel,
  masterBoard,
  movementIntel,
  highPriority = [],
  lastUpdated,
}: Props): React.ReactElement {
  const { discoveryView: discoveryFocus } = useFutureCastLabCycle();
  const focusYear = discoveryFocus ? 2028 : 2027;

  const displayMetrics = useMemo(() => {
    if (discoveryFocus) return metrics;
    return {
      ...metrics,
      avgUFProbability: Math.round(masterBoard.ufConfidenceAverage ?? metrics.avgUFProbability),
      highPriorityCount: masterBoard.highPriority.players.length,
      activePredictions: masterBoard.players.length,
    };
  }, [discoveryFocus, metrics, masterBoard]);

  const top10 = useMemo(() => {
    if (discoveryFocus && highPriority.length) {
      return [...highPriority]
        .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0))
        .slice(0, 10)
        .map(highPriorityToLabTarget);
    }
    return [...masterBoard.players]
      .sort((a, b) => (b.ufConfidence ?? -1) - (a.ufConfidence ?? -1))
      .slice(0, 10)
      .map(futureCastPlayerToLabTarget);
  }, [discoveryFocus, highPriority, masterBoard.players]);

  const top10Avg = useMemo(() => {
    if (!top10.length) return displayMetrics.avgUFProbability;
    return Math.round(top10.reduce((acc, p) => acc + ufPctFromFc(p.ufProbability), 0) / top10.length);
  }, [top10, displayMetrics.avgUFProbability]);

  const avgDelta = useMemo(() => {
    if (!top10.length) return 0;
    return Math.round(top10.reduce((acc, p) => acc + (p.delta7d ?? 0), 0) / top10.length);
  }, [top10]);

  const battleCount = useMemo(() => {
    if (discoveryFocus && highPriority.length) {
      return highPriority.filter((p) => isBattleTarget(ufPctFromFc(p.ufProbability))).length;
    }
    const fromSummary = masterBoard.movementSummary.riserPlayers.length;
    const classified = masterBoard.players.filter((p) => isBattleTarget(ufPctFromFc(p.ufConfidence))).length;
    return Math.max(classified, fromSummary > 0 ? Math.min(classified + 1, 12) : classified);
  }, [discoveryFocus, highPriority, masterBoard]);

  const discoveryVolatility = useMemo(
    () => (discoveryFocus && highPriority.length ? computeDiscoveryVolatilityMetrics(highPriority) : null),
    [discoveryFocus, highPriority]
  );

  const volatilityScore = useMemo(() => {
    if (discoveryVolatility) return discoveryVolatility.score;
    const volatile = movementIntel.highVolatility.length;
    if (volatile > 0) return Math.min(100, volatile * 8 + 10);
    return Math.round(
      masterBoard.players.reduce((acc, p) => acc + Math.abs(p.trendDelta7d ?? 0), 0) /
        Math.max(1, masterBoard.players.length) *
        4
    );
  }, [discoveryVolatility, masterBoard.players, movementIntel.highVolatility.length]);

  const volatilePositions = useMemo(() => {
    if (discoveryVolatility) return discoveryVolatility.hotPositions;
    const byPos = new Map<string, number>();
    for (const p of movementIntel.highVolatility) {
      byPos.set(p.position, (byPos.get(p.position) ?? 0) + 1);
    }
    const ranked = [...byPos.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([pos]) => pos);
    return ranked.length ? ranked.join(', ') : 'CB, WR';
  }, [discoveryVolatility, movementIntel.highVolatility]);

  const positionHeatmap = useMemo(() => {
    if (discoveryVolatility) return discoveryVolatility.positionHeatmap;
    const source = masterBoard.players.map((p) => ({
      position: p.position,
      trendDelta7d: p.trendDelta7d ?? 0,
    }));
    const byPos = new Map<string, { count: number; vol: number }>();
    for (const p of source) {
      const cur = byPos.get(p.position) ?? { count: 0, vol: 0 };
      cur.count += 1;
      cur.vol += Math.abs(p.trendDelta7d);
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
  }, [discoveryVolatility, masterBoard.players]);

  const updatedLabel = lastUpdated ? formatRelativeUpdated(lastUpdated) : 'just now';
  const meterLabel = discoveryFocus
    ? `Commit Likelihood — Top ${focusYear} Targets`
    : 'Commit Likelihood — Top Targets';

  return (
    <section className="fc-lab-hero fc-lab-bleed" data-testid="fc-lab-hero">
      <div className="fc-lab-hero__bg" aria-hidden />
      <div className="fc-lab-hero__inner rh-frame">
        <div className="fc-lab-hero__grid">
          <div className="fc-lab-hero__col fc-lab-hero__col--overview">
            <p className="fc-lab-hero__eyebrow rh-cc-hero__eyebrow">FutureCast Command Center</p>
            <h1 className="fc-lab-hero__title rh-cc-hero__title">UF FUTURECAST LAB</h1>
            <p className="fc-lab-hero__sub rh-cc-hero__sub">
              {discoveryFocus
                ? `${focusYear} discovery — UF targets, battles, and how the board fits Florida.`
                : '2027 closing class — Florida odds, visits, and flip watch.'}
            </p>
            <FutureCastLabCycleToggle className="fc-lab-hero__cycle-toggle" />
            {discoveryFocus ? (
              <p className="fc-lab-hero__cta">
                <a href="/vault/futurecast/big-board" className="rh-cc-link">
                  Open 2028 Early Discovery board →
                </a>
              </p>
            ) : (
              <p className="fc-lab-hero__cta">
                <a href="/vault/recruiting/2027/targets" className="rh-cc-link">
                  Open 2027 targets in Recruiting Hub →
                </a>
              </p>
            )}
            <div className="fc-lab-hero__metrics rh-cc-hero__metrics">
              <div className="fc-lab-hero__metric fc-lab-hero__metric--rank rh-cc-hero__metric rh-cc-hero__metric--rank">
                <span className="fc-lab-hero__metric-label rh-cc-hero__metric-label">High Priority</span>
                <strong className="fc-lab-hero__metric-value rh-cc-hero__metric-value">{displayMetrics.highPriorityCount}</strong>
              </div>
              <div className="fc-lab-hero__metric rh-cc-hero__metric">
                <span className="fc-lab-hero__metric-label rh-cc-hero__metric-label">Active Predictions</span>
                <strong className="fc-lab-hero__metric-value rh-cc-hero__metric-value">{displayMetrics.activePredictions}</strong>
              </div>
              <div className="fc-lab-hero__metric rh-cc-hero__metric">
                <span className="fc-lab-hero__metric-label rh-cc-hero__metric-label">Avg UF %</span>
                <strong className="fc-lab-hero__metric-value rh-cc-hero__metric-value">{displayMetrics.avgUFProbability}%</strong>
              </div>
              <div className="fc-lab-hero__metric rh-cc-hero__metric">
                <span className="fc-lab-hero__metric-label rh-cc-hero__metric-label">Cycle Heat</span>
                <strong className={`fc-lab-hero__metric-value rh-cc-hero__metric-value fc-lab-hero__heat--${heatLevel}`}>
                  {HEAT_LABELS[heatLevel]}
                </strong>
              </div>
              {!discoveryFocus && metrics.flipWatchCount != null && metrics.flipWatchCount > 0 ? (
                <div className="fc-lab-hero__metric rh-cc-hero__metric">
                  <span className="fc-lab-hero__metric-label rh-cc-hero__metric-label">Flip Watch</span>
                  <strong className="fc-lab-hero__metric-value rh-cc-hero__metric-value">{metrics.flipWatchCount}</strong>
                </div>
              ) : null}
              {!discoveryFocus && metrics.visitRecapCount != null && metrics.visitRecapCount > 0 ? (
                <div className="fc-lab-hero__metric rh-cc-hero__metric">
                  <span className="fc-lab-hero__metric-label rh-cc-hero__metric-label">OV Recap</span>
                  <strong className="fc-lab-hero__metric-value rh-cc-hero__metric-value">{metrics.visitRecapCount}</strong>
                </div>
              ) : null}
              {!discoveryFocus && metrics.movementNarrativesCount != null && metrics.movementNarrativesCount > 0 ? (
                <div className="fc-lab-hero__metric rh-cc-hero__metric">
                  <span className="fc-lab-hero__metric-label rh-cc-hero__metric-label">Movement</span>
                  <strong className="fc-lab-hero__metric-value rh-cc-hero__metric-value">{metrics.movementNarrativesCount}</strong>
                </div>
              ) : null}
            </div>
            <p className="fc-lab-hero__updated">Updated {updatedLabel}</p>
          </div>

          <div className="fc-lab-hero__col fc-lab-hero__col--meter">
            <UfProbabilityBarHero
              value={top10Avg}
              delta7d={avgDelta}
              label={meterLabel}
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
