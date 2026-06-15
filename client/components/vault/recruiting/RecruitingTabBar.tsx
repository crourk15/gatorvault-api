'use client';

import React from 'react';
import type { RecruitingHubTab } from '@/lib/vault-route-map';

/** Visible tabs per wireframe (targets-2027 route still works via URL) */
export const RECRUITING_TAB_LABELS: { id: RecruitingHubTab; label: string }[] = [
  { id: 'priority', label: 'High Priority' },
  { id: 'commits-2026', label: '2026 Commits' },
  { id: 'heat-check', label: 'Heat Check' },
  { id: 'commits-2027', label: '2027 Commits' },
  { id: 'targets-2028', label: '2028 Targets' },
  { id: 'intel', label: 'Movement Intel' },
  { id: 'scouting', label: 'Scouting' },
  { id: 'portal', label: 'Portal' },
  { id: 'rankings', label: 'Rankings' },
];

type Props = {
  active: RecruitingHubTab;
  onChange: (tab: RecruitingHubTab) => void;
};

export function RecruitingTabBar({ active, onChange }: Props): React.ReactElement {
  return (
    <div className="gv-rh-tabs-wrap">
      <div className="gv-rh-tabs gv-rh-hub__frame" role="tablist">
        {RECRUITING_TAB_LABELS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            className={`gv-rh-tab${active === id ? ' is-active' : ''}`}
            onClick={() => onChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** @deprecated alias */
export const RecruitingTabs = RecruitingTabBar;

type SubTabProps = {
  options: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
};

export function RecruitingSubTabBar({ options, active, onChange }: SubTabProps): React.ReactElement {
  return (
    <div className="gv-rh-tabs gv-rh-tabs--sub" role="tablist">
      {options.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active === id}
          className={`gv-rh-tab${active === id ? ' is-active' : ''}`}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
