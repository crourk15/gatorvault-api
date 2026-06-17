'use client';

import React from 'react';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { NeedsMeterItem, type NeedStatus } from './NeedsMeterItem';

const POSITIONS = ['OL', 'DL', 'WR', 'DB', 'QB', 'LB', 'TE'] as const;

function bucketPos(raw?: string | null): string {
  const p = (raw || 'ATH').toUpperCase();
  if (p.startsWith('OL') || p === 'OT' || p === 'OG' || p === 'C') return 'OL';
  if (p.startsWith('EDGE') || p.startsWith('DL') || p === 'DE' || p === 'DT') return 'DL';
  if (p.startsWith('WR')) return 'WR';
  if (p.startsWith('CB') || p.startsWith('DB') || p === 'S') return 'DB';
  if (p.startsWith('QB')) return 'QB';
  if (p.startsWith('LB')) return 'LB';
  if (p.startsWith('TE')) return 'TE';
  return 'ATH';
}

function statusFor(count: number, max: number): NeedStatus {
  const ratio = count / Math.max(1, max);
  if (ratio >= 0.7) return 'filled';
  if (ratio >= 0.35) return 'light';
  return 'critical';
}

type Props = {
  targets: RecruitingBoardPlayer[];
};

export function NeedsMeter({ targets }: Props): React.ReactElement {
  const counts: Record<string, number> = {};
  for (const t of targets) {
    const b = bucketPos(t.position || t.pos);
    counts[b] = (counts[b] ?? 0) + 1;
  }
  const max = Math.max(1, ...POSITIONS.map((p) => counts[p] ?? 0));

  return (
    <div className="rh-needs-meter">
      <h3 className="rh-needs-meter__title">Positional Needs Meter</h3>
      <div className="rh-needs-meter__grid">
        {POSITIONS.map((pos) => {
          const count = counts[pos] ?? 0;
          const fillPct = Math.round((count / max) * 100);
          return (
            <NeedsMeterItem key={pos} position={pos} status={statusFor(count, max)} fillPct={fillPct} />
          );
        })}
      </div>
    </div>
  );
}
