'use client';

import React from 'react';

type Props = {
  network: string;
};

const NETWORK_CLASS: Record<string, string> = {
  ESPN: 'gv-sched-tv--espn',
  ABC: 'gv-sched-tv--abc',
  'SEC Network': 'gv-sched-tv--secn',
  CBS: 'gv-sched-tv--cbs',
  FOX: 'gv-sched-tv--fox',
};

export function TVNetworkBadge({ network }: Props): React.ReactElement {
  const tone = NETWORK_CLASS[network] ?? 'gv-sched-tv--neutral';
  return (
    <span className={`gv-sched-tv ${tone}`} data-network={network}>
      {network}
    </span>
  );
}
