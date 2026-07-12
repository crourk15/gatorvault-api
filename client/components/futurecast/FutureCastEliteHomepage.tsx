'use client';

import '@/lib/futurecast-lab-command-center.css';

import React, { useEffect } from 'react';
import { UiError } from '@/components/site/UiMessage';
import { FutureCastLabSkeleton, FutureCastPanelSkeleton } from './FutureCastLabSkeleton';
import { FutureCastLabPageDesktop } from './lab/FutureCastLabPageDesktop';
import { FutureCastLabPageMobile } from './mobile/FutureCastLabPageMobile';
import { FutureCastLabAnchors } from './lab/FutureCastLabAnchors';
import { FutureCastLabCycleProvider } from './lab/FutureCastLabCycleContext';
import { useFutureCastLabData } from './lab/useFutureCastLabData';
import { useIsCommandCenterDesktop } from '@/hooks/useIsCommandCenterDesktop';

export function FutureCastEliteHomepage(): React.ReactElement {
  const lab = useFutureCastLabData();
  const isDesktop = useIsCommandCenterDesktop();

  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.hash) return;
    const id = window.location.hash.slice(1);
    const el = document.getElementById(id);
    if (el) {
      window.requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [lab.loading, lab.secondaryLoading]);

  if ((lab.loading || lab.warming) && !lab.masterBoard.players.length) {
    return <FutureCastLabSkeleton warming={lab.warming} />;
  }
  if (lab.error && !lab.masterBoard.players.length) {
    return (
      <UiError
        message={lab.error}
        retry={lab.reload}
        backHref="/vault"
        backLabel="← Vault Home"
      />
    );
  }

  return (
    <FutureCastLabCycleProvider>
      {isDesktop ? (
        <FutureCastLabPageDesktop lab={lab} PanelSkeleton={FutureCastPanelSkeleton} />
      ) : (
        <FutureCastLabPageMobile lab={lab} PanelSkeleton={FutureCastPanelSkeleton} />
      )}
      <FutureCastLabAnchors />
    </FutureCastLabCycleProvider>
  );
}
