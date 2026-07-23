'use client';

import React from 'react';
import type { DepthChartTab } from '@/lib/team-hub-types';
import { TEAM_COPY } from '@/lib/team-hub-types';

const TABS: { id: DepthChartTab; label: string; short: string }[] = [
  { id: 'offense', label: TEAM_COPY.depthChart.tabs.offense, short: 'OFF' },
  { id: 'defense', label: TEAM_COPY.depthChart.tabs.defense, short: 'DEF' },
  { id: 'specialTeams', label: TEAM_COPY.depthChart.tabs.specialTeams, short: 'ST' },
];

type Props = {
  active: DepthChartTab;
  onChange: (tab: DepthChartTab) => void;
};

export function DepthChartTabs({ active, onChange }: Props): React.ReactElement {
  return (
    <div className="gv-team-dc-tabs" role="tablist" aria-label="Depth chart unit">
      {TABS.map(({ id, label, short }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active === id}
          className={`gv-team-dc-tab${active === id ? ' is-active' : ''}`}
          onClick={() => onChange(id)}
        >
          <span className="gv-team-dc-tab__short">{short}</span>
          <span className="gv-team-dc-tab__label">{label}</span>
        </button>
      ))}
    </div>
  );
}
