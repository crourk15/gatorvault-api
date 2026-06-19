'use client';

import React, { useEffect } from 'react';
import { UiError } from '@/components/site/UiMessage';
import { FutureCastLabPageDesktop } from './lab/FutureCastLabPageDesktop';
import { FutureCastLabPageMobile } from './mobile/FutureCastLabPageMobile';
import { FutureCastLabAnchors } from './lab/FutureCastLabAnchors';
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
  }, [lab.loading]);

  if (lab.loading && !lab.masterBoard.players.length) {
    return (
      <div className="rh-cc-page rh-frame" data-testid="fc-elite-loading" aria-busy="true">
        <div className="rh-cc-skeleton" style={{ minHeight: 280, borderRadius: 12 }} />
        <div className="rh-cc-skeleton" style={{ minHeight: 200, borderRadius: 12, marginTop: 16 }} />
        <div className="rh-cc-skeleton" style={{ minHeight: 160, borderRadius: 12, marginTop: 16 }} />
      </div>
    );
  }
  if (lab.error && !lab.masterBoard.players.length) {
    return <UiError message={lab.error} />;
  }

  return (
    <>
      {isDesktop ? <FutureCastLabPageDesktop data={lab} /> : <FutureCastLabPageMobile data={lab} />}
      <FutureCastLabAnchors />
    </>
  );
}
