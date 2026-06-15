'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { FC_METRIC_LABELS } from '@/lib/futurecast-elite-metrics';
import { InsiderPaywall } from './InsiderPaywall';

type Props = {
  average: number;
  sparkline: number[];
};

function confidenceTone(value: number): 'high' | 'mid' | 'low' {
  if (value >= 70) return 'high';
  if (value >= 40) return 'mid';
  return 'low';
}

export function ConfidenceMeter({ average, sparkline }: Props): React.ReactElement {
  const rounded = Math.round(average);
  const tone = confidenceTone(rounded);
  const circumference = 226;
  const offset = circumference - (circumference * Math.min(100, Math.max(0, rounded))) / 100;
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(id);
  }, [rounded]);

  const points = useMemo(() => {
    if (!sparkline.length) return '0,100 100,100';
    return sparkline
      .map((v, i) => {
        const x = (i / Math.max(sparkline.length - 1, 1)) * 100;
        const y = 100 - Math.min(100, Math.max(0, v));
        return `${x},${y}`;
      })
      .join(' ');
  }, [sparkline]);

  const gauge = (
    <article className="gv-card">
      <div className="gv-card-title">{FC_METRIC_LABELS.uf} Meter</div>
      <div className="gv-confidence">
        <div className="gv-confidence-gauge-wrap">
          <svg className="gv-confidence-gauge" viewBox="0 0 88 88" aria-hidden="true">
            <circle className="gv-confidence-gauge-track" cx="44" cy="44" r="36" />
            <circle
              className={`gv-confidence-gauge-arc gv-confidence-gauge-arc--${tone}`}
              cx="44"
              cy="44"
              r="36"
              style={{ strokeDashoffset: animated ? offset : circumference }}
            />
          </svg>
          <span className="gv-confidence-value-center">{rounded}%</span>
        </div>
        <div className="gv-confidence-labels">
          <div className="gv-confidence-label-main">Average Likelihood (UF %)</div>
          <div className="gv-confidence-label-sub">Model commit probability · 2027 allow-list</div>
          <svg className="gv-confidence-sparkline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
      </div>
    </article>
  );

  return (
    <InsiderPaywall
      variant="overlay"
      teaser={
        <article className="gv-card">
          <div className="gv-card-title">{FC_METRIC_LABELS.uf} Meter</div>
          <p className="gv-insider-blur" style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>
            —%
          </p>
          <p className="gv-card-subtitle">Insider unlock required</p>
        </article>
      }
    >
      {gauge}
    </InsiderPaywall>
  );
}
