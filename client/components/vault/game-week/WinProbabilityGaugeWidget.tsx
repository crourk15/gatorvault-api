'use client';

import React, { useEffect, useState } from 'react';
import type { PredictionIntel } from '@/lib/game-week-data';

type Props = {
  ufPct: number;
  prediction: PredictionIntel;
};

function confidenceLabel(confidence: number): string {
  if (confidence >= 75) return 'High';
  if (confidence >= 55) return 'Medium';
  return 'Low';
}

function movementText(movement: PredictionIntel['movement'], ufPct: number): string {
  if (movement === 'up') return `+${Math.max(1, Math.round(ufPct / 30))}% this week`;
  if (movement === 'down') return `-${Math.max(1, Math.round((100 - ufPct) / 30))}% this week`;
  return 'Flat this week';
}

export function WinProbabilityGaugeWidget({ ufPct, prediction }: Props): React.ReactElement {
  const pct = Math.round(Math.min(100, Math.max(0, ufPct)));
  const oppPct = 100 - pct;
  const r = 54;
  const c = 2 * Math.PI * r;
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  const ufOffset = c - (animated ? (pct / 100) * c : 0);
  const oppOffset = c - (animated ? (oppPct / 100) * c : 0);
  const needleAngle = -90 + (pct / 100) * 180;

  return (
    <div className="gv-gw-wp-gauge" data-testid="gw-wp-gauge">
      <p className="gv-gw-wp-gauge__heading">FutureCast Win Probability</p>
      <div className="gv-gw-wp-gauge__rings">
        <svg className="gv-gw-wp-gauge__svg" viewBox="0 0 128 128" aria-hidden="true">
          <circle cx="64" cy="64" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
          <circle
            cx="64"
            cy="64"
            r={r - 14}
            fill="none"
            stroke="rgba(0,33,165,0.22)"
            strokeWidth="8"
            strokeDasharray={c - 88}
            strokeDashoffset={oppOffset * 0.85}
            strokeLinecap="round"
            transform="rotate(-90 64 64)"
            style={{ transition: 'stroke-dashoffset 1s ease-out 0.15s' }}
          />
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            stroke="#FA4616"
            strokeWidth="10"
            strokeDasharray={c}
            strokeDashoffset={ufOffset}
            strokeLinecap="round"
            transform="rotate(-90 64 64)"
            style={{ transition: 'stroke-dashoffset 0.9s ease-out' }}
          />
          <line
            x1="64"
            y1="64"
            x2="64"
            y2="22"
            stroke="#0021a5"
            strokeWidth="2"
            strokeLinecap="round"
            transform={`rotate(${needleAngle} 64 64)`}
          />
          <text x="64" y="58" textAnchor="middle" className="gv-gw-wp-gauge__pct">
            {pct}%
          </text>
          <text x="64" y="74" textAnchor="middle" className="gv-gw-wp-gauge__uf-label">
            Florida
          </text>
        </svg>
      </div>
      <span className={`gv-gw-wp-gauge__movement gv-gw-wp-gauge__movement--${prediction.movement}`}>
        {movementText(prediction.movement, pct)}
      </span>
      <span className="gv-gw-wp-gauge__confidence">Confidence: {confidenceLabel(prediction.confidence)}</span>
    </div>
  );
}
