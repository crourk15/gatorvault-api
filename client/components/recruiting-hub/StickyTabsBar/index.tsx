'use client';

import React from 'react';
import type { RecruitingHubTab } from '@/lib/vault-route-map';

export const STICKY_TAB_LABELS: { id: RecruitingHubTab; label: string }[] = [
  { id: 'priority', label: 'High Priority' },
  { id: 'commits-2026', label: '2026 Commits' },
  { id: 'commits-2027', label: '2027 Commits' },
  { id: 'targets-2027', label: '2027 Targets' },
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

export function StickyTabsBar({ active, onChange }: Props): React.ReactElement {
  return (
    <div className="rh-sticky-tabs">
      <div className="rh-sticky-tabs__inner rh-frame gv-hub-tabs gv-hub-tabs--scroll" role="tablist">
        {STICKY_TAB_LABELS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            className={`rh-sticky-tabs__tab gv-hub-tab${active === id ? ' is-active' : ''}`}
            onClick={() => onChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** @deprecated */
export const RECRUITING_TAB_LABELS = STICKY_TAB_LABELS;
