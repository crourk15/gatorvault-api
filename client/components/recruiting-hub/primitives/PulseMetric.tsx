'use client';

import React from 'react';

type Props = {
  label: string;
  value: string;
  accent?: boolean;
};

export function PulseMetric({ label, value, accent }: Props): React.ReactElement {
  return (
    <div className={`rh-pulse-metric${accent ? ' rh-pulse-metric--accent' : ''}`}>
      <span className="rh-pulse-metric__label">{label}</span>
      <span className="rh-pulse-metric__value">{value}</span>
    </div>
  );
}
