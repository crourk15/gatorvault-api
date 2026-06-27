'use client';

import React, { useMemo } from 'react';
import type { FutureCastPlayer } from '@/lib/futurecast-board-types';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { primaryRecruitingClassYear } from '@/lib/recruiting-cycle';
import { FutureCastPanelShell } from './primitives';
import { ufPctFromFc } from './fc-lab-types';
import { useFutureCastLabCycle } from './FutureCastLabCycleContext';

type PositionBucket = {
  position: string;
  count: number;
  avgUfProb: number;
  avgVolatility: number;
  activePredictions: number;
};

type Props = {
  players: FutureCastPlayer[];
  highPriority?: HighPriorityPlayer[];
  activePredictions?: number;
  bare?: boolean;
};

export function FutureCastPositionBreakdown({
  players,
  highPriority = [],
  activePredictions,
  bare,
}: Props): React.ReactElement {
  const { discoveryView: discoveryFocus } = useFutureCastLabCycle();
  const focusYear = discoveryFocus ? 2028 : 2027;

  const buckets = useMemo(() => {
    if (discoveryFocus && highPriority.length) {
      const map = new Map<string, HighPriorityPlayer[]>();
      for (const p of highPriority) {
        const pos = p.position || 'Other';
        const list = map.get(pos) ?? [];
        list.push(p);
        map.set(pos, list);
      }

      const result: PositionBucket[] = [];
      for (const [position, list] of map) {
        const avgUfProb = Math.round(
          list.reduce((acc, p) => acc + ufPctFromFc(p.ufProbability), 0) / list.length
        );
        const avgVolatility = Math.round(
          list.reduce((acc, p) => acc + Math.abs(p.delta7d ?? 0), 0) / list.length
        );
        result.push({
          position,
          count: list.length,
          avgUfProb,
          avgVolatility,
          activePredictions: list.filter((p) => ufPctFromFc(p.ufProbability) > 0).length,
        });
      }
      return result.sort((a, b) => b.count - a.count);
    }

    const map = new Map<string, FutureCastPlayer[]>();
    for (const p of players) {
      const pos = p.position || 'Other';
      const list = map.get(pos) ?? [];
      list.push(p);
      map.set(pos, list);
    }

    const result: PositionBucket[] = [];
    for (const [position, list] of map) {
      const avgUfProb = Math.round(
        list.reduce((acc, p) => acc + ufPctFromFc(p.ufConfidence), 0) / list.length
      );
      const avgVolatility = Math.round(
        list.reduce((acc, p) => acc + Math.abs(p.trendDelta7d ?? p.volatility7d ?? 0), 0) / list.length
      );
      result.push({
        position,
        count: list.length,
        avgUfProb,
        avgVolatility,
        activePredictions: list.filter((p) => (p.ufConfidence ?? 0) > 0).length,
      });
    }

    return result.sort((a, b) => b.count - a.count);
  }, [discoveryFocus, highPriority, players]);

  const title = discoveryFocus
    ? `Position Breakdown — ${focusYear} UF Targets`
    : 'Position Breakdown — UF FutureCast';
  const sub = discoveryFocus
    ? 'Average UF likelihood and movement by position on the 2028 allowlist board.'
    : 'Average UF probability, active predictions, and volatility by position.';

  return (
    <FutureCastPanelShell
      bare={bare}
      title={title}
      sub={sub}
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
    </FutureCastPanelShell>
  );
}
