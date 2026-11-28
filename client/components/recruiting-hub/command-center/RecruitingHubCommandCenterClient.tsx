'use client';

import React from 'react';
import { RecruitingHubElite } from '@/components/recruiting-hub/elite/RecruitingHubElite';
import { RecruitingHubPanelView } from '@/components/recruiting-hub/RecruitingHubPanelView';
import { isRecruitingPanelTab } from '@/lib/recruiting-hub-tabs';
import {
  futureCastLabHref,
  FUTURECAST_LAB_ANCHORS,
  normalizeRecruitingTab,
  resolveRecruitingTab,
} from '@/lib/vault-route-map';

const PORTAL_ROOM_HREF = futureCastLabHref(FUTURECAST_LAB_ANCHORS.portal);

type Props = {
  deferHero?: boolean;
};

/** Client-only hub sections (hero may be SSR-deferred). */
export function RecruitingHubCommandCenterClient({ deferHero = false }: Props): React.ReactElement {
  const [panelMode, setPanelMode] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return isRecruitingPanelTab(normalizeRecruitingTab(resolveRecruitingTab()));
  });

  React.useEffect(() => {
    const sync = () => {
      const tab = normalizeRecruitingTab(resolveRecruitingTab());
      if (tab === 'portal') {
        window.location.replace(PORTAL_ROOM_HREF);
        return;
      }
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
