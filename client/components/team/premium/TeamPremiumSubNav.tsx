'use client';

import React from 'react';
import { TEAM_PREMIUM_TABS, type TeamPremiumTabId } from './team-premium-types';

type Props = {
  active: TeamPremiumTabId;
  onSelect: (tab: TeamPremiumTabId) => void;
};

export function TeamPremiumSubNav({ active, onSelect }: Props): React.ReactElement {
  return (
    <nav className="team-premium-subnav" aria-label="Team page sections">
      <div className="team-premium-subnav__track">
        {TEAM_PREMIUM_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`team-premium-subnav__pill${active === tab.id ? ' is-active' : ''}`}
            aria-current={active === tab.id ? 'true' : undefined}
            onClick={() => onSelect(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
