'use client';

import React from 'react';

type BadgeTone =
  | 'live'
  | 'breaking'
  | 'visit'
  | 'commit'
  | 'portal'
  | 'rumor'
  | 'team'
  | 'podcast'
  | 'beat'
  | 'neutral';

type Props = {
  label: string;
  tone?: BadgeTone;
  pulse?: boolean;
};

/** Premium dashboard pill — LIVE, BREAKING, tag types, etc. */
export function GNLDashBadge({ label, tone = 'neutral', pulse }: Props): React.ReactElement {
  return (
    <span
      className={[
        'gv-gnl-dash-badge',
        `gv-gnl-dash-badge--${tone}`,
        pulse ? 'gv-gnl-dash-badge--pulse' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {label}
    </span>
  );
}
