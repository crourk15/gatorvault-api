'use client';

import React from 'react';
import { Label } from '@/components/ui';

type Props = {
  winProbability: number;
  className?: string;
};

export type WinProbTone = 'favored' | 'tossup' | 'underdog';

export function winProbTone(pct: number): WinProbTone {
  if (pct >= 75) return 'favored';
  if (pct >= 40) return 'tossup';
  return 'underdog';
}

const TONE_LABEL: Record<WinProbTone, string> = {
  favored: 'UF favored',
  tossup: 'Toss-up',
  underdog: 'UF underdog',
};

/** Hard colors so Next Up / cleanup CSS cannot wash the meter back to one accent. */
const TONE_COLOR: Record<WinProbTone, string> = {
  favored: '#fa4616',
  tossup: '#0021a5',
  underdog: '#475569',
};

export function WinProbabilityBar({ winProbability, className = '' }: Props): React.ReactElement {
  const pct = Math.min(100, Math.max(0, winProbability));
  const tone = winProbTone(pct);
  const color = TONE_COLOR[tone];

  return (
    <div
      className={`gv-sched-win-bar gv-sched-win-bar--${tone}${className ? ` ${className}` : ''}`}
      data-tone={tone}
    >
      <div className="gv-sched-win-bar__header">
        <Label>Win probability</Label>
        <span className={`gv-sched-win-bar__pct gv-sched-win-bar__pct--${tone}`} style={{ color }}>
          {pct}%
        </span>
      </div>
      <div
        className="gv-sched-win-bar__track"
        role="img"
        aria-label={`UF win probability ${pct} percent · ${TONE_LABEL[tone]}`}
      >
        <div
          className={`gv-sched-win-bar__fill gv-sched-win-bar__fill--${tone}`}
          style={{ width: `${pct}%`, backgroundColor: color, backgroundImage: 'none' }}
        />
      </div>
      <span
        className={`gv-sched-win-bar__tone gv-sched-win-bar__tone--${tone}`}
        style={{ color, background: `${color}22` }}
      >
        {TONE_LABEL[tone]}
      </span>
    </div>
  );
}
