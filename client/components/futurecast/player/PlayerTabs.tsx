/**
 * Sticky profile tabs with deep-link support (?tab=).
 */
import React from 'react';

export type ProfileTabId =
  | 'overview'
  | 'high-school'
  | 'college'
  | 'portal'
  | 'uf-fit'
  | 'signals';

export const PROFILE_TABS: { id: ProfileTabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'high-school', label: 'High School' },
  { id: 'college', label: 'College' },
  { id: 'portal', label: 'Portal' },
  { id: 'uf-fit', label: 'UF Fit' },
  { id: 'signals', label: 'Signals' },
];

export interface PlayerTabsProps {
  activeTab: ProfileTabId;
  onTabChange: (tab: ProfileTabId) => void;
  availableTabs?: Partial<Record<ProfileTabId, boolean>>;
}

export function PlayerTabs({
  activeTab,
  onTabChange,
  availableTabs = {},
}: PlayerTabsProps): React.ReactElement {
  return (
    <nav className="fc-profile-tabs" data-testid="player-tabs" role="tablist">
      {PROFILE_TABS.map((tab) => {
        const available = availableTabs[tab.id] !== false;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`fc-profile-tab${activeTab === tab.id ? ' is-active' : ''}${!available ? ' is-disabled' : ''}`}
            onClick={() => available && onTabChange(tab.id)}
            disabled={!available}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

export function parseProfileTab(raw: string | null): ProfileTabId {
  const normalized = (raw || 'overview').toLowerCase();
  const match = PROFILE_TABS.find((t) => t.id === normalized);
  return match?.id ?? 'overview';
}
