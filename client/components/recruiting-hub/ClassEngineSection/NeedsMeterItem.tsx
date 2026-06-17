'use client';

import React from 'react';

export type NeedStatus = 'filled' | 'light' | 'critical';

type Props = {
  position: string;
  status: NeedStatus;
  fillPct: number;
};

const STATUS_LABEL: Record<NeedStatus, string> = {
  filled: 'Filled',
  light: 'Light',
  critical: 'Critical',
};

export function NeedsMeterItem({ position, status, fillPct }: Props): React.ReactElement {
  return (
    <div className={`rh-needs-item rh-needs-item--${status}`}>
      <div className="rh-needs-item__head">
        <span className="rh-needs-item__pos">{position}</span>
        <span className="rh-needs-item__status">{STATUS_LABEL[status]}</span>
      </div>
      <div className="rh-needs-item__bar">
        <div style={{ width: `${fillPct}%` }} />
      </div>
    </div>
  );
}
