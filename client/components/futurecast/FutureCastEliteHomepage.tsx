'use client';

import React, { useEffect } from 'react';
import { UiError } from '@/components/site/UiMessage';
import { FutureCastLabPageDesktop } from './lab/FutureCastLabPageDesktop';
import { FutureCastLabAnchors } from './lab/FutureCastLabAnchors';
import { useFutureCastLabData } from './lab/useFutureCastLabData';

export function FutureCastEliteHomepage(): React.ReactElement {
  const lab = useFutureCastLabData();

  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.hash) return;
    const id = window.location.hash.slice(1);
    const el = document.getElementById(id);
    if (el) {
      window.requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [lab.loading]);

  if (lab.loading && !lab.masterBoard.players.length) {
    return <p className="fc-elite-loading">Loading FutureCast…</p>;
  }
  if (lab.error && !lab.masterBoard.players.length) {
    return <UiError message={lab.error} />;
  }

  return (
    <div className="mobile-app" data-testid="fc-elite-homepage">
      <FutureCastLabPageDesktop data={lab} />
      <FutureCastLabAnchors />
    </div>
  );
}
