'use client';

import React from 'react';
import { Label } from '@/components/ui';

type Props = {
  winProbability: number;
  className?: string;
};

function barTone(pct: number): 'favored' | 'tossup' | 'underdog' {
  if (pct >= 75) return 'favored';
  if (pct >= 40) return 'tossup';
  return 'underdog';
}

export function WinProbabilityBar({ winProbability, className = '' }: Props): React.ReactElement {
  const pct = Math.min(100, Math.max(0, winProbability));
  const tone = barTone(pct);

  return (
    <div className={`gv-sched-win-bar${className ? ` ${className}` : ''}`}>
      <div className="gv-sched-win-bar__header">
        <Label>Win probability</Label>
        <span className="gv-sched-win-bar__pct">{pct}%</span>
      </div>
      <div className="gv-sched-win-bar__track" role="img" aria-label={`UF win probability ${pct} percent`}>
        <div
          className={`gv-sched-win-bar__fill gv-sched-win-bar__fill--${tone}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
