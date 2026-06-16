'use client';

import React from 'react';
import type { RecruitingHubTab } from '@/lib/vault-route-map';
import {
  StickyTabsBar,
  STICKY_TAB_LABELS,
} from '@/components/recruiting-hub/StickyTabsBar';

export { STICKY_TAB_LABELS as RECRUITING_TAB_LABELS };

type Props = {
  active: RecruitingHubTab;
  onChange: (tab: RecruitingHubTab) => void;
};

/** @deprecated use StickyTabsBar */
export function RecruitingTabBar(props: Props): React.ReactElement {
  return <StickyTabsBar {...props} />;
}

export const RecruitingTabs = RecruitingTabBar;

type SubTabProps = {
  options: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
};

export function RecruitingSubTabBar({ options, active, onChange }: SubTabProps): React.ReactElement {
  return (
    <div className="rh-sticky-tabs__inner rh-sticky-tabs__inner--sub" role="tablist">
      {options.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active === id}
          className={`rh-sticky-tabs__tab${active === id ? ' is-active' : ''}`}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
