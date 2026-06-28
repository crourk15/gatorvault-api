import type { RecruitingHubTab } from '@/lib/vault-route-map';

const PANEL_TABS = new Set<RecruitingHubTab>([
  'priority',
  'intel',
  'scouting',
  'portal',
  'rankings',
]);

/** Tabs that render dedicated panel UI (portal, rankings, scouting, etc.). */
export function isRecruitingPanelTab(tab: RecruitingHubTab): boolean {
  return PANEL_TABS.has(tab);
}
