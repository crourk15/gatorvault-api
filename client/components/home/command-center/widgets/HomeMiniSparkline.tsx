'use client';

import React from 'react';

type Props = {
  values: number[];
  tone?: 'up' | 'down' | 'neutral' | 'hot' | 'warm' | 'cool';
};

export function HomeMiniSparkline({ values, tone = 'neutral' }: Props): React.ReactElement {
  const pts = values.length >= 2 ? values : [40, 45, 42, 48, 50, 52, 55];
  const max = Math.max(...pts, 1);
  const min = Math.min(...pts, 0);
  const range = Math.max(max - min, 1);
  const coords = pts
    .map((v, i) => `${(i / (pts.length - 1)) * 48},${20 - ((v - min) / range) * 16}`)
    .join(' ');

  return (
    <svg className={`gv-hcc-sparkline gv-hcc-sparkline--${tone}`} viewBox="0 0 48 22" aria-hidden>
      <polyline points={coords} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
