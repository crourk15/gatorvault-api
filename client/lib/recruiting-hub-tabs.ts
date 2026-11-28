import type { RecruitingHubTab } from '@/lib/vault-route-map';

export const RECRUITING_PANEL_TAB_ITEMS: { id: RecruitingHubTab; label: string }[] = [
  { id: 'priority', label: 'High Priority' },
  { id: 'intel', label: "Who's Moving" },
  { id: 'scouting', label: 'Scouting' },
  { id: 'rankings', label: 'Rankings' },
];

const PANEL_TABS = new Set<RecruitingHubTab>(RECRUITING_PANEL_TAB_ITEMS.map((t) => t.id));

/** Tabs that render dedicated panel UI (portal, rankings, scouting, etc.). */
export function isRecruitingPanelTab(tab: RecruitingHubTab): boolean {
  return PANEL_TABS.has(tab);
}
