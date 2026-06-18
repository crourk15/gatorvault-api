'use client';

import React, { useMemo } from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { ModuleShell, ufPctFromRaw } from './primitives';

type PositionBucket = {
  position: string;
  count: number;
  avgUfProb: number;
  avgVolatility: number;
  activePredictions: number;
};

type Props = {
  players: HighPriorityPlayer[];
  activePredictions?: number;
};

export function FutureCastPositionBreakdown({ players, activePredictions }: Props): React.ReactElement {
  const buckets = useMemo(() => {
    const map = new Map<string, HighPriorityPlayer[]>();
    for (const p of players) {
      const pos = p.position || 'Other';
      const list = map.get(pos) ?? [];
      list.push(p);
      map.set(pos, list);
    }

    const result: PositionBucket[] = [];
    for (const [position, list] of map) {
      const avgUfProb = Math.round(
        list.reduce((acc, p) => acc + ufPctFromRaw(p.ufProbability), 0) / list.length
      );
      const avgVolatility = Math.round(
        list.reduce((acc, p) => acc + Math.abs(p.delta7d ?? p.movementDelta ?? 0), 0) / list.length
      );
      result.push({
        position,
        count: list.length,
        avgUfProb,
        avgVolatility,
        activePredictions: list.filter((p) => (p.predictors?.length ?? 0) > 0).length,
      });
    }

    return result.sort((a, b) => b.count - a.count);
  }, [players]);

  return (
    <ModuleShell
      title="Position Breakdown — UF FutureCast"
      sub="Average UF probability, active predictions, and volatility by position."
      testId="fc-lab-position-breakdown"
    >
      {buckets.length === 0 ? (
        <p className="rh-cc-empty">No position data available.</p>
      ) : (
        <>
          <div className="fc-lab-pos-table__head" aria-hidden>
            <span>Position</span>
            <span>Avg UF %</span>
            <span>Predictions</span>
            <span>Volatility</span>
          </div>
          <div className="fc-lab-pos-table">
            {buckets.map((b) => (
              <article key={b.position} className="fc-lab-pos-row">
                <span className="fc-lab-pos-row__pos">{b.position}</span>
                <span className="fc-lab-pos-row__summary">
                  {b.position} — {b.avgUfProb}% avg, {b.activePredictions} predictions, Volatility{' '}
                  {b.avgVolatility}
                </span>
                <span className="fc-lab-pos-row__avg">{b.avgUfProb}%</span>
                <span className="fc-lab-pos-row__pred">{b.activePredictions}</span>
                <span className="fc-lab-pos-row__vol">{b.avgVolatility}</span>
              </article>
            ))}
          </div>
          {activePredictions != null ? (
            <p className="fc-lab-pos-table__foot">{activePredictions} total active predictions on board</p>
          ) : null}
        </>
      )}
    </ModuleShell>
  );
}
