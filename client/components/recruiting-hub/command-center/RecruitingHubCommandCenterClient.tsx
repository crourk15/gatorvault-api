'use client';

import React from 'react';
import { RecruitingHubElite } from '@/components/recruiting-hub/elite/RecruitingHubElite';
import { RecruitingHubPanelView } from '@/components/recruiting-hub/RecruitingHubPanelView';
import { isRecruitingPanelTab } from '@/lib/recruiting-hub-tabs';
import { normalizeRecruitingTab, resolveRecruitingTab } from '@/lib/vault-route-map';

type Props = {
  deferHero?: boolean;
};

/** Client-only hub sections (hero may be SSR-deferred). */
export function RecruitingHubCommandCenterClient({ deferHero = false }: Props): React.ReactElement {
  const [panelMode, setPanelMode] = React.useState(false);

  React.useEffect(() => {
    const sync = () => {
      const tab = normalizeRecruitingTab(resolveRecruitingTab());
      setPanelMode(isRecruitingPanelTab(tab));
    };
    sync();
    window.addEventListener('popstate', sync);
    window.addEventListener('vault:navigation', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('vault:navigation', sync);
    };
  }, []);

  if (panelMode) {
    return <RecruitingHubPanelView />;
  }

  return <RecruitingHubElite deferHero={deferHero} embedded />;
}
