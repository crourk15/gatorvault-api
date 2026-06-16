'use client';

import React, { useEffect, useState } from 'react';

type Props = {
  value: number;
  label?: string;
  size?: number;
  className?: string;
};

function tone(value: number): 'high' | 'mid' | 'low' {
  if (value >= 70) return 'high';
  if (value >= 40) return 'mid';
  return 'low';
}

export function ProbabilityGauge({ value, label, size = 88, className = '' }: Props): React.ReactElement {
  const rounded = Math.round(Math.min(100, Math.max(0, value)));
  const circumference = 226;
  const offset = circumference - (circumference * rounded) / 100;
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(id);
  }, [rounded]);

  return (
    <div className={`gv-ds-gauge${className ? ` ${className}` : ''}`} role="meter" aria-valuenow={rounded} aria-valuemin={0} aria-valuemax={100}>
      <div className="gv-ds-gauge__ring" style={{ width: size, height: size }}>
        <svg className="gv-ds-gauge__svg" viewBox="0 0 88 88" aria-hidden="true">
          <circle className="gv-ds-gauge__track" cx="44" cy="44" r="36" />
          <circle
            className={`gv-ds-gauge__arc gv-ds-gauge__arc--${tone(rounded)}`}
            cx="44"
            cy="44"
            r="36"
            strokeDasharray={circumference}
            strokeDashoffset={animated ? offset : circumference}
          />
        </svg>
        <span className="gv-ds-gauge__value">{rounded}%</span>
      </div>
      {label ? <span className="gv-ds-gauge__label">{label}</span> : null}
    </div>
  );
}
