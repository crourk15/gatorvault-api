'use client';

import React, { useEffect, useState } from 'react';
import { MovementSparkline } from './primitives';

type Props = {
  value: number;
  delta7d: number;
  label?: string;
};

function segmentTone(pct: number): 'low' | 'mid' | 'high' {
  if (pct >= 67) return 'high';
  if (pct >= 34) return 'mid';
  return 'low';
}

export function UFProbabilityMeter({
  value,
  delta7d,
  label = 'UF Commit Probability (Top Targets)',
}: Props): React.ReactElement {
  const [animated, setAnimated] = useState(0);
  const pct = Math.max(0, Math.min(100, value));
  const tone = segmentTone(pct);
  const trend = delta7d > 0 ? 'up' : delta7d < 0 ? 'down' : 'flat';

  useEffect(() => {
    const t = window.setTimeout(() => setAnimated(pct), 80);
    return () => window.clearTimeout(t);
  }, [pct]);

  return (
    <div className="rh-cc-meter" data-testid="rh-cc-uf-probability-meter">
      <p className="rh-cc-meter__label">{label}</p>
      <div className={`rh-cc-meter__ring rh-cc-meter__ring--${tone}`}>
        <svg viewBox="0 0 120 120" className="rh-cc-meter__svg" aria-hidden>
          <circle cx="60" cy="60" r="52" className="rh-cc-meter__track" />
          <circle
            cx="60"
            cy="60"
            r="52"
            className={`rh-cc-meter__arc rh-cc-meter__arc--${tone}`}
            strokeDasharray={`${(animated / 100) * 327} 327`}
          />
        </svg>
        <div className="rh-cc-meter__center">
          <span className="rh-cc-meter__value">{pct}%</span>
          <span className="rh-cc-meter__hint">Top targets</span>
        </div>
      </div>
      <p className={`rh-cc-meter__trend rh-cc-meter__trend--${trend}`}>
        Trending {delta7d > 0 ? '↑' : delta7d < 0 ? '↓' : '→'} {delta7d > 0 ? '+' : ''}
        {delta7d}% (7d)
      </p>
      <div className="rh-cc-meter__spark">
        <MovementSparkline end={pct} delta={delta7d} />
        <span className="rh-cc-meter__spark-label">7-day UF probability</span>
      </div>
    </div>
  );
}
