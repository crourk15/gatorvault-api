'use client';

import React from 'react';
import { HighPriorityTargetCard } from '@/components/futurecast/HighPriorityTargetCard';
import { ScoutingDepartmentPage } from '@/components/site/ScoutingDepartmentPage';
import { UiEmpty } from '@/components/site/UiMessage';
import { DashboardMovementPreview } from '@/components/vault/dashboard/DashboardMovementPreview';
import { PlayerCardEnhanced } from '@/components/vault/recruiting/EliteRecruitCard';
import { PortalList } from '@/components/vault/recruiting/RecruitingPortalSection';
import { RankingsTable } from '@/components/vault/recruiting/RecruitingRankingsTable';
import { ScoutingTiles } from '@/components/vault/recruiting/RecruitingScoutingTiles';
import { RecruitingSubTabBar } from '@/components/vault/recruiting/RecruitingTabBar';
import { fromStaffDashboard } from '@/lib/recruiting-card-adapters';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import type { StaffDashboardPlayer, StaffDashboardResponse } from '@/lib/staff-api';
import type { RecruitingHubTab } from '@/lib/vault-route-map';

type Props = {
  tab: RecruitingHubTab;
  showContent: boolean;
  highPriority: HighPriorityPlayer[];
  staffDashboard: StaffDashboardResponse | null;
  loading: boolean;
  intel: {
    risers: StaffDashboardPlayer[];
    fallers: StaffDashboardPlayer[];
  };
  rankYear: 2027 | 2028;
  setRankYear: (y: 2027 | 2028) => void;
  rankings: RecruitingBoardPlayer[];
};

export function RecruitingHubTabPanels({
  tab,
  showContent,
  highPriority,
  staffDashboard,
  loading,
  intel,
  rankYear,
  setRankYear,
  rankings,
}: Props): React.ReactElement | null {
  if (!showContent) return null;
  if (tab === 'commits-2026' || tab === 'commits-2027' || tab === 'targets-2027' || tab === 'targets-2028') {
    return null;
  }

  return (
    <div className="rh-tab-panels rh-frame">
      {tab === 'priority' && (
        <section>
          <h2 className="rh-panel-title">Top 10 UF Priority Targets</h2>
          <p className="rh-muted">
            Insider intel, visit schedule, staff confidence, and prediction schools — the advantage board.
          </p>
          <div className="gv-hp-board-grid">
            {highPriority.map((p, i) => (
              <HighPriorityTargetCard key={p.slug} player={p} rank={i + 1} />
            ))}
          </div>
          {highPriority.length === 0 && <UiEmpty message="No priority targets loaded." />}
        </section>
      )}

      {tab === 'intel' && (
        <div className="gv-rh-movement-wrap">
          <DashboardMovementPreview data={staffDashboard} loading={!staffDashboard && loading} />
          {(intel.risers.length > 0 || intel.fallers.length > 0) && (
            <section style={{ marginTop: 'var(--space-lg)' }}>
              <h2 className="rh-panel-title">Movement Tracker</h2>
              <div className="gv-rh-elite-grid" style={{ marginTop: 'var(--space-md)' }}>
                {[...intel.risers.slice(0, 6), ...intel.fallers.slice(0, 4)].map((p) => (
                  <PlayerCardEnhanced key={p.id} player={fromStaffDashboard(p)} variant="target" forceElite />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {tab === 'scouting' && (
        <section>
          <ScoutingTiles />
          <ScoutingDepartmentPage inVault />
        </section>
      )}

      {tab === 'portal' && <PortalList />}

      {tab === 'rankings' && (
        <section>
          <RecruitingSubTabBar
            options={[
              { id: '2027', label: '2027' },
              { id: '2028', label: '2028' },
            ]}
            active={String(rankYear)}
            onChange={(id) => setRankYear(id === '2028' ? 2028 : 2027)}
          />
          <h2 className="rh-panel-title">Priority Rankings — {rankYear} Targets</h2>
          <RankingsTable players={rankings} year={rankYear} />
        </section>
      )}
    </div>
  );
}
