'use client';

import React from 'react';
import type { DepthChartTab } from '@/lib/team-hub-types';
import { TEAM_COPY } from '@/lib/team-hub-types';

const TABS: { id: DepthChartTab; label: string }[] = [
  { id: 'offense', label: TEAM_COPY.depthChart.tabs.offense },
  { id: 'defense', label: TEAM_COPY.depthChart.tabs.defense },
  { id: 'specialTeams', label: TEAM_COPY.depthChart.tabs.specialTeams },
];

type Props = {
  active: DepthChartTab;
  onChange: (tab: DepthChartTab) => void;
};

export function DepthChartTabs({ active, onChange }: Props): React.ReactElement {
  return (
    <div className="gv-team-dc-tabs gv-hub-tabs gv-hub-tabs--scroll" role="tablist" aria-label="Depth chart unit">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active === id}
          className={`gv-team-dc-tab gv-hub-tab${active === id ? ' is-active' : ''}`}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
