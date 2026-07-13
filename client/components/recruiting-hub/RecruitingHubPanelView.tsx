'use client';

import React, { useEffect, useState } from 'react';
import { RecruitingHubTabPanels } from '@/components/recruiting-hub/RecruitingHubTabPanels';
import { StickyTabsBar } from '@/components/recruiting-hub/StickyTabsBar';
import { useRecruitingData } from '@/hooks/useRecruitingData';
import {
  fetchHighPriorityTargets,
  HIGH_PRIORITY_YEAR,
  type HighPriorityPlayer,
} from '@/lib/futurecast-high-priority-api';
import { UiError } from '@/components/site/UiMessage';

/** Deep hub tabs — portal, rankings, scouting, intel, priority targets. */
export function RecruitingHubPanelView(): React.ReactElement {
  const hub = useRecruitingData();
  const [highPriority, setHighPriority] = useState<HighPriorityPlayer[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetchHighPriorityTargets(HIGH_PRIORITY_YEAR)
      .then((res) => {
        if (!cancelled) setHighPriority(res.players ?? []);
      })
      .catch(() => {
        if (!cancelled) setHighPriority([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rh-panel-view" data-testid="rh-panel-view">
      <div className="rh-panel-view__toolbar rh-frame">
        <a href="/vault/recruiting/" className="rh-panel-view__back">
          ← War Room overview
        </a>
      </div>
      <StickyTabsBar active={hub.tab} onChange={hub.setTabAndUrl} />
      {hub.error && !hub.loading ? (
        <UiError message={hub.error} retry={hub.reload} backHref="/vault/" backLabel="← Vault" />
      ) : (
        <RecruitingHubTabPanels
          tab={hub.tab}
          showContent
          highPriority={highPriority}
          staffDashboard={hub.staffDashboard}
          loading={hub.loading}
          intel={hub.intel}
          rankYear={hub.rankYear}
          setRankYear={hub.setRankYear}
          rankings={hub.rankings}
        />
      )}
    </div>
  );
}
