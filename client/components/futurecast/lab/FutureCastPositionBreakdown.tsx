'use client';

import React, { useMemo } from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { ModuleShell, UfProbBar, ufPctFromRaw } from './primitives';

type PositionBucket = {
  position: string;
  count: number;
  avgUfProb: number;
  avgFit: number;
  topPlayer: string;
};

type Props = {
  players: HighPriorityPlayer[];
};

export function FutureCastPositionBreakdown({ players }: Props): React.ReactElement {
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
      const avgFit = Math.round(
        list.reduce((acc, p) => {
          const raw = p.fitScore ?? 0;
          return acc + (raw <= 1 ? raw * 100 : raw);
        }, 0) / list.length
      );
      const top = [...list].sort((a, b) => ufPctFromRaw(b.ufProbability) - ufPctFromRaw(a.ufProbability))[0];
      result.push({
        position,
        count: list.length,
        avgUfProb,
        avgFit,
        topPlayer: top?.name ?? '—',
      });
    }

    return result.sort((a, b) => b.count - a.count);
  }, [players]);

  return (
    <ModuleShell
      title="Position Breakdown"
      sub="UF probability and fit aggregated by position group."
      testId="fc-lab-position-breakdown"
    >
      {buckets.length === 0 ? (
        <p className="rh-cc-empty">No position data available.</p>
      ) : (
        <div className="fc-lab-pos-grid">
          {buckets.map((b) => (
            <article key={b.position} className="fc-lab-pos-card">
              <header className="fc-lab-pos-card__head">
                <span className="fc-lab-pos-card__pos">{b.position}</span>
                <span className="fc-lab-pos-card__count">{b.count} targets</span>
              </header>
              <UfProbBar value={b.avgUfProb} />
              <p className="fc-lab-pos-card__fit">Avg fit {b.avgFit}</p>
              <p className="fc-lab-pos-card__top">Top: {b.topPlayer}</p>
            </article>
          ))}
        </div>
      )}
    </ModuleShell>
  );
}
